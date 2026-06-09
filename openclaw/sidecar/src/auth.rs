use std::time::{Duration, Instant};

use axum::extract::{Request, State};
use axum::http::{StatusCode, header};
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
    use std::str::FromStr;
    use jsonwebtoken::jwk::AlgorithmParameters;
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
        // Pin the validation algorithm to what the JWK says, not what the token
        // header claims. Without this an attacker can request a symmetric alg
        // (HS256) and try to forge a signature against the public-key bytes.
        let expected_alg = jwk
            .common
            .key_algorithm
            .and_then(|a| jsonwebtoken::Algorithm::from_str(&a.to_string()).ok());
        let expected_alg = expected_alg.or_else(|| match &jwk.algorithm {
            AlgorithmParameters::RSA(_) => Some(jsonwebtoken::Algorithm::RS256),
            AlgorithmParameters::EllipticCurve(_) => Some(jsonwebtoken::Algorithm::ES256),
            AlgorithmParameters::OctetKeyPair(_) => Some(jsonwebtoken::Algorithm::EdDSA),
            // Symmetric keys (oct) are rejected — JWKS for our IdP should
            // never publish them, and accepting one would invite alg-confusion
            // forgery.
            _ => None,
        });
        let Some(expected_alg) = expected_alg else {
            continue;
        };
        if header.alg != expected_alg {
            continue;
        }

        let Ok(decoding_key) = jsonwebtoken::DecodingKey::from_jwk(jwk) else {
            continue;
        };
        let mut validation = jsonwebtoken::Validation::new(expected_alg);
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
    #[allow(dead_code)] // surfaced in Debug logs; not otherwise read
    pub user_id: String,
}

fn extract_token_from_request(req: &Request) -> Option<String> {
    // Bearer header
    if let Some(auth) = req.headers().get(header::AUTHORIZATION) {
        if let Ok(s) = auth.to_str() {
            if let Some(tok) = s.strip_prefix("Bearer ").or_else(|| s.strip_prefix("bearer ")) {
                return Some(tok.to_string());
            }
        }
    }

    // WebSocket subprotocol smuggling: `Sec-WebSocket-Protocol: bearer, <jwt>`.
    // Browsers don't let us set custom headers on `new WebSocket(...)`, but
    // they do let us pass subprotocols. Token follows the literal "bearer"
    // entry. The ws_middleware strips this header before forwarding upstream
    // and echoes back only "bearer" so the token never appears in responses.
    if let Some(p) = req.headers().get("sec-websocket-protocol") {
        if let Ok(s) = p.to_str() {
            let parts: Vec<&str> = s.split(',').map(|p| p.trim()).collect();
            if let Some(i) = parts.iter().position(|p| *p == "bearer") {
                if let Some(tok) = parts.get(i + 1) {
                    if !tok.is_empty() {
                        return Some((*tok).to_string());
                    }
                }
            }
        }
    }

    // Cookie: session= (set by /__auth__/exchange)
    if let Some(c) = req.headers().get(header::COOKIE) {
        if let Ok(s) = c.to_str() {
            for part in s.split(';') {
                let part = part.trim();
                if let Some(v) = part.strip_prefix("session=") {
                    return Some(percent_decode(v));
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
    let Some(token) = extract_token_from_request(&req) else {
        return Err(StatusCode::UNAUTHORIZED);
    };
    let Some(user_id) = verify_jwt(&token, &state.jwks_cache, &state.http_client, &state.config)
        .await
    else {
        return Err(StatusCode::UNAUTHORIZED);
    };

    req.extensions_mut().insert(AuthContext { user_id });
    Ok(next.run(req).await)
}
