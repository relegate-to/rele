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

function filterHidden(messages: ChatMessage[]): ChatMessage[] {
  return messages.filter((m) => !(m.role === "assistant" && m.content.trim() === "HEARTBEAT_OK"));
}

export const SESSION_KEY = "agent:main:main";

// Per-session state stored in a ref so background sessions keep accumulating.
interface SessionStore {
  messages: ChatMessage[];
  isThinking: boolean;
  segCounter: Record<string, number>;
  currentStreamId: string | null;
  historyFetched: boolean;
}

function emptyStore(): SessionStore {
  return { messages: [], isThinking: false, segCounter: {}, currentStreamId: null, historyFetched: false };
}

export function useSandboxChat(sessionKey: string = SESSION_KEY) {
  const { connected, connecting, error, connect, send, subscribe } = useGateway();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [currentModel, setCurrentModel] = useState<string | null>(null);

  const storeRef = useRef<Record<string, SessionStore>>({});
  const sessionKeyRef = useRef(sessionKey);
  sessionKeyRef.current = sessionKey;
  const listenersRef = useRef<Map<string, Set<() => void>>>(new Map());

  const getStore = useCallback((key: string): SessionStore => {
    if (!storeRef.current[key]) storeRef.current[key] = emptyStore();
    return storeRef.current[key];
  }, []);

  // Flush active session to React state + notify any observers for the key.
  const flush = useCallback((key: string) => {
    if (key === sessionKeyRef.current) {
      const s = getStore(key);
      setMessages(filterHidden(s.messages));
      setIsThinking(s.isThinking);
    }
    const cbs = listenersRef.current.get(key);
    if (cbs) for (const cb of cbs) cb();
  }, [getStore]);

  // Observe a specific session's store changes (for background sessions).
  const observeSession = useCallback((key: string, cb: () => void) => {
    if (!listenersRef.current.has(key)) listenersRef.current.set(key, new Set());
    listenersRef.current.get(key)!.add(cb);
    return () => { listenersRef.current.get(key)?.delete(cb); };
  }, []);

  const getSessionMessages = useCallback((key: string) => filterHidden(getStore(key).messages), [getStore]);
  const getSessionThinking = useCallback((key: string) => getStore(key).isThinking, [getStore]);

  // When session key changes, sync React state from the store.
  useEffect(() => {
    const s = getStore(sessionKey);
    setMessages(filterHidden(s.messages));
    setIsThinking(s.isThinking);
  }, [sessionKey, getStore]);

  // Request chat history once per connection per session key.
  useEffect(() => {
    if (!connected) {
      // Reset history-fetched flags on disconnect so we re-fetch on reconnect.
      for (const s of Object.values(storeRef.current)) s.historyFetched = false;
      return;
    }
    const store = getStore(sessionKey);
    if (store.historyFetched) return;
    store.historyFetched = true;
    send({
      type: "req",
      id: `chat-hist-${sessionKey}-${Date.now()}`,
      method: "chat.history",
      params: { sessionKey },
    });
  }, [connected, send, sessionKey, getStore]);

  // Subscribe to gateway messages and route them to the correct session store.
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
          // Extract the session key from the request id: "chat-hist-<sessionKey>-<timestamp>"
          const idStr = data.id as string;
          const afterPrefix = idStr.slice("chat-hist-".length);
          const lastDash = afterPrefix.lastIndexOf("-");
          const histKey = lastDash > 0 ? afterPrefix.slice(0, lastDash) : sessionKeyRef.current;

          const store = getStore(histKey);
          const history = parseHistoryMessages(payload.messages as unknown[]);
          store.messages = dedupe([...history, ...store.messages]);
          flush(histKey);
        }
        return;
      }

      if (data.type === "event" && data.event === "agent") {
        const payload = data.payload as Record<string, unknown>;
        const evtKey = (payload?.sessionKey as string) || sessionKeyRef.current;
        const store = getStore(evtKey);
        const stream = payload?.stream;

        if (stream === "assistant") {
          const runId = payload.runId as string | undefined;
          const text = (payload.data as Record<string, unknown> | undefined)?.text;
          if (!runId || !text) return;

          const seg = store.segCounter[runId] ?? 0;
          const messageId = `run:${runId}:${seg}`;
          store.currentStreamId = messageId;
          store.isThinking = false;

          const idx = store.messages.findIndex((m) => m.id === messageId);
          if (idx !== -1) {
            store.messages[idx] = { ...store.messages[idx], content: text as string, isStreaming: true };
          } else {
            store.messages.push({
              id: messageId,
              role: "assistant" as const,
              content: text as string,
              isStreaming: true,
              timestamp: (payload.ts as number | undefined) ?? Date.now(),
            });
          }
          flush(evtKey);
          return;
        }

        if (stream === "tool") {
          const event = parseToolEvent(payload);
          if (!event) return;

          if (event.type === "start") {
            const runId = payload.runId as string | undefined;
            const seg = runId != null ? (store.segCounter[runId] ?? 0) : -1;
            const segId = runId != null ? `run:${runId}:${seg}` : null;

            if (!store.messages.some((m) => m.id === event.message.id)) {
              if (segId) {
                store.messages = store.messages.map((m) =>
                  m.id === segId ? { ...m, isStreaming: false } : m
                );
              }
              store.messages.push(event.message);
            }
          } else {
            const runId = payload.runId as string | undefined;
            if (runId != null) {
              store.segCounter[runId] = (store.segCounter[runId] ?? 0) + 1;
            }

            const idx = store.messages.findIndex((m) => m.id === event.chipId);
            if (idx !== -1) {
              if (event.isError) {
                store.messages[idx] = { ...store.messages[idx], toolError: true };
              }
            } else {
              store.messages.push(event.fallback);
            }
          }
          flush(evtKey);
          return;
        }

        if (stream === "lifecycle") {
          if ((payload.data as Record<string, unknown> | undefined)?.phase !== "end") return;
          const msgId = store.currentStreamId;
          if (msgId) {
            const idx = store.messages.findIndex((m) => m.id === msgId);
            if (idx !== -1) {
              store.messages[idx] = { ...store.messages[idx], isStreaming: false };
            }
            store.currentStreamId = null;
          }
          store.isThinking = false;
          const runId = payload.runId as string | undefined;
          if (runId != null) delete store.segCounter[runId];
          flush(evtKey);
          return;
        }
      }

      // Chat events used for error reporting only.
      if (data.type === "event" && data.event === "chat") {
        const chatPayload = data.payload as Record<string, unknown>;
        const evtKey = (chatPayload?.sessionKey as string) || sessionKeyRef.current;
        const store = getStore(evtKey);
        const event = parseChatEvent(chatPayload);
        if (!event || event.state !== "error") return;
        store.isThinking = false;
        store.messages = dedupe([
          ...store.messages,
          {
            id: `error:${event.messageId}:${Date.now()}`,
            role: "assistant",
            content: event.text || "Agent error",
            timestamp: Date.now(),
          },
        ]);
        flush(evtKey);
      }
    });
  }, [subscribe, getStore, flush]);

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
      const store = getStore(sessionKey);

      store.messages = dedupe([...store.messages, { id, role: "user", content, timestamp: Date.now() }]);
      store.isThinking = true;
      flush(sessionKey);

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
    [connected, send, sessionKey, getStore, flush]
  );

  const sendToSession = useCallback(
    (targetKey: string, content: string, hiddenPrefix?: string) => {
      if (!connected) return;

      const id = crypto.randomUUID();
      const store = getStore(targetKey);

      store.messages = dedupe([...store.messages, { id, role: "user", content, timestamp: Date.now() }]);
      store.isThinking = true;
      flush(targetKey);

      const gatewayMessage = hiddenPrefix
        ? `${HIDDEN_START}${hiddenPrefix}${HIDDEN_END}\n\n${content}`
        : content;

      send({
        type: "req",
        id,
        method: "chat.send",
        params: {
          sessionKey: targetKey,
          message: gatewayMessage,
          idempotencyKey: id,
        },
      });
    },
    [connected, send, getStore, flush]
  );

  return {
    messages,
    connected,
    connecting,
    isThinking,
    error,
    connect,
    sendMessage,
    sendToSession,
    observeSession,
    getSessionMessages,
    getSessionThinking,
    currentModel,
    setModel,
  };
}
