"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

// OpenClaw content can be a string, an object like {type, text}, or an array of such objects
function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(extractText).join("");
  if (content && typeof content === "object" && "text" in content) return String((content as any).text);
  return String(content ?? "");
}

export function useSandboxChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const maxRetries = 5;

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    setConnecting(true);
    setError(null);

    try {
      const res = await fetch("/api/gate/ws-auth");
      if (!res.ok) throw new Error("Failed to get WS auth");
      const { url, token } = await res.json();

      const ws = new WebSocket(`${url}?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setConnecting(false);
        retriesRef.current = 0;
        ws.send(JSON.stringify({ type: "req", id: "hist-" + Date.now(), method: "chat.history", params: { sessionKey: "agent:main:main" } }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("[OC]", data);

          // OpenClaw response to a request
          if (data.type === "res") {
            // Handle chat.send response or chat.history response
            if (data.ok && data.payload?.messages) {
              setMessages(
                data.payload.messages.map((m: any, i: number) => ({
                  id: m.id ?? `hist-${i}`,
                  role: m.role,
                  content: extractText(m.content),
                  timestamp: m.timestamp ?? Date.now(),
                }))
              );
            }
            return;
          }

          // OpenClaw server-push events
          // Chat events: { type:"event", event:"chat", payload: { state, runId, message: { role, content: [{type,text}] } } }
          // States: "delta" (snapshot of message so far), "final" (turn complete), "error", "aborted"
          if (data.type === "event" && data.event === "chat") {
            const p = data.payload;
            const runId = p?.runId ?? "stream";

            if (p?.state === "delta" && p?.message) {
              const text = extractText(p.message.content);
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && last.id === runId) {
                  return [
                    ...prev.slice(0, -1),
                    { ...last, content: text },
                  ];
                }
                return [
                  ...prev,
                  { id: runId, role: "assistant", content: text, timestamp: Date.now() },
                ];
              });
            } else if (p?.state === "final") {
              // Replace streaming message with final content, then reconcile
              if (p?.message) {
                const text = extractText(p.message.content);
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.role === "assistant" && last.id === runId) {
                    return [...prev.slice(0, -1), { ...last, content: text }];
                  }
                  return [...prev, { id: runId, role: "assistant", content: text, timestamp: Date.now() }];
                });
              }
            } else if (p?.state === "error") {
              setMessages((prev) => [
                ...prev,
                { id: crypto.randomUUID(), role: "assistant", content: extractText(p.errorMessage ?? p.message?.content ?? "Agent error"), timestamp: Date.now() },
              ]);
            }
            return;
          }
        } catch {
          // Non-JSON message, ignore
        }
      };

      ws.onclose = (event) => {
        setConnected(false);
        setConnecting(false);
        wsRef.current = null;

        // Don't retry on explicit error codes
        if (event.code === 4502) {
          setError("Agent unreachable — it may still be starting up.");
          return;
        }
        if (event.code === 4404) {
          setError("No running instance found.");
          return;
        }
        if (event.code === 4401) {
          setError("Authentication failed.");
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

  const sendMessage = useCallback(
    (content: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      const msg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, msg]);
      wsRef.current.send(
        JSON.stringify({
          type: "req",
          id: msg.id,
          method: "chat.send",
          params: {
            sessionKey: "agent:main:main",
            message: content,
            idempotencyKey: msg.id,
          },
        })
      );
    },
    []
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  return { messages, connected, connecting, error, connect, disconnect, sendMessage };
}
