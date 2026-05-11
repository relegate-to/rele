// MCP server with SSE transport.
//
// Spec: https://modelcontextprotocol.io/specification/2024-11-05/basic/transports#http-with-sse
//
//   GET  /mcp                       — SSE stream; first event is `endpoint` with the
//                                     POST URL (carrying ?sessionId=...). All
//                                     subsequent server→client messages are SSE
//                                     events of type `message` with JSON-RPC bodies.
//   POST /mcp?sessionId=<id>        — client→server JSON-RPC messages.
//
// Currently exposes one tool: `prompt_user`. When called, it registers a
// pending prompt, broadcasts an SSE event on the global event bus so the web
// UI can surface a prompt widget, and awaits the user's response (with a
// 5-minute timeout).

use std::collections::HashMap;
use std::convert::Infallible;
use std::time::Duration;

use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::response::Sse;
use axum::response::sse::{Event, KeepAlive};
use futures_util::stream::Stream;
use parking_lot::Mutex;
use serde::Deserialize;
use tokio::sync::mpsc;
use tokio_stream::StreamExt;
use tokio_stream::wrappers::ReceiverStream;

use crate::config::AppState;
use crate::events::SseEvent;

const PROMPT_TIMEOUT: Duration = Duration::from_secs(300);

pub struct McpSessions {
    sessions: Mutex<HashMap<String, mpsc::Sender<serde_json::Value>>>,
}

impl McpSessions {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }

    fn insert(&self, id: String, tx: mpsc::Sender<serde_json::Value>) {
        self.sessions.lock().insert(id, tx);
    }

    fn get(&self, id: &str) -> Option<mpsc::Sender<serde_json::Value>> {
        self.sessions.lock().get(id).cloned()
    }

    fn remove(&self, id: &str) {
        self.sessions.lock().remove(id);
    }
}

// ── SSE stream (GET /mcp) ────────────────────────────────────────────────────

pub async fn sse_handler(
    State(state): State<AppState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let session_id = uuid::Uuid::new_v4().to_string();
    let (tx, rx) = mpsc::channel::<serde_json::Value>(64);
    state.mcp_sessions.insert(session_id.clone(), tx);

    let endpoint_url = format!("/mcp?sessionId={}", session_id);
    let initial = Event::default().event("endpoint").data(endpoint_url);

    let sessions = state.mcp_sessions.clone();
    let cleanup_id = session_id.clone();

    let body_stream = ReceiverStream::new(rx).map(move |msg| {
        Ok::<_, Infallible>(Event::default().event("message").data(msg.to_string()))
    });

    // Prepend the initial `endpoint` event.
    let stream = futures_util::stream::once(async move { Ok(initial) })
        .chain(body_stream)
        .chain(futures_util::stream::once(async move {
            sessions.remove(&cleanup_id);
            // Unreachable in practice; the stream is dropped when the client
            // disconnects, which is what triggers cleanup via the Drop chain
            // above. This is just a fallback.
            Ok(Event::default().comment(""))
        }));

    Sse::new(stream).keep_alive(KeepAlive::default())
}

// ── Inbound JSON-RPC (POST /mcp) ─────────────────────────────────────────────

#[derive(Deserialize)]
pub struct PostParams {
    #[serde(rename = "sessionId")]
    session_id: String,
}

#[derive(Deserialize)]
struct JsonRpcRequest {
    #[serde(default)]
    jsonrpc: String,
    #[serde(default)]
    id: Option<serde_json::Value>,
    method: String,
    #[serde(default)]
    params: serde_json::Value,
}

pub async fn post_handler(
    State(state): State<AppState>,
    Query(params): Query<PostParams>,
    axum::Json(body): axum::Json<serde_json::Value>,
) -> StatusCode {
    let Some(sender) = state.mcp_sessions.get(&params.session_id) else {
        return StatusCode::NOT_FOUND;
    };

    let req: JsonRpcRequest = match serde_json::from_value(body) {
        Ok(r) => r,
        Err(_) => return StatusCode::BAD_REQUEST,
    };

    // Spawn handling so we don't block the POST response on the (potentially
    // long) prompt_user wait.
    let session_id = params.session_id.clone();
    let state_clone = state.clone();
    tokio::spawn(async move {
        let response = handle_jsonrpc(state_clone, req).await;
        if let Some(r) = response {
            let _ = sender.send(r).await;
        }
        // Discard send errors — the client disconnected.
        let _ = session_id;
    });

    StatusCode::ACCEPTED
}

async fn handle_jsonrpc(
    state: AppState,
    req: JsonRpcRequest,
) -> Option<serde_json::Value> {
    let _ = req.jsonrpc;
    let id = req.id.unwrap_or(serde_json::Value::Null);

    match req.method.as_str() {
        "initialize" => Some(serde_json::json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": { "tools": {} },
                "serverInfo": { "name": "openclaw-sidecar", "version": env!("CARGO_PKG_VERSION") }
            }
        })),
        "tools/list" => Some(serde_json::json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": {
                "tools": [
                    {
                        "name": "prompt_user",
                        "description": "Ask the user a question through the UI and await their response.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "text":        { "type": "string", "description": "The prompt label (e.g. \"GitHub API key\")." },
                                "description": { "type": "string", "description": "Helper copy shown beneath the input." }
                            },
                            "required": ["text"]
                        }
                    }
                ]
            }
        })),
        "tools/call" => {
            let name = req.params.get("name").and_then(|v| v.as_str())?;
            let args = req.params.get("arguments").cloned().unwrap_or(serde_json::Value::Null);
            match name {
                "prompt_user" => Some(handle_prompt_user(&state, id, &args).await),
                _ => Some(serde_json::json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "error": { "code": -32601, "message": format!("Unknown tool: {}", name) }
                })),
            }
        }
        _ => Some(serde_json::json!({
            "jsonrpc": "2.0",
            "id": id,
            "error": { "code": -32601, "message": format!("Unknown method: {}", req.method) }
        })),
    }
}

async fn handle_prompt_user(
    state: &AppState,
    id: serde_json::Value,
    args: &serde_json::Value,
) -> serde_json::Value {
    let text = args.get("text").and_then(|v| v.as_str()).unwrap_or("");
    let description = args.get("description").and_then(|v| v.as_str()).unwrap_or("");

    let prompt_id = uuid::Uuid::new_v4().to_string();
    let rx = state.pending_prompts.register(prompt_id.clone());

    let _ = state.event_tx.send(SseEvent {
        event: "prompt".to_string(),
        data: serde_json::json!({
            "id": prompt_id,
            "text": text,
            "description": description,
        }),
    });

    let result = tokio::time::timeout(PROMPT_TIMEOUT, rx).await;
    match result {
        Ok(Ok(value)) => serde_json::json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": {
                "content": [{ "type": "text", "text": value }]
            }
        }),
        _ => {
            // Clean up pending prompt entry on timeout.
            let _ = state.pending_prompts.respond(&prompt_id, String::new());
            serde_json::json!({
                "jsonrpc": "2.0",
                "id": id,
                "error": { "code": -32000, "message": "Prompt timed out or cancelled" }
            })
        }
    }
}

