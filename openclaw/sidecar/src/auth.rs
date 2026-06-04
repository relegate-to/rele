use std::time::{Duration, Instant};

use axum::extract::{Request, State};
use axum::http::{HeaderValue, StatusCode, header};
use axum::middleware::Next;
use axum::response::Response;
use jsonwebtoken::jwk::JwkSet;
use parking_lot::RwLock;
use serde::Deserialize;

use crate::config::{AppConfig, AppState};

const JWKS_TTL: Duration = Duration::from_secs(300);

pub struct JwksCache {
    inner: RwLock<Option<Cached>>,
}

struct Cached {
    keys: JwkSet,
    fetched_at: Instant,
}

impl JwksCache {
    pub fn new() -> Self {
        Self {
            inner: RwLock::new(None),
        }
    }

    async fn fetch(&self, client: &reqwest::Client, neon_auth_url: &str) -> anyhow::Result<JwkSet> {
        let url = format!("{}/.well-known/jwks.json", neon_auth_url.trim_end_matches('/'));
        let resp = client.get(&url).send().await?.error_for_status()?;
        let set: JwkSet = resp.json().await?;
        Ok(set)
    }

    pub async fn get(&self, client: &reqwest::Client, neon_auth_url: &str) -> anyhow::Result<JwkSet> {
        {
            let g = self.inner.read();
            if let Some(c) = g.as_ref() {
                if c.fetched_at.elapsed() < JWKS_TTL {
                    return Ok(c.keys.clone());
                }
            }
        }
        let set = self.fetch(client, neon_auth_url).await?;
        *self.inner.write() = Some(Cached {
            keys: set.clone(),
            fetched_at: Instant::now(),
        });
        Ok(set)
    }
}

#[derive(Debug, Deserialize)]
struct Claims {
    sub: String,
    #[allow(dead_code)]
    iss: Option<String>,
}

fn issuer_from_url(url: &str) -> String {
    // Match the JS behaviour: issuer is the origin (scheme://host[:port]).
    if let Some(scheme_end) = url.find("://") {
        let after = &url[scheme_end + 3..];
        let host_end = after.find('/').unwrap_or(after.len());
        format!("{}{}", &url[..scheme_end + 3], &after[..host_end])
    } else {
        url.to_string()
    }
}

pub async fn verify_jwt(
    token: &str,
    cache: &JwksCache,
    client: &reqwest::Client,
    config: &AppConfig,
) -> Option<String> {
    let header = jsonwebtoken::decode_header(token).ok()?;
    let keys = cache.get(client, &config.neon_auth_url).await.ok()?;

    // Find candidate keys (by kid if present, else try all).
    let candidates: Vec<&jsonwebtoken::jwk::Jwk> = match &header.kid {
        Some(kid) => keys
            .keys
            .iter()
            .filter(|k| k.common.key_id.as_deref() == Some(kid))
            .collect(),
        None => keys.keys.iter().collect(),
    };

    let issuer = issuer_from_url(&config.neon_auth_url);

    for jwk in candidates {
        let Ok(decoding_key) = jsonwebtoken::DecodingKey::from_jwk(jwk) else {
            continue;
        };
        let mut validation = jsonwebtoken::Validation::new(header.alg);
        validation.set_issuer(&[&issuer]);
        validation.set_required_spec_claims(&["sub", "iss", "exp"]);
        validation.validate_aud = false;
        if let Ok(data) = jsonwebtoken::decode::<Claims>(token, &decoding_key, &validation) {
            if data.claims.sub == config.user_id {
                return Some(data.claims.sub);
            }
        }
    }
    None
}

#[derive(Clone, Debug)]
pub struct AuthContext {
    pub user_id: String,
    /// If the token came from a query param, this is the raw JWT — set as a
    /// session cookie on the response.
    pub session_token: Option<String>,
}

fn extract_token_from_request(req: &Request) -> Option<(String, bool)> {
    // (token, came_from_query)

    // Bearer header
    if let Some(auth) = req.headers().get(header::AUTHORIZATION) {
        if let Ok(s) = auth.to_str() {
            if let Some(tok) = s.strip_prefix("Bearer ").or_else(|| s.strip_prefix("bearer ")) {
                return Some((tok.to_string(), false));
            }
        }
    }

    // Query params: ?jwt= or ?token=
    if let Some(q) = req.uri().query() {
        for pair in q.split('&') {
            let mut it = pair.splitn(2, '=');
            let k = it.next().unwrap_or("");
            let v = it.next().unwrap_or("");
            if k == "jwt" || k == "token" {
                let decoded = percent_decode(v);
                return Some((decoded, true));
            }
        }
    }

    // Cookie: session=
    if let Some(c) = req.headers().get(header::COOKIE) {
        if let Ok(s) = c.to_str() {
            for part in s.split(';') {
                let part = part.trim();
                if let Some(v) = part.strip_prefix("session=") {
                    return Some((percent_decode(v), false));
                }
            }
        }
    }

    None
}

fn percent_decode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        let b = bytes[i];
        if b == b'%' && i + 2 < bytes.len() {
            if let (Some(h), Some(l)) = (hex(bytes[i + 1]), hex(bytes[i + 2])) {
                out.push((h * 16 + l) as char);
                i += 3;
                continue;
            }
        } else if b == b'+' {
            out.push(' ');
            i += 1;
            continue;
        }
        out.push(b as char);
        i += 1;
    }
    out
}

fn hex(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}

pub async fn auth_middleware(
    State(state): State<AppState>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let Some((token, from_query)) = extract_token_from_request(&req) else {
        return Err(StatusCode::UNAUTHORIZED);
    };
    let Some(user_id) = verify_jwt(&token, &state.jwks_cache, &state.http_client, &state.config)
        .await
    else {
        return Err(StatusCode::UNAUTHORIZED);
    };

    let ctx = AuthContext {
        user_id,
        session_token: if from_query { Some(token) } else { None },
    };
    let session_token = ctx.session_token.clone();
    req.extensions_mut().insert(ctx);

    let mut resp = next.run(req).await;

    // If the token came from a query param, persist it as a session cookie.
    if let Some(tok) = session_token {
        if let Ok(value) = HeaderValue::from_str(&format!(
            "session={}; HttpOnly; SameSite=None; Secure; Path=/",
            url_encode(&tok)
        )) {
            resp.headers_mut().append(header::SET_COOKIE, value);
        }
    }

    Ok(resp)
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
