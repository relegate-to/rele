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
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    setConnecting(true);

    try {
      // Get WS auth credentials from the server
      const res = await fetch("/api/gate/ws-auth");
      if (!res.ok) throw new Error("Failed to get WS auth");
      const { url, token } = await res.json();

      const ws = new WebSocket(`${url}?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setConnecting(false);
        // Request chat history
        ws.send(JSON.stringify({ type: "chat.history" }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "chat.history" && Array.isArray(data.messages)) {
            setMessages(
              data.messages.map((m: any, i: number) => ({
                id: m.id ?? `hist-${i}`,
                role: m.role,
                content: m.content,
                timestamp: m.timestamp ?? Date.now(),
              }))
            );
          } else if (data.type === "chat.message") {
            setMessages((prev) => [
              ...prev,
              {
                id: data.id ?? crypto.randomUUID(),
                role: data.role ?? "assistant",
                content: data.content,
                timestamp: data.timestamp ?? Date.now(),
              },
            ]);
          } else if (data.type === "chat.stream") {
            // Streaming token — append to last assistant message or create new
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant" && last.id === data.id) {
                return [
                  ...prev.slice(0, -1),
                  { ...last, content: last.content + data.delta },
                ];
              }
              return [
                ...prev,
                {
                  id: data.id ?? crypto.randomUUID(),
                  role: "assistant",
                  content: data.delta ?? "",
                  timestamp: Date.now(),
                },
              ];
            });
          }
        } catch {
          // Non-JSON message, ignore
        }
      };

      ws.onclose = () => {
        setConnected(false);
        setConnecting(false);
        wsRef.current = null;
      };

      ws.onerror = () => {
        setConnected(false);
        setConnecting(false);
      };
    } catch {
      setConnecting(false);
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
        JSON.stringify({ type: "chat.send", content })
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

  return { messages, connected, connecting, connect, disconnect, sendMessage };
}
