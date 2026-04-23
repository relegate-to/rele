"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useGateway } from "@/app/console/_context/gateway-context";
import {
  type ChatMessage,
  parseHistoryMessages,
  parseToolEvent,
  parseChatEvent,
  HIDDEN_START,
  HIDDEN_END,
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

export const SESSION_KEY = "agent:main:main";

export function useSandboxChat(sessionKey: string = SESSION_KEY) {
  const { connected, connecting, error, connect, send, subscribe } = useGateway();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [currentModel, setCurrentModel] = useState<string | null>(null);

  // Current segment index per runId. Increments on each tool result so the
  // next assistant stream event creates a fresh bubble.
  const segCounterRef = useRef<Record<string, number>>({});
  // ID of the last assistant bubble we created/updated, for lifecycle:end.
  const currentStreamIdRef = useRef<string | null>(null);
  // Track which session key we last requested history for.
  const lastHistoryKeyRef = useRef<string | null>(null);

  // Reset state when session key changes.
  useEffect(() => {
    setMessages([]);
    setIsThinking(false);
    segCounterRef.current = {};
    currentStreamIdRef.current = null;
    lastHistoryKeyRef.current = null;
  }, [sessionKey]);

  // Request chat history once per connection per session key.
  useEffect(() => {
    if (!connected) {
      lastHistoryKeyRef.current = null;
      return;
    }
    if (lastHistoryKeyRef.current === sessionKey) return;
    lastHistoryKeyRef.current = sessionKey;
    send({
      type: "req",
      id: "chat-hist-" + Date.now(),
      method: "chat.history",
      params: { sessionKey },
    });
  }, [connected, send, sessionKey]);

  // Subscribe to gateway messages and route them.
  useEffect(() => {
    return subscribe((raw) => {
      const data = raw as Record<string, unknown>;

      // History response
      if (
        data.type === "res" &&
        typeof data.id === "string" &&
        data.id.startsWith("chat-hist-")
      ) {
        const payload = data.payload as Record<string, unknown> | undefined;
        if (data.ok && payload?.messages) {
          const history = parseHistoryMessages(
            payload.messages as unknown[]
          );
          // History takes priority over any stale in-memory state (e.g. a
          // streaming bubble that never got a lifecycle:end due to disconnect).
          setMessages((prev) => dedupe([...history, ...prev]));
        }
        return;
      }

      if (data.type === "event" && data.event === "agent") {
        const payload = data.payload as Record<string, unknown>;
        const stream = payload?.stream;

        if (stream === "assistant") {
          // Handles stream:"assistant" agent events.
          // data.text is the segment-local cumulative text (resets after each
          // tool call), so we use segment counters to give each segment its own bubble.
          const runId = payload.runId as string | undefined;
          const text = (payload.data as Record<string, unknown> | undefined)?.text;
          if (!runId || !text) return;

          const seg = segCounterRef.current[runId] ?? 0;
          const messageId = `run:${runId}:${seg}`;
          currentStreamIdRef.current = messageId;
          setIsThinking(false);

          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === messageId);
            if (idx !== -1) {
              const updated = [...prev];
              updated[idx] = { ...updated[idx], content: text as string, isStreaming: true };
              return updated;
            }
            return [
              ...prev,
              {
                id: messageId,
                role: "assistant" as const,
                content: text as string,
                isStreaming: true,
                timestamp: (payload.ts as number | undefined) ?? Date.now(),
              },
            ];
          });
          return;
        }

        if (stream === "tool") {
          // Tool start: mark the current segment bubble as no longer streaming,
          // then append the chip in arrival order.
          // Tool result: increment the segment counter so the next assistant stream
          // event creates a new bubble.
          const event = parseToolEvent(payload);
          if (!event) return;

          if (event.type === "start") {
            const runId = payload.runId as string | undefined;
            const seg = runId != null ? (segCounterRef.current[runId] ?? 0) : -1;
            const segId = runId != null ? `run:${runId}:${seg}` : null;

            setMessages((prev) => {
              if (prev.some((m) => m.id === event.message.id)) return prev;
              const next = segId
                ? prev.map((m) => (m.id === segId ? { ...m, isStreaming: false } : m))
                : [...prev];
              return [...next, event.message];
            });
          } else {
            const runId = payload.runId as string | undefined;
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
              return [...prev, event.fallback];
            });
          }
          return;
        }

        if (stream === "lifecycle") {
          // Handles stream:"lifecycle" agent events.
          if ((payload.data as Record<string, unknown> | undefined)?.phase !== "end") return;
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
          const runId = payload.runId as string | undefined;
          if (runId != null) delete segCounterRef.current[runId];
          return;
        }
      }

      // Chat events used for error reporting only.
      if (data.type === "event" && data.event === "chat") {
        const event = parseChatEvent(data.payload as Record<string, unknown>);
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
    });
  }, [subscribe]);

  const setModel = useCallback(
    (model: string) => {
      if (!connected) return;
      const resolved = model || null;
      setCurrentModel(resolved);
      send({
        type: "req",
        id: "model-patch-" + Date.now(),
        method: "sessions.patch",
        params: { sessionKey, model: resolved },
      });
    },
    [connected, send, sessionKey]
  );

  const sendMessage = useCallback(
    (content: string, hiddenPrefix?: string) => {
      if (!connected) return;

      const id = crypto.randomUUID();

      setMessages((prev) =>
        dedupe([...prev, { id, role: "user", content, timestamp: Date.now() }])
      );
      setIsThinking(true);

      const gatewayMessage = hiddenPrefix
        ? `${HIDDEN_START}${hiddenPrefix}${HIDDEN_END}\n\n${content}`
        : content;

      send({
        type: "req",
        id,
        method: "chat.send",
        params: {
          sessionKey,
          message: gatewayMessage,
          idempotencyKey: id,
        },
      });
    },
    [connected, send, sessionKey]
  );

  return {
    messages,
    connected,
    connecting,
    isThinking,
    error,
    connect,
    sendMessage,
    currentModel,
    setModel,
  };
}
