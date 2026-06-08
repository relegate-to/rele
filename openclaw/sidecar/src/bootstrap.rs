// Auth bootstrap for iframe loads.
//
// The web console iframes the gateway control UI and canvas. Browsers don't
// let us set request headers on an iframe load, so historically we shoved the
// JWT into the query string (`?jwt=…`). That URL ends up in Fly's edge logs,
// our own tracing layer, browser history, and any Referer-bearing outbound
// link from the proxied page.
//
// New flow:
//   1. Parent sets `iframe.src = "/__auth__/bootstrap?to=/__openclaw__/#<jwt>"`
//   2. We serve a tiny HTML page. The `#<jwt>` fragment is never sent to the
//      server — it stays in the browser. A small script reads `location.hash`,
//      POSTs it to `/__auth__/exchange` to get a session cookie set, then
//      `location.replace`s to `to`.
//   3. The iframe now navigates to the real path with a valid cookie. The JWT
//      never appeared in any URL the server, edge, or proxy could log.

use axum::extract::{Query, State};
use axum::http::{HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Response};
use axum_extra::TypedHeader;
use axum_extra::headers::{Authorization, authorization::Bearer};
use serde::Deserialize;

use crate::auth::verify_jwt;
use crate::config::AppState;

#[derive(Deserialize)]
pub struct BootstrapQuery {
    to: String,
}

/// Strict allowlist — the iframe is only used for these two paths. Anything
/// else is rejected so `to` can never be turned into an open redirect or a
/// reflected-XSS vector when interpolated into the HTML below.
fn is_allowed_target(path: &str) -> bool {
    matches!(path, "/__openclaw__/" | "/__openclaw__/canvas/")
}

pub async fn bootstrap_handler(
    State(state): State<AppState>,
    Query(q): Query<BootstrapQuery>,
) -> Response {
    if !is_allowed_target(&q.to) {
        return (StatusCode::BAD_REQUEST, "invalid target").into_response();
    }

    // The page never sees the JWT in its source — only the browser does, via
    // `location.hash`. `to` is allowlisted above, so the JSON-stringified
    // interpolation below is safe.
    let to_json = serde_json::to_string(&q.to).unwrap_or_else(|_| "\"/\"".to_string());
    let frame_ancestors = &state.config.frame_ancestors;

    let html = format!(
        r#"<!doctype html>
<html><head>
<meta charset="utf-8">
<title>Authenticating…</title>
<style>html,body{{background:#000;color:#999;font-family:system-ui;margin:0;padding:1rem}}</style>
</head><body>
<p>Authenticating…</p>
<script>
(async function() {{
  var hash = location.hash.replace(/^#/, "");
  // Wipe the fragment from the URL immediately so the JWT doesn't sit in
  // the current history entry while the exchange POST is in flight.
  try {{ history.replaceState(null, "", location.pathname + location.search); }} catch (e) {{}}
  if (!hash) {{ document.body.innerHTML = "<p>Missing auth token.</p>"; return; }}
  try {{
    var res = await fetch("/__auth__/exchange", {{
      method: "POST",
      credentials: "include",
      headers: {{ "Authorization": "Bearer " + decodeURIComponent(hash) }},
    }});
    if (!res.ok) throw new Error("auth exchange failed: " + res.status);
    location.replace({to_json});
  }} catch (e) {{
    document.body.innerHTML = "<p>Auth failed: " + (e && e.message || e) + "</p>";
  }}
}})();
</script>
</body></html>"#
    );

    let mut resp = (StatusCode::OK, html).into_response();
    let h = resp.headers_mut();
    h.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("text/html; charset=utf-8"),
    );
    // Restrict where this bootstrap page can be framed from. Same logic the
    // proxy uses for upstream responses — the bootstrap is only useful inside
    // the rele.to console iframe.
    if let Ok(v) = HeaderValue::from_str(&format!("frame-ancestors {}", frame_ancestors)) {
        h.insert(header::CONTENT_SECURITY_POLICY, v);
    }
    h.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    resp
}

pub async fn exchange_handler(
    State(state): State<AppState>,
    bearer: Option<TypedHeader<Authorization<Bearer>>>,
) -> Response {
    let Some(TypedHeader(Authorization(bearer))) = bearer else {
        return StatusCode::UNAUTHORIZED.into_response();
    };
    let token = bearer.token();

    if verify_jwt(token, &state.jwks_cache, &state.http_client, &state.config)
        .await
        .is_none()
    {
        return StatusCode::UNAUTHORIZED.into_response();
    }

    let cookie = format!(
        "session={}; HttpOnly; SameSite=None; Secure; Path=/; Max-Age=3600",
        url_encode(token)
    );
    let mut resp = StatusCode::NO_CONTENT.into_response();
    if let Ok(v) = HeaderValue::from_str(&cookie) {
        resp.headers_mut().insert(header::SET_COOKIE, v);
    }
    resp
}

fn url_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}
