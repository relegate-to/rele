"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type ChatMessage,
  parseHistoryMessages,
  parseToolEvent,
  parseChatEvent,
} from "./sandbox-chat-protocol";

export type { ChatMessage };

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
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  // Current segment index per runId. Increments on each tool result so the
  // next assistant stream event creates a fresh bubble.
  const segCounterRef = useRef<Record<string, number>>({});
  // ID of the last assistant bubble we created/updated, for lifecycle:end.
  const currentStreamIdRef = useRef<string | null>(null);

  const connect = useCallback(async () => {
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

      function handleHandshake(data: any) {
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
        }
      }

      function handleHistoryResponse(data: any) {
        if (data.ok && data.payload?.messages) {
          const history = parseHistoryMessages(data.payload.messages);
          setMessages((prev) => dedupe([...prev, ...history]));
        }
      }

      // Handles stream:"assistant" agent events.
      // data.text is the segment-local cumulative text (resets after each tool
      // call), so we use segment counters to give each segment its own bubble.
      function handleAssistantStream(payload: any) {
        const runId = payload.runId;
        const text = payload.data?.text;
        if (!runId || !text) return;

        const seg = segCounterRef.current[runId] ?? 0;
        const messageId = `run:${runId}:${seg}`;
        currentStreamIdRef.current = messageId;
        setIsThinking(false);

        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === messageId);
          if (idx !== -1) {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], content: text, isStreaming: true };
            return updated;
          }
          return [
            ...prev,
            {
              id: messageId,
              role: "assistant" as const,
              content: text,
              isStreaming: true,
              timestamp: payload.ts ?? Date.now(),
            },
          ];
        });
      }

      // Handles stream:"tool" agent events.
      // Tool start: mark the current segment bubble as no longer streaming,
      // then append the chip in arrival order.
      // Tool result: increment the segment counter so the next assistant stream
      // event creates a new bubble.
      function handleToolEvent(payload: any) {
        const event = parseToolEvent(payload);
        if (!event) return;

        if (event.type === "start") {
          const runId = payload.runId;
          const seg = runId != null ? (segCounterRef.current[runId] ?? 0) : -1;
          const segId = runId != null ? `run:${runId}:${seg}` : null;

          setMessages((prev) => {
            if (prev.some((m) => m.id === event.message.id)) return prev;
            // Pause the current segment bubble.
            const next = segId
              ? prev.map((m) => (m.id === segId ? { ...m, isStreaming: false } : m))
              : [...prev];
            return [...next, event.message];
          });
        } else {
          // Increment segment counter before the next assistant stream event.
          const runId = payload.runId;
          if (runId != null) {
            segCounterRef.current[runId] = (segCounterRef.current[runId] ?? 0) + 1;
          }

          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === event.chipId);
            if (idx !== -1) {
              if (!event.isError) return prev;
              const updated = [...prev];
              updated[idx] = { ...updated[idx], toolError: true };
              return updated;
            }
            // Chip missing (e.g. reconnect mid-run) — create from fallback.
            return [...prev, event.fallback];
          });
        }
      }

      // Handles stream:"lifecycle" agent events.
      function handleLifecycleEvent(payload: any) {
        if (payload.data?.phase !== "end") return;
        const msgId = currentStreamIdRef.current;
        if (msgId) {
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === msgId);
            if (idx === -1) return prev;
            const updated = [...prev];
            updated[idx] = { ...updated[idx], isStreaming: false };
            return updated;
          });
          currentStreamIdRef.current = null;
        }
        setIsThinking(false);
        const runId = payload.runId;
        if (runId != null) delete segCounterRef.current[runId];
      }

      // Chat events are still used for error reporting. Delta/final are driven
      // by agent stream events instead.
      function handleChatEvent(payload: any) {
        const event = parseChatEvent(payload);
        if (!event || event.state !== "error") return;
        setIsThinking(false);
        setMessages((prev) =>
          dedupe([
            ...prev,
            {
              id: `error:${event.messageId}:${Date.now()}`,
              role: "assistant",
              content: event.text || "Agent error",
              timestamp: Date.now(),
            },
          ])
        );
      }

      ws.onopen = () => {};

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          console.log("[OC]", data);
          if (!authenticated) { handleHandshake(data); return; }
          if (data.type === "res") { handleHistoryResponse(data); return; }
          if (data.type === "event" && data.event === "agent") {
            const stream = data.payload?.stream;
            if (stream === "assistant") { handleAssistantStream(data.payload); return; }
            if (stream === "tool") { handleToolEvent(data.payload); return; }
            if (stream === "lifecycle") { handleLifecycleEvent(data.payload); return; }
            return;
          }
          if (data.type === "event" && data.event === "chat") { handleChatEvent(data.payload); return; }
        } catch {
          // ignore non-JSON
        }
      };

      ws.onclose = (event) => {
        setConnected(false);
        setConnecting(false);
        setIsThinking(false);
        wsRef.current = null;
        if (event.code === 4401) {
          setError("Authentication failed.");
        } else if (event.code === 1006) {
          setError("Connection failed — instance may still be starting up.");
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

    setMessages((prev) =>
      dedupe([...prev, { id, role: "user", content, timestamp: Date.now() }])
    );
    setIsThinking(true);

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
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        wsRef.current?.readyState !== WebSocket.OPEN &&
        wsRef.current?.readyState !== WebSocket.CONNECTING
      ) {
        connect();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      wsRef.current?.close();
    };
  }, [connect]);

  return { messages, connected, connecting, isThinking, error, connect, disconnect, sendMessage };
}
