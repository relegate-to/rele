import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-server';

const GATE_URL = process.env.GATE_URL;

/** Convert a WebSocket URL to its HTTP equivalent. */
function wsToHttp(url: string): string {
  return url.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://');
}

async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  if (!GATE_URL) {
    return NextResponse.json({ error: 'Gateway not configured' }, { status: 503 });
  }

  const { data: sessionData, error: sessionError } = await auth.getSession();
  if (sessionError || !sessionData?.session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Obtain a JWT to authenticate against the sidecar.
  const { data: tokenData, error: tokenError } = await auth.token();
  if (tokenError || !tokenData?.token) {
    return NextResponse.json({ error: 'Failed to obtain access token' }, { status: 502 });
  }

  const jwt = tokenData.token;

  // Resolve the user's sidecar URL via the gate.
  let instanceHttpUrl: string;
  try {
    const res = await fetch(`${GATE_URL}/machines/connect-info`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to get instance URL' }));
      return NextResponse.json(err, { status: res.status });
    }
    const { url } = await res.json();
    instanceHttpUrl = wsToHttp(url);
  } catch {
    return NextResponse.json({ error: 'Could not reach gate' }, { status: 502 });
  }

  // Build the upstream URL.
  const { path } = await params;
  const upstreamPath = path.join('/');
  const upstreamUrl = new URL(
    upstreamPath,
    instanceHttpUrl.endsWith('/') ? instanceHttpUrl : `${instanceHttpUrl}/`,
  );
  upstreamUrl.search = new URL(request.url).search;

  // Forward a safe subset of request headers.
  const upstreamHeaders = new Headers();
  upstreamHeaders.set('Authorization', `Bearer ${jwt}`);
  for (const name of ['content-type', 'accept']) {
    const value = request.headers.get(name);
    if (value) upstreamHeaders.set(name, value);
  }

  const rawBody = request.body ? await request.arrayBuffer() : null;
  const body = rawBody && rawBody.byteLength > 0 ? rawBody : null;

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl.toString(), {
      method: request.method,
      headers: upstreamHeaders,
      body,
    });
  } catch {
    return NextResponse.json({ error: 'Instance unreachable' }, { status: 502 });
  }

  const responseHeaders = new Headers();
  for (const name of ['content-type', 'content-length', 'cache-control']) {
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
