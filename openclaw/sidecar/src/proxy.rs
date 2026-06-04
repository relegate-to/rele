use std::collections::HashSet;
use std::sync::LazyLock;

use axum::body::Body;
use axum::extract::{Request, State};
use axum::http::{HeaderMap, HeaderName, HeaderValue, Method, StatusCode, header};
use axum::response::{IntoResponse, Response};
use bytes::Bytes;
use futures_util::TryStreamExt;

use crate::config::AppState;
use crate::inject::inject_into_html;

static STRIP_HEADERS: LazyLock<HashSet<&'static str>> = LazyLock::new(|| {
    let mut s = HashSet::new();
    s.insert("authorization");
    s.insert("x-forwarded-for");
    s.insert("x-forwarded-proto");
    s.insert("x-forwarded-host");
    s.insert("x-forwarded-user");
    s.insert("x-auth-user");
    s.insert("referer");
    s.insert("host");
    s.insert("content-length");
    s
});

pub async fn http_fallback_handler(
    State(state): State<AppState>,
    req: Request,
) -> Result<Response, StatusCode> {
    // Strip token/jwt from query string before proxying upstream.
    let (parts, body) = req.into_parts();
    let path_and_query = sanitised_path_and_query(parts.uri.path(), parts.uri.query());
    let path_only = parts.uri.path().to_string();
    let upstream_url = format!("http://{}{}", state.config.upstream, path_and_query);

    let real_origin = parts
        .headers
        .get(header::ORIGIN)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    // Build upstream request with stripped/replaced headers.
    let mut req_builder = state
        .http_client
        .request(parts.method.clone(), &upstream_url);

    for (name, value) in parts.headers.iter() {
        let n = name.as_str().to_ascii_lowercase();
        if STRIP_HEADERS.contains(n.as_str()) {
            continue;
        }
        req_builder = req_builder.header(name, value);
    }
    req_builder = req_builder
        .header(header::HOST, "localhost:18789")
        .header(
            header::AUTHORIZATION,
            format!("Bearer {}", state.config.gateway_token),
        );
    if real_origin.is_some() {
        req_builder = req_builder.header(header::ORIGIN, "http://localhost:18789");
    }

    // Body — stream from axum body to reqwest body.
    let body_stream = body
        .into_data_stream()
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e));
    req_builder = req_builder.body(reqwest::Body::wrap_stream(body_stream));

    let upstream_res = match req_builder.send().await {
        Ok(r) => r,
        Err(e) => {
            tracing::error!("upstream error: {}", e);
            return Err(StatusCode::BAD_GATEWAY);
        }
    };

    let status = upstream_res.status();
    let mut headers = upstream_res.headers().clone();

    headers.remove("x-frame-options");
    headers.remove("content-security-policy");

    if let (Some(origin), Some(_)) = (
        real_origin.as_deref(),
        headers.get(header::ACCESS_CONTROL_ALLOW_ORIGIN),
    ) {
        if let Ok(v) = HeaderValue::from_str(origin) {
            headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, v);
        }
    }

    let is_html = headers
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.contains("text/html"))
        .unwrap_or(false);
    let is_get = parts.method == Method::GET;

    let response = if is_html && is_get {
        let body_bytes = match upstream_res.bytes().await {
            Ok(b) => b,
            Err(e) => {
                tracing::error!("body read error: {}", e);
                return Err(StatusCode::BAD_GATEWAY);
            }
        };
        let html = String::from_utf8_lossy(&body_bytes);
        let injected = inject_into_html(&html, &path_only);
        let bytes = Bytes::from(injected);
        headers.remove(header::CONTENT_LENGTH);
        headers.insert(
            header::CONTENT_LENGTH,
            HeaderValue::from_str(&bytes.len().to_string()).unwrap(),
        );
        build_response(status, headers, Body::from(bytes))
    } else {
        let stream = upstream_res.bytes_stream();
        build_response(status, headers, Body::from_stream(stream))
    };

    Ok(response)
}

fn build_response(status: StatusCode, headers: HeaderMap, body: Body) -> Response {
    let mut resp = (status, body).into_response();
    // Replace headers with the upstream-derived set (excluding hop-by-hop).
    let resp_headers = resp.headers_mut();
    resp_headers.clear();
    for (k, v) in headers.iter() {
        let n = k.as_str().to_ascii_lowercase();
        if is_hop_by_hop(&n) {
            continue;
        }
        if let Ok(name) = HeaderName::from_bytes(k.as_str().as_bytes()) {
            resp_headers.append(name, v.clone());
        }
    }
    resp
}

fn is_hop_by_hop(name: &str) -> bool {
    matches!(
        name,
        "connection"
            | "keep-alive"
            | "proxy-authenticate"
            | "proxy-authorization"
            | "te"
            | "trailers"
            | "transfer-encoding"
            | "upgrade"
    )
}

fn sanitised_path_and_query(path: &str, query: Option<&str>) -> String {
    match query {
        None => path.to_string(),
        Some(q) => {
            let mut kept = Vec::new();
            for pair in q.split('&') {
                let mut it = pair.splitn(2, '=');
                let k = it.next().unwrap_or("");
                if k == "token" || k == "jwt" {
                    continue;
                }
                kept.push(pair);
            }
            if kept.is_empty() {
                path.to_string()
            } else {
                format!("{}?{}", path, kept.join("&"))
            }
        }
    }
}
