import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-server";

const GATE_URL = process.env.GATE_URL;

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

  const { url, gatewayToken } = await res.json();

  return NextResponse.json({
    url,
    token: tokenData.token,
    gatewayToken,
  });
}
