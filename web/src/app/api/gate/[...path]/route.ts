import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-server';

const GATE_URL = process.env.GATE_URL;

// How many seconds before a JWT's `exp` claim we consider it stale and
// evict it from the cache.  60 s gives Gate time to validate before the
// token actually expires.
const JWT_EXPIRY_SKEW_SECONDS = 60;

// ── Per-user JWT cache ────────────────────────────────────────────────────────
//
// Module-level Map — survives across requests in the same Node.js process.
// Key:   Neon Auth user ID  (never a session token or JWT)
// Value: { token, expiresAt }  where expiresAt is already skew-adjusted
//
// Cache is keyed by user ID so different users never share tokens.
// The cache is process-local: in a multi-replica deployment each replica
// maintains its own map, which is fine — the worst case is a single extra
// /token round-trip after a cold start or failover.

interface CachedToken {
  token: string;
  /** Unix timestamp (ms) after which the entry must not be used. */
  expiresAt: number;
}

const jwtCache = new Map<string, CachedToken>();

/**
 * Decode the `exp` claim from a JWT without verifying the signature.
 * Returns null if the token is malformed or has no `exp`.
 */
function decodeExp(jwt: string): number | null {
  try {
    const payload = jwt.split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof json.exp === 'number' ? json.exp : null;
  } catch {
    return null;
  }
}

/**
 * Return a cached JWT for `userId` if one exists and is still fresh,
 * otherwise fetch a new one from Neon Auth, cache it, and return it.
 * Returns null (with an error logged) when the token endpoint fails.
 */
async function getJwt(userId: string): Promise<string | null> {
  const now = Date.now();
  const cached = jwtCache.get(userId);

  if (cached && cached.expiresAt > now) {
    return cached.token;
  }

  // Cache miss (or stale) — fetch a fresh JWT.
  const { data: tokenData, error: tokenError } = await auth.token();

  if (tokenError || !tokenData?.token) {
    console.error('[gate-proxy] Failed to obtain JWT from Neon Auth:', tokenError);
    return null;
  }

  const token = tokenData.token;
  const exp = decodeExp(token);

  if (exp !== null) {
    // Cache until (exp - skew), expressed in milliseconds.
    const expiresAt = (exp - JWT_EXPIRY_SKEW_SECONDS) * 1000;
    // Only cache if the skew-adjusted expiry is still in the future.
    if (expiresAt > now) {
      jwtCache.set(userId, { token, expiresAt });
    }
  }
  // If exp is null or already past the skew window we still use the token
  // for this request — we just don't cache it.

  return token;
}

// ── Headers ───────────────────────────────────────────────────────────────────

// Headers from the client request that are safe to forward to Gate.
// Notably excludes Cookie (we never forward raw session cookies to Gate)
// and Host (which must match Gate's expected host).
const FORWARDED_REQUEST_HEADERS = [
  'accept',
  'accept-encoding',
  'accept-language',
  'content-type',
  'x-request-id',
];

// Headers from Gate's response that are safe to return to the browser.
// Excludes Set-Cookie (Gate has no auth cookies to set on the browser)
// and any internal/hop-by-hop headers.
const FORWARDED_RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'cache-control',
  'x-request-id',
];

// ── Proxy core ────────────────────────────────────────────────────────────────

/**
 * Send one request to Gate with the supplied JWT.
 *
 * `body` is passed explicitly (rather than read from `request.body`) so that
 * a buffered copy can be replayed on a retry — a ReadableStream can only be
 * consumed once.
 */
async function proxyToGate(
  request: NextRequest,
  upstreamUrl: URL,
  jwt: string,
  body: ArrayBuffer | null,
): Promise<Response> {
  const upstreamHeaders = new Headers();
  upstreamHeaders.set('Authorization', `Bearer ${jwt}`);

  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) upstreamHeaders.set(name, value);
  }

  return fetch(upstreamUrl.toString(), {
    method: request.method,
    headers: upstreamHeaders,
    // null for GET/HEAD/OPTIONS; an ArrayBuffer for methods that carry a body.
    body,
  });
}

// ── Route handler ─────────────────────────────────────────────────────────────

async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  if (!GATE_URL) {
    console.error('[gate-proxy] GATE_URL environment variable is not set');
    return NextResponse.json(
      { error: 'Gateway not configured' },
      { status: 503 },
    );
  }

  // 1. Validate session server-side — auth.getSession() reads the Neon Auth
  //    session cookie from the incoming request headers. Returns null session
  //    when unauthenticated. The middleware already guards /api/**, but we
  //    double-check here for defence-in-depth.
  const { data: sessionData, error: sessionError } = await auth.getSession();

  if (sessionError || !sessionData?.session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = sessionData.user.id;

  // 2. Obtain a JWT for this user — served from the in-process cache when
  //    still fresh, fetched from Neon Auth otherwise.
  let jwt = await getJwt(userId);

  if (!jwt) {
    return NextResponse.json(
      { error: 'Failed to obtain access token' },
      { status: 502 },
    );
  }

  // 3. Build the upstream URL by appending the path segments and forwarding
  //    any query string from the original request.
  const { path } = await params;
  const upstreamPath = path.join('/');
  const upstreamUrl = new URL(upstreamPath, GATE_URL.endsWith('/') ? GATE_URL : `${GATE_URL}/`);
  upstreamUrl.search = new URL(request.url).search;

  // Buffer the request body once so it can be replayed on a retry.
  // GET/HEAD/OPTIONS carry no body — request.arrayBuffer() returns an empty
  // buffer (0 bytes) for those, which we normalise to null.
  const rawBody = request.body ? await request.arrayBuffer() : null;
  const body = rawBody && rawBody.byteLength > 0 ? rawBody : null;

  // 4. Proxy the request to Gate.
  let upstreamResponse: Response;
  try {
    upstreamResponse = await proxyToGate(request, upstreamUrl, jwt, body);
  } catch (err) {
    console.error('[gate-proxy] Network error reaching Gate:', err);
    return NextResponse.json(
      { error: 'Gateway unreachable' },
      { status: 502 },
    );
  }

  // 5. If Gate rejects the token (e.g. revoked before exp), evict the cache
  //    entry, fetch a fresh JWT, and retry once.  The buffered body lets us
  //    replay the request without re-reading the (already consumed) stream.
  if (upstreamResponse.status === 401) {
    jwtCache.delete(userId);

    jwt = await getJwt(userId);

    if (jwt) {
      try {
        upstreamResponse = await proxyToGate(request, upstreamUrl, jwt, body);
      } catch (err) {
        console.error('[gate-proxy] Network error on retry:', err);
        return NextResponse.json(
          { error: 'Gateway unreachable' },
          { status: 502 },
        );
      }
    }
  }

  // 6. Relay Gate's response status, selected headers, and body back to the
  //    browser transparently, without leaking the JWT or GATE_URL.
  const responseHeaders = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstreamResponse.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  return new NextResponse(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
