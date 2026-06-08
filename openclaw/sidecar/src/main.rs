use std::sync::Arc;

use axum::Router;
use axum::extract::{DefaultBodyLimit, Request};
use axum::http::{HeaderValue, header};
use axum::middleware::Next;
use axum::response::Response;
use axum::routing::{get, post};
use tokio::net::TcpListener;
use tokio::sync::broadcast;
use tracing_subscriber::EnvFilter;

mod auth;
mod bootstrap;
mod config;
mod events;
mod health;
mod inject;
mod jobs;
mod mcp;
mod origin;
mod prompt;
mod proxy;
mod skills;
mod terminal;
mod ws;

use config::{AppConfig, AppState};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    let config = Arc::new(AppConfig::from_env()?);
    let http_client = reqwest::Client::builder()
        .pool_idle_timeout(std::time::Duration::from_secs(30))
        .build()?;

    let (event_tx, _) = broadcast::channel(128);

    let state = AppState {
        config: config.clone(),
        http_client,
        jwks_cache: Arc::new(auth::JwksCache::new()),
        event_tx,
        pending_prompts: Arc::new(prompt::PendingPrompts::new()),
        install_jobs: Arc::new(jobs::InstallJobs::new()),
        skills_cache: Arc::new(skills::SkillsCache::new()),
        mcp_sessions: Arc::new(mcp::McpSessions::new()),
    };

    // Authenticated routes. Order matters — more specific paths before fallback.
    let authed = Router::new()
        .route("/mcp", get(mcp::sse_handler).post(mcp::post_handler))
        .route("/api/events", get(events::sse_handler))
        .route(
            "/api/prompt/{id}/respond",
            post(prompt::respond_handler),
        )
        .route(
            "/api/skills",
            get(skills::list_handler).post(skills::list_with_config_handler),
        )
        .route(
            "/api/skills/{id}/enable",
            post(skills::enable_handler),
        )
        .route(
            "/api/skills/{id}/disable",
            post(skills::disable_handler),
        )
        .route(
            "/api/skills/{id}/install/{install_id}",
            post(jobs::start_install_handler),
        )
        .route(
            "/api/skills/install/{job_id}",
            get(jobs::poll_handler),
        )
        .route(
            "/api/gateway/restart",
            post(skills::gateway_restart_handler),
        )
        .route("/api/terminal", get(terminal::handler))
        .fallback(proxy::http_fallback_handler)
        // `layer` (not `route_layer`) so middleware also applies to the
        // fallback — WS upgrades and proxied HTTP both go via fallback.
        // Order: last-added is outermost, so auth runs first, then ws.
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            ws::ws_middleware,
        ))
        // CSRF check sits between auth and ws — runs for every authed
        // request, blocks cookie-bearing unsafe methods from a bad origin.
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            origin::csrf_middleware,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            auth::auth_middleware,
        ));

    let app = Router::new()
        .route("/health", get(health::handler))
        // /__auth__/* are intentionally unauthenticated at the middleware
        // layer — the exchange handler does its own JWT verification, and
        // the bootstrap page is a static loader.
        .route("/__auth__/bootstrap", get(bootstrap::bootstrap_handler))
        .route("/__auth__/exchange", post(bootstrap::exchange_handler))
        .merge(authed)
        .layer(DefaultBodyLimit::max(50 * 1024 * 1024))
        .layer(axum::middleware::from_fn(security_headers))
        .with_state(state);

    let listener = TcpListener::bind("0.0.0.0:80").await?;
    tracing::info!("sidecar listening on :80");
    axum::serve(listener, app.into_make_service_with_connect_info::<std::net::SocketAddr>())
        .await?;
    Ok(())
}

/// Belt-and-braces hardening for the public surface. Fly's edge already does
/// the TLS work and we set `force_https` on the service, but HSTS makes the
/// browser refuse to downgrade on future visits.
async fn security_headers(req: Request, next: Next) -> Response {
    let mut resp = next.run(req).await;
    let h = resp.headers_mut();
    h.insert(
        header::STRICT_TRANSPORT_SECURITY,
        HeaderValue::from_static("max-age=31536000; includeSubDomains"),
    );
    h.insert(
        header::REFERRER_POLICY,
        HeaderValue::from_static("no-referrer"),
    );
    h.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    resp
}
