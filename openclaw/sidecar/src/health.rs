use std::time::Duration;

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;

use crate::config::AppState;

pub async fn handler(State(state): State<AppState>) -> impl IntoResponse {
    let result = state
        .http_client
        .head(format!("http://{}/", state.config.upstream))
        .timeout(Duration::from_secs(3))
        .send()
        .await;
    match result {
        Ok(_) => (StatusCode::OK, "ok"),
        Err(_) => (StatusCode::SERVICE_UNAVAILABLE, "not ready"),
    }
}
