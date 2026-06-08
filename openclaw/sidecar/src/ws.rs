// WebSocket tunnel.
//
// The Node sidecar handled this by accepting the raw TCP upgrade socket from
// Node's HTTP server, opening its own TCP to upstream, writing a rewritten
// HTTP/1.1 upgrade request, and bidirectional-piping the two sockets. The
// client thus negotiated its WS handshake directly with upstream.
//
// hyper 1.x does not expose the pre-upgrade socket. Instead it sends its own
// `101 Switching Protocols` response and only then surfaces the upgraded IO.
// So we play the WS handshake on both sides separately:
//
//   1. We compute `Sec-WebSocket-Accept` from the client's `Sec-WebSocket-Key`
//      and return our own 101 to the client.
//   2. We open a fresh TCP to upstream, write a new upgrade request with our
//      own `Sec-WebSocket-Key`, and read past upstream's 101 response.
//   3. We `tokio::io::copy_bidirectional` raw frames between the two streams.

use std::collections::HashSet;
use std::sync::LazyLock;

use axum::body::Body;
use axum::extract::{Request, State};
use axum::http::{HeaderMap, HeaderValue, StatusCode, header};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use sha1::{Digest, Sha1};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

use crate::config::AppState;

const WS_ACCEPT_MAGIC: &str = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

static STRIP_WS_HEADERS: LazyLock<HashSet<&'static str>> = LazyLock::new(|| {
    let mut s = HashSet::new();
    s.insert("authorization");
    s.insert("x-auth-user");
    s.insert("x-forwarded-for");
    s.insert("x-forwarded-proto");
    s.insert("x-forwarded-host");
    s.insert("x-forwarded-user");
    s.insert("host");
    s
});

fn is_ws_upgrade(req: &Request) -> bool {
    let conn = req
        .headers()
        .get(header::CONNECTION)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let upg = req
        .headers()
        .get(header::UPGRADE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    conn.split(',').any(|p| p.trim().eq_ignore_ascii_case("upgrade"))
        && upg.eq_ignore_ascii_case("websocket")
}

fn compute_accept(client_key: &str) -> String {
    let mut hasher = Sha1::new();
    hasher.update(client_key.as_bytes());
    hasher.update(WS_ACCEPT_MAGIC.as_bytes());
    BASE64.encode(hasher.finalize())
}

fn sanitised_path(path: &str, query: Option<&str>) -> String {
    let Some(q) = query else {
        return path.to_string();
    };
    let kept: Vec<&str> = q
        .split('&')
        .filter(|pair| {
            let key = pair.splitn(2, '=').next().unwrap_or("");
            key != "token" && key != "jwt"
        })
        .collect();
    if kept.is_empty() {
        path.to_string()
    } else {
        format!("{}?{}", path, kept.join("&"))
    }
}

fn build_upstream_request(
    method: &str,
    path_and_query: &str,
    incoming_headers: &HeaderMap,
    user_id: &str,
) -> String {
    let mut out = format!("{} {} HTTP/1.1\r\n", method, path_and_query);
    out.push_str("Host: localhost:18789\r\n");
    out.push_str("Origin: https://rele.to\r\n");
    for (name, value) in incoming_headers.iter() {
        let n = name.as_str().to_ascii_lowercase();
        if STRIP_WS_HEADERS.contains(n.as_str()) {
            continue;
        }
        if n == "origin" {
            continue; // we set our own above
        }
        if let Ok(v) = value.to_str() {
            out.push_str(&format!("{}: {}\r\n", name, v));
        }
    }
    out.push_str(&format!("X-Forwarded-User: {}\r\n", user_id));
    out.push_str("\r\n");
    out
}

async fn read_until_double_crlf<R: AsyncReadExt + Unpin>(
    reader: &mut R,
) -> std::io::Result<Vec<u8>> {
    let mut buf = Vec::with_capacity(512);
    let mut byte = [0u8; 1];
    loop {
        let n = reader.read(&mut byte).await?;
        if n == 0 {
            return Err(std::io::Error::new(
                std::io::ErrorKind::UnexpectedEof,
                "upstream closed before completing handshake",
            ));
        }
        buf.push(byte[0]);
        if buf.len() >= 4 && &buf[buf.len() - 4..] == b"\r\n\r\n" {
            return Ok(buf);
        }
        if buf.len() > 16 * 1024 {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "upstream upgrade headers too large",
            ));
        }
    }
}

pub async fn ws_middleware(
    State(state): State<AppState>,
    mut req: Request,
    next: Next,
) -> Response {
    if !is_ws_upgrade(&req) {
        return next.run(req).await;
    }

    // The terminal endpoint runs locally on the sidecar — don't tunnel its
    // upgrade to the gateway, let axum's route handler take it.
    if req.uri().path() == "/api/terminal" {
        return next.run(req).await;
    }

    // Pull out everything we need before consuming the request for upgrade.
    let client_key = match req
        .headers()
        .get("sec-websocket-key")
        .and_then(|v| v.to_str().ok())
    {
        Some(k) => k.to_string(),
        None => return (StatusCode::BAD_REQUEST, "missing sec-websocket-key").into_response(),
    };
    let accept = compute_accept(&client_key);

    let method = req.method().as_str().to_string();
    let path_and_query = sanitised_path(req.uri().path(), req.uri().query());
    let headers = req.headers().clone();
    let selected_protocol = headers.get("sec-websocket-protocol").cloned();
    let user_id = state.config.user_id.clone();
    let upstream_addr = state.config.upstream;

    let upgrade_fut = hyper::upgrade::on(&mut req);

    tokio::spawn(async move {
        let upgraded = match upgrade_fut.await {
            Ok(u) => u,
            Err(e) => {
                tracing::warn!("ws client upgrade failed: {}", e);
                return;
            }
        };
        let mut client_io = hyper_util::rt::TokioIo::new(upgraded);

        let mut upstream = match TcpStream::connect(upstream_addr).await {
            Ok(t) => t,
            Err(e) => {
                tracing::warn!("ws upstream connect failed: {}", e);
                return;
            }
        };

        let req_str =
            build_upstream_request(&method, &path_and_query, &headers, &user_id);
        if let Err(e) = upstream.write_all(req_str.as_bytes()).await {
            tracing::warn!("ws upstream write failed: {}", e);
            return;
        }

        // Drain upstream's response headers — we don't propagate them to the
        // client (we already sent our own 101). If upstream rejects the
        // upgrade, the copy will simply fail.
        if let Err(e) = read_until_double_crlf(&mut upstream).await {
            tracing::warn!("ws upstream response read failed: {}", e);
            return;
        }

        // Bidirectional raw frame copy.
        if let Err(e) =
            tokio::io::copy_bidirectional(&mut client_io, &mut upstream).await
        {
            tracing::debug!("ws tunnel closed: {}", e);
        }
    });

    let mut resp = Response::builder()
        .status(StatusCode::SWITCHING_PROTOCOLS)
        .body(Body::empty())
        .unwrap();
    let h = resp.headers_mut();
    h.insert(header::UPGRADE, HeaderValue::from_static("websocket"));
    h.insert(header::CONNECTION, HeaderValue::from_static("Upgrade"));
    if let Ok(v) = HeaderValue::from_str(&accept) {
        h.insert("Sec-WebSocket-Accept", v);
    }
    // Mirror the client's `Sec-WebSocket-Protocol` selection if provided.
    if let Some(proto) = selected_protocol {
        h.insert("Sec-WebSocket-Protocol", proto);
    }
    resp
}

