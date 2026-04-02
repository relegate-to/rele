"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChannelStatus {
  id: string;
  label: string;
  connected: boolean;
  status?: string;
  detail?: string;
}

export interface SessionInfo {
  id: string;
  agentId?: string;
  active?: boolean;
}

export interface DashboardMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface InstanceStats {
  gatewayConnected: boolean;
  gatewayConnecting: boolean;
  gatewayLatencyMs: number | null;
  channels: ChannelStatus[];
  sessions: SessionInfo[];
  recentMessages: DashboardMessage[];
  error: string | null;
  connect: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CHANNEL_LABELS: Record<string, string> = {
  telegram: "Telegram",
  discord:  "Discord",
  slack:    "Slack",
  signal:   "Signal",
  whatsapp: "WhatsApp",
  imessage: "iMessage",
  teams:    "Teams",
  matrix:   "Matrix",
  irc:      "IRC",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(extractText).filter(Boolean).join("");
  if (content && typeof content === "object" && "text" in content)
    return String((content as { text: unknown }).text);
  return "";
}

function parseChannels(raw: unknown): ChannelStatus[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return (raw as Record<string, unknown>[]).map((c) => {
      const id = String(c.id ?? c.channel ?? "unknown");
      return {
        id,
        label: CHANNEL_LABELS[id] ?? id,
        connected: Boolean(c.connected ?? c.status === "connected"),
        status: c.status != null ? String(c.status) : undefined,
        detail: (c.detail ?? c.username ?? c.name) != null
          ? String(c.detail ?? c.username ?? c.name)
          : undefined,
      };
    });
  }
  if (typeof raw === "object") {
    return Object.entries(raw as Record<string, Record<string, unknown>>).map(([id, val]) => ({
      id,
      label: CHANNEL_LABELS[id] ?? id,
      connected: Boolean(val?.connected ?? val?.status === "connected"),
      status: val?.status != null ? String(val.status) : undefined,
      detail: (val?.detail ?? val?.username ?? val?.name) != null
        ? String(val?.detail ?? val?.username ?? val?.name)
        : undefined,
    }));
  }
  return [];
}

function parseSessions(raw: unknown): SessionInfo[] {
  const arr: unknown[] = Array.isArray(raw)
    ? raw
    : raw != null && typeof raw === "object" && "sessions" in raw
      ? (raw as { sessions: unknown[] }).sessions
      : [];
  return arr.map((s) => {
    const m = s as Record<string, unknown>;
    return {
      id:      String(m.id ?? m.sessionKey ?? ""),
      agentId: m.agentId != null ? String(m.agentId) : m.agent != null ? String(m.agent) : undefined,
      active:  m.active !== undefined ? Boolean(m.active) : true,
    };
  });
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useInstanceStats(): InstanceStats {
  const [gatewayConnected,  setGatewayConnected]  = useState(false);
  const [gatewayConnecting, setGatewayConnecting] = useState(false);
  const [gatewayLatencyMs,  setGatewayLatencyMs]  = useState<number | null>(null);
  const [channels,          setChannels]          = useState<ChannelStatus[]>([]);
  const [sessions,          setSessions]          = useState<SessionInfo[]>([]);
  const [recentMessages,    setRecentMessages]    = useState<DashboardMessage[]>([]);
  const [error,             setError]             = useState<string | null>(null);

  const wsRef           = useRef<WebSocket | null>(null);
  const connectStartRef = useRef<number>(0);

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Already connected — just re-request data
      const ws = wsRef.current;
      const send = (method: string, params: Record<string, unknown> = {}) =>
        ws.send(JSON.stringify({ type: "req", id: `dash-${method}`, method, params }));
      send("channels.status");
      send("sessions.list");
      send("chat.history", { sessionKey: "agent:main:main" });
      return;
    }

    setGatewayConnecting(true);
    setError(null);
    connectStartRef.current = performance.now();

    let url: string, token: string, gatewayToken: string;
    try {
      const res = await fetch("/api/gate/ws-auth");
      if (!res.ok) throw new Error("Instance not reachable");
      ({ url, token, gatewayToken } = await res.json());
    } catch (e) {
      setGatewayConnecting(false);
      setError(e instanceof Error ? e.message : "Connection failed");
      return;
    }

    const ws = new WebSocket(`${url}?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;
    let authenticated = false;

    ws.onopen = () => {
      // waiting for connect.challenge
    };

    ws.onmessage = (event) => {
      let data: Record<string, unknown>;
      try { data = JSON.parse(event.data as string); }
      catch { return; }

      console.log("[dash]", data);

      // ── Handshake ────────────────────────────────────────────────────────
      if (!authenticated) {
        if (data.type === "event" && data.event === "connect.challenge") {
          ws.send(JSON.stringify({
            type: "req",
            id: "dash-connect",
            method: "connect",
            params: {
              minProtocol: 3, maxProtocol: 3,
              client: { id: "openclaw-control-ui", version: "0.1.0", platform: "web", mode: "webchat" },
              role: "operator",
              scopes: ["operator.read", "operator.write"],
              caps: [], commands: [], permissions: {},
              auth: { token: gatewayToken },
            },
          }));
          return;
        }
        if (data.type === "res" && data.id === "dash-connect") {
          if (data.ok) {
            authenticated = true;
            setGatewayLatencyMs(Math.round(performance.now() - connectStartRef.current));
            setGatewayConnected(true);
            setGatewayConnecting(false);
            // Fetch all dashboard data
            const send = (method: string, params: Record<string, unknown> = {}) =>
              ws.send(JSON.stringify({ type: "req", id: `dash-${method}`, method, params }));
            send("channels.status");
            send("sessions.list");
            send("chat.history", { sessionKey: "agent:main:main" });
          } else {
            setGatewayConnecting(false);
            setError("Authentication failed");
            ws.close(4401, "Auth failed");
          }
          return;
        }
        return;
      }

      // ── Batch responses ──────────────────────────────────────────────────
      if (data.type === "res" && typeof data.id === "string" && data.id.startsWith("dash-")) {
        const method = (data.id as string).slice("dash-".length);
        if (!data.ok) return;

        if (method === "channels.status") {
          setChannels(parseChannels(data.payload));
        } else if (method === "sessions.list") {
          setSessions(parseSessions(data.payload));
        } else if (method === "chat.history") {
          const raw = data.payload as Record<string, unknown>;
          const msgs = (raw?.messages ?? []) as Record<string, unknown>[];
          setRecentMessages(
            msgs.slice(-8).map((m, i) => ({
              id:        m.id != null ? String(m.id) : `msg-${i}`,
              role:      m.role === "user" ? "user" : "assistant",
              content:   extractText(m.content),
              timestamp: m.timestamp != null ? Number(m.timestamp) : Date.now(),
            }))
          );
        }
        return;
      }

      // ── Live chat events ─────────────────────────────────────────────────
      if (data.type === "event" && data.event === "chat") {
        const p = data.payload as Record<string, unknown>;
        if (p?.state === "final" && p?.message) {
          const text = extractText((p.message as Record<string, unknown>).content);
          if (text) {
            setRecentMessages((prev) => [
              ...prev.slice(-7),
              { id: String(p.runId ?? crypto.randomUUID()), role: "assistant", content: text, timestamp: Date.now() },
            ]);
          }
        }
      }
    };

    ws.onclose = (event) => {
      setGatewayConnected(false);
      setGatewayConnecting(false);
      wsRef.current = null;
      if (event.code === 4401) setError("Authentication failed");
      else if (event.code === 1006) setError("Connection closed unexpectedly");
    };

    ws.onerror = () => {
      setGatewayConnected(false);
      setGatewayConnecting(false);
      wsRef.current = null;
    };
  }, []);

  // Cleanup on unmount only — caller decides when to connect
  useEffect(() => {
    return () => { wsRef.current?.close(); };
  }, []);

  return {
    gatewayConnected,
    gatewayConnecting,
    gatewayLatencyMs,
    channels,
    sessions,
    recentMessages,
    error,
    connect,
  };
}
