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

  // Get a fresh JWT for the WebSocket connection
  const { data: tokenData, error: tokenError } = await auth.token();
  if (tokenError || !tokenData?.token) {
    return NextResponse.json({ error: "Failed to obtain token" }, { status: 502 });
  }

  // Convert HTTP Gate URL to WebSocket URL
  const wsUrl = GATE_URL.replace(/^http/, "ws").replace(/\/$/, "");

  return NextResponse.json({
    url: `${wsUrl}/machines/connect`,
    token: tokenData.token,
  });
}
