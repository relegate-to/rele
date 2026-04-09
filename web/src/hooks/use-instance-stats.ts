"use client";

import { useEffect, useRef, useState } from "react";
import { useGateway } from "@/app/console/_context/gateway-context";

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
  const { connected, connecting, error, connect, send, subscribe } = useGateway();

  const [channels,       setChannels]       = useState<ChannelStatus[]>([]);
  const [sessions,       setSessions]       = useState<SessionInfo[]>([]);
  const [recentMessages, setRecentMessages] = useState<DashboardMessage[]>([]);

  // Prevent re-requesting data on every render when already connected.
  const dataRequestedRef = useRef(false);

  // Request all dashboard data once per connection.
  useEffect(() => {
    if (!connected) {
      dataRequestedRef.current = false;
      return;
    }
    if (dataRequestedRef.current) return;
    dataRequestedRef.current = true;

    send({ type: "req", id: "stats-channels", method: "channels.status" });
    send({ type: "req", id: "stats-sessions", method: "sessions.list" });
    send({ type: "req", id: "stats-history",  method: "chat.history", params: { sessionKey: "agent:main:main" } });
  }, [connected, send]);

  // Subscribe to gateway messages.
  useEffect(() => {
    return subscribe((raw) => {
      const data = raw as Record<string, unknown>;

      if (data.type === "res" && typeof data.id === "string" && data.id.startsWith("stats-")) {
        const method = (data.id as string).slice("stats-".length);
        if (!data.ok) return;

        if (method === "channels") {
          setChannels(parseChannels(data.payload));
        } else if (method === "sessions") {
          setSessions(parseSessions(data.payload));
        } else if (method === "history") {
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

      // Live chat events — append latest assistant message.
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
    });
  }, [subscribe]);

  return {
    gatewayConnected:  connected,
    gatewayConnecting: connecting,
    channels,
    sessions,
    recentMessages,
    error,
    connect,
  };
}
