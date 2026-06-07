// PTY-backed terminal over WebSocket.
//
// Wire protocol — binary frames, first byte is a tag:
//   0x00 <bytes...>           stdin (raw utf8 from the browser)
//   0x01 <cols:u16 BE> <rows:u16 BE>   resize
// Server → client: raw PTY output as binary frames.

use std::io::{Read, Write};
use std::sync::Arc;

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::response::Response;
use futures_util::{SinkExt, StreamExt};
use parking_lot::Mutex;
use portable_pty::{CommandBuilder, MasterPty, PtySize, native_pty_system};
use tokio::sync::mpsc;

const DEFAULT_CWD: &str = "/home/node/.openclaw/workspace";
const DEFAULT_SHELL: &str = "/bin/bash";

pub async fn handler(ws: WebSocketUpgrade) -> Response {
    ws.on_upgrade(|socket| async move {
        if let Err(e) = run(socket).await {
            tracing::warn!("terminal session ended: {}", e);
        }
    })
}

async fn run(socket: WebSocket) -> anyhow::Result<()> {
    let pty_system = native_pty_system();
    let pair = pty_system.openpty(PtySize {
        rows: 24,
        cols: 80,
        pixel_width: 0,
        pixel_height: 0,
    })?;

    let shell = std::env::var("TERMINAL_CMD")
        .ok()
        .or_else(|| std::env::var("SHELL").ok())
        .unwrap_or_else(|| DEFAULT_SHELL.to_string());
    let cwd = std::env::var("TERMINAL_CWD").unwrap_or_else(|_| DEFAULT_CWD.to_string());

    let mut cmd = CommandBuilder::new(&shell);
    if std::path::Path::new(&cwd).is_dir() {
        cmd.cwd(&cwd);
    }
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    if let Ok(home) = std::env::var("HOME") {
        cmd.env("HOME", home);
    }
    if let Ok(path) = std::env::var("PATH") {
        cmd.env("PATH", path);
    }

    let mut child = pair.slave.spawn_command(cmd)?;
    let mut killer = child.clone_killer();
    drop(pair.slave);

    let mut reader = pair.master.try_clone_reader()?;
    let mut writer = pair.master.take_writer()?;
    let master: Arc<Mutex<Box<dyn MasterPty + Send>>> = Arc::new(Mutex::new(pair.master));

    let (out_tx, mut out_rx) = mpsc::channel::<Vec<u8>>(64);
    let (in_tx, mut in_rx) = mpsc::channel::<Vec<u8>>(64);

    // Blocking thread: read from PTY → out_tx
    let reader_handle = tokio::task::spawn_blocking(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    if out_tx.blocking_send(buf[..n].to_vec()).is_err() {
                        break;
                    }
                }
                Err(e) => {
                    tracing::debug!("pty read error: {}", e);
                    break;
                }
            }
        }
    });

    // Blocking thread: in_rx → write to PTY
    let writer_handle = tokio::task::spawn_blocking(move || {
        while let Some(bytes) = in_rx.blocking_recv() {
            if writer.write_all(&bytes).is_err() {
                break;
            }
            let _ = writer.flush();
        }
    });

    // Blocking thread: wait for child to exit
    let child_handle = tokio::task::spawn_blocking(move || {
        let _ = child.wait();
    });

    let (mut ws_tx, mut ws_rx) = socket.split();

    // PTY → WS
    let send_task = tokio::spawn(async move {
        while let Some(bytes) = out_rx.recv().await {
            if ws_tx.send(Message::Binary(bytes.into())).await.is_err() {
                break;
            }
        }
        let _ = ws_tx.send(Message::Close(None)).await;
    });

    // WS → PTY
    let master_for_recv = master.clone();
    let recv_task = tokio::spawn(async move {
        while let Some(msg) = ws_rx.next().await {
            let Ok(msg) = msg else { break };
            match msg {
                Message::Binary(data) => {
                    if data.is_empty() {
                        continue;
                    }
                    match data[0] {
                        0x00 => {
                            if in_tx.send(data[1..].to_vec()).await.is_err() {
                                break;
                            }
                        }
                        0x01 => {
                            if data.len() >= 5 {
                                let cols = u16::from_be_bytes([data[1], data[2]]);
                                let rows = u16::from_be_bytes([data[3], data[4]]);
                                let _ = master_for_recv.lock().resize(PtySize {
                                    rows,
                                    cols,
                                    pixel_width: 0,
                                    pixel_height: 0,
                                });
                            }
                        }
                        _ => {}
                    }
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
    });

    tokio::select! {
        _ = send_task => {}
        _ = recv_task => {}
        _ = child_handle => {}
    }

    // Tear down: kill the child if it's still running, then drop the master
    // so the reader's blocking read returns EOF.
    let _ = killer.kill();
    drop(master);
    let _ = reader_handle.await;
    let _ = writer_handle.await;
    Ok(())
}
