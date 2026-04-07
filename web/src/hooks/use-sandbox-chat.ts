"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: number;
  toolName?: string;
  toolMeta?: string;
  toolError?: boolean;
}

function formatArgs(args: unknown): string {
  if (!args || typeof args !== "object") return "";
  const vals = Object.values(args as Record<string, unknown>);
  if (vals.length === 1 && typeof vals[0] === "string") return vals[0];
  if (vals.length > 0) return JSON.stringify(args);
  return "";
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(extractText).join("");
  if (content && typeof content === "object" && "text" in content) {
    return String((content as any).text);
  }
  return "";
}

// 🔒 Deduplicate helper
function dedupe(messages: ChatMessage[]): ChatMessage[] {
  const seen = new Set<string>();
  return messages.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

export function useSandboxChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(async () => {
    // ✅ Prevent duplicate sockets (OPEN or CONNECTING)
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      const res = await fetch("/api/gate/ws-auth");
      if (!res.ok) throw new Error("Failed to get WS auth");

      const { url, token, gatewayToken } = await res.json();

      const ws = new WebSocket(`${url}?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      let authenticated = false;

      ws.onopen = () => {};

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("[OC]", data);

          // --- Handshake ---
          if (!authenticated) {
            if (data.type === "event" && data.event === "connect.challenge") {
              ws.send(
                JSON.stringify({
                  type: "req",
                  id: "rele-connect",
                  method: "connect",
                  params: {
                    minProtocol: 3,
                    maxProtocol: 3,
                    client: {
                      id: "openclaw-control-ui",
                      version: "0.1.0",
                      platform: "web",
                      mode: "webchat",
                    },
                    role: "operator",
                    scopes: ["operator.admin", "operator.read", "operator.write", "operator.approvals", "operator.pairing"],
                    caps: ["tool-events"],
                    auth: { token: gatewayToken },
                    userAgent: navigator.userAgent,
                    locale: navigator.language,
                  },
                })
              );
              return;
            }

            if (data.type === "res" && data.id === "rele-connect") {
              if (data.ok) {
                authenticated = true;
                setConnected(true);
                setConnecting(false);

                ws.send(
                  JSON.stringify({
                    type: "req",
                    id: "hist-" + Date.now(),
                    method: "chat.history",
                    params: { sessionKey: "agent:main:main" },
                  })
                );
              } else {
                ws.close(4401, "Backend auth failed");
              }
              return;
            }
          }

          // --- History response ---
          if (data.type === "res") {
            if (data.ok && data.payload?.messages) {
              // Build toolCallId → { name, meta } map from assistant toolCall blocks
              const toolCallMap: Record<string, { name: string; meta: string }> = {};
              for (const m of data.payload.messages) {
                if (m.role === "assistant" && Array.isArray(m.content)) {
                  for (const block of m.content) {
                    if (block.type === "toolCall" && block.id && block.name) {
                      toolCallMap[block.id] = { name: block.name, meta: formatArgs(block.arguments) };
                    }
                  }
                }
              }

              const history = data.payload.messages.map((m: any, i: number) => {
                const runId = m.runId ?? m.id;
                const baseId = runId
                  ? `run:${runId}`
                  : `hist:${m.timestamp ?? i}-${i}`;

                if (m.role === "toolResult") {
                  const entry = toolCallMap[m.toolCallId];
                  const toolName = entry?.name ?? m.toolCallId ?? "tool";
                  return {
                    id: `tool:${m.toolCallId ?? baseId}`,
                    role: "tool" as const,
                    content: toolName,
                    toolName,
                    toolMeta: entry?.meta ?? "",
                    toolError: m.isError ?? false,
                    timestamp: m.timestamp ?? Date.now(),
                  };
                }

                return {
                  id: baseId,
                  role: m.role,
                  content: extractText(m.content),
                  timestamp: m.timestamp ?? Date.now(),
                };
              });

              setMessages((prev) => dedupe([...prev, ...history]));
            }
            return;
          }

          // --- Tool events ---
          if (data.type === "event" && data.event === "agent") {
            const p = data.payload;
            if (p?.stream === "tool") {
              const d = p.data;
              const chipId = `tool:${d.toolCallId ?? p.runId + ":" + p.seq}`;

              if (d?.phase === "start") {
                setMessages((prev) =>
                  dedupe([
                    ...prev,
                    {
                      id: chipId,
                      role: "tool" as const,
                      content: d.name,
                      toolName: d.name,
                      toolMeta: formatArgs(d.args),
                      toolError: false,
                      timestamp: p.ts ?? Date.now(),
                    },
                  ])
                );
              } else if (d?.phase === "result") {
                setMessages((prev) => {
                  const idx = prev.findIndex((m) => m.id === chipId);
                  if (idx !== -1) {
                    if (!d.isError) return prev;
                    const updated = [...prev];
                    updated[idx] = { ...updated[idx], toolError: true };
                    return updated;
                  }
                  // Chip missing (e.g. reconnect mid-run) — create from result
                  return dedupe([
                    ...prev,
                    {
                      id: chipId,
                      role: "tool" as const,
                      content: d.name,
                      toolName: d.name,
                      toolMeta: d.meta ?? formatArgs(d.args),
                      toolError: d.isError ?? false,
                      timestamp: p.ts ?? Date.now(),
                    },
                  ]);
                });
              }
            }
            return;
          }

          // --- Streaming events ---
          if (data.type === "event" && data.event === "chat") {
            const p = data.payload;
            const runId = p?.runId;

            if (!runId) return;

            const messageId = `run:${runId}`;
            const text = extractText(
              p?.message?.content ?? p?.errorMessage ?? ""
            );

            if (p?.state === "delta" || p?.state === "final") {
              setMessages((prev) => {
                const idx = prev.findIndex((m) => m.id === messageId);

                if (idx !== -1) {
                  const updated = [...prev];
                  updated[idx] = { ...updated[idx], content: text };
                  return updated;
                }

                return dedupe([
                  ...prev,
                  {
                    id: messageId,
                    role: "assistant",
                    content: text,
                    timestamp: Date.now(),
                  },
                ]);
              });
            } else if (p?.state === "error") {
              setMessages((prev) =>
                dedupe([
                  ...prev,
                  {
                    id: `error:${runId}:${Date.now()}`,
                    role: "assistant",
                    content: text || "Agent error",
                    timestamp: Date.now(),
                  },
                ])
              );
            }

            return;
          }
        } catch {
          // ignore non-JSON
        }
      };

      ws.onclose = (event) => {
        setConnected(false);
        setConnecting(false);
        wsRef.current = null;

        if (event.code === 4401) {
          setError("Authentication failed.");
          return;
        }

        if (event.code === 1006) {
          setError("Connection failed — instance may still be starting up.");
          return;
        }
      };

      ws.onerror = () => {
        setConnected(false);
        setConnecting(false);
      };
    } catch {
      setConnecting(false);
      setError("Failed to connect.");
    }
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }, []);

  const sendMessage = useCallback((content: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const id = crypto.randomUUID();

    const msg: ChatMessage = {
      id,
      role: "user",
      content,
      timestamp: Date.now(),
    };

    setMessages((prev) => dedupe([...prev, msg]));

    wsRef.current.send(
      JSON.stringify({
        type: "req",
        id,
        method: "chat.send",
        params: {
          sessionKey: "agent:main:main",
          message: content,
          idempotencyKey: id,
        },
      })
    );
  }, []);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  return { messages, connected, connecting, error, connect, disconnect, sendMessage };
}
