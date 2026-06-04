use std::convert::Infallible;

use axum::extract::State;
use axum::response::Sse;
use axum::response::sse::{Event, KeepAlive};
use futures_util::stream::Stream;
use tokio_stream::StreamExt;
use tokio_stream::wrappers::BroadcastStream;

use crate::config::AppState;

#[derive(Clone, Debug)]
pub struct SseEvent {
    pub event: String,
    pub data: serde_json::Value,
}

pub async fn sse_handler(
    State(state): State<AppState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let rx = state.event_tx.subscribe();
    let stream = BroadcastStream::new(rx).filter_map(|msg| {
        msg.ok().map(|e| {
            Ok(Event::default()
                .event(e.event)
                .data(e.data.to_string()))
        })
    });
    Sse::new(stream).keep_alive(KeepAlive::default())
}
