// Origin enforcement helpers. The session cookie is `SameSite=None` (required
// for iframe embedding from rele.to), so the browser will attach it to any
// cross-origin request — including WebSocket handshakes and form POSTs from
// arbitrary attacker sites. We block both vectors by validating `Origin` on
// state-changing HTTP requests and on every WS upgrade.

use axum::extract::{Request, State};
use axum::http::{HeaderMap, Method, StatusCode, header};
use axum::middleware::Next;
use axum::response::Response;

use crate::config::AppState;

/// True if `origin` is on our static allowlist, or equals the request's own
/// host (the proxied gateway UI legitimately posts back to its own origin).
pub fn is_origin_allowed(origin: &str, headers: &HeaderMap, allowed: &[String]) -> bool {
    if allowed.iter().any(|a| a == origin) {
        return true;
    }
    if let Some(host) = headers.get(header::HOST).and_then(|v| v.to_str().ok()) {
        // Match scheme://host exactly (no trailing path / query).
        if origin == format!("https://{}", host) || origin == format!("http://{}", host) {
            return true;
        }
    }
    false
}

/// Returns true iff the request carries our session cookie. Cookie-bearing
/// requests are the CSRF risk; pure-Bearer (programmatic) clients are not.
fn has_session_cookie(headers: &HeaderMap) -> bool {
    headers
        .get(header::COOKIE)
        .and_then(|v| v.to_str().ok())
        .map(|s| {
            s.split(';')
                .any(|p| p.trim().starts_with("session="))
        })
        .unwrap_or(false)
}

/// Reject state-changing requests that look cookie-authenticated unless their
/// `Origin` is on the allowlist. Safe methods (GET/HEAD/OPTIONS) pass through
/// — CORS already blocks an attacker from reading their responses.
pub async fn csrf_middleware(
    State(state): State<AppState>,
    req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let method = req.method();
    if matches!(*method, Method::GET | Method::HEAD | Method::OPTIONS) {
        return Ok(next.run(req).await);
    }
    if !has_session_cookie(req.headers()) {
        return Ok(next.run(req).await);
    }
    let Some(origin) = req
        .headers()
        .get(header::ORIGIN)
        .and_then(|v| v.to_str().ok())
    else {
        // Browsers always send Origin on non-GET. Missing it from a
        // cookie-auth request is suspicious — reject.
        return Err(StatusCode::FORBIDDEN);
    };
    if !is_origin_allowed(origin, req.headers(), &state.config.allowed_origins) {
        return Err(StatusCode::FORBIDDEN);
    }
    Ok(next.run(req).await)
}
