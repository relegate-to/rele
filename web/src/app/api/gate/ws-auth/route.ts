import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-server";

const GATE_URL = process.env.GATE_URL;

// SECURITY TRADEOFF: this endpoint is the one place where we deliberately
// hand the Neon Auth JWT to client-side JS. Browser WebSocket APIs can't
// read HttpOnly cookies, so a direct ws:// connection from the client
// requires the token in a place JS can reach. The other /api proxies route
// through the server and never expose tokens — this one inverts that
// posture by necessity. Tokens MUST be short-lived; a CSP that constrains
// script sources reduces XSS exposure.

export async function GET() {
  if (!GATE_URL) {
    return NextResponse.json({ error: "Gateway not configured" }, { status: 503 });
  }

  const { data: sessionData, error: sessionError } = await auth.getSession();
  if (sessionError || !sessionData?.session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get a fresh JWT for the direct instance connection
  const { data: tokenData, error: tokenError } = await auth.token();
  if (tokenError || !tokenData?.token) {
    return NextResponse.json({ error: "Failed to obtain token" }, { status: 502 });
  }

  // Fetch connection info from Gate (instance URL + gateway token)
  const res = await fetch(`${GATE_URL}/machines/connect-info`, {
    headers: { Authorization: `Bearer ${tokenData.token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to get connection info" }));
    return NextResponse.json(err, { status: res.status });
  }

  const { url } = await res.json();

  return NextResponse.json({
    url,
    token: tokenData.token,
  });
}
