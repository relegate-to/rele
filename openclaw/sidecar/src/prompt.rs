use std::collections::HashMap;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use parking_lot::Mutex;
use serde::Deserialize;
use tokio::sync::oneshot;

use crate::config::AppState;

pub struct PendingPrompts {
    map: Mutex<HashMap<String, oneshot::Sender<String>>>,
}

impl PendingPrompts {
    pub fn new() -> Self {
        Self {
            map: Mutex::new(HashMap::new()),
        }
    }

    pub fn register(&self, id: String) -> oneshot::Receiver<String> {
        let (tx, rx) = oneshot::channel();
        self.map.lock().insert(id, tx);
        rx
    }

    pub fn respond(&self, id: &str, value: String) -> bool {
        if let Some(tx) = self.map.lock().remove(id) {
            tx.send(value).is_ok()
        } else {
            false
        }
    }
}

#[derive(Deserialize)]
pub struct PromptResponse {
    pub value: String,
}

pub async fn respond_handler(
    Path(id): Path<String>,
    State(state): State<AppState>,
    axum::Json(body): axum::Json<PromptResponse>,
) -> StatusCode {
    if state.pending_prompts.respond(&id, body.value) {
        StatusCode::OK
    } else {
        StatusCode::NOT_FOUND
    }
}
