"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
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
        ws.send(JSON.stringify({ type: "req", id: "hist-" + Date.now(), method: "chat.history", params: {} }));
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
                  content: m.content,
                  timestamp: m.timestamp ?? Date.now(),
                }))
              );
            }
            return;
          }

          // OpenClaw server-push events
          if (data.type === "event") {
            const evt = data.event;
            const p = data.payload;

            if (evt === "chat.message" || evt === "agent.message") {
              setMessages((prev) => [
                ...prev,
                {
                  id: p.id ?? crypto.randomUUID(),
                  role: p.role ?? "assistant",
                  content: p.content ?? p.text ?? "",
                  timestamp: p.timestamp ?? Date.now(),
                },
              ]);
            } else if (evt === "chat.stream" || evt === "agent.stream") {
              setMessages((prev) => {
                const streamId = p.id ?? data.id;
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && last.id === streamId) {
                  return [
                    ...prev.slice(0, -1),
                    { ...last, content: last.content + (p.delta ?? p.text ?? "") },
                  ];
                }
                return [
                  ...prev,
                  {
                    id: streamId ?? crypto.randomUUID(),
                    role: "assistant",
                    content: p.delta ?? p.text ?? "",
                    timestamp: Date.now(),
                  },
                ];
              });
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
          params: { content },
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
