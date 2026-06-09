"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useGateway } from "@/app/console/_context/gateway-context";
import {
  type ChatMessage,
  parseHistoryMessages,
  parseToolEvent,
  parseChatEvent,
  stripHiddenPrefix,
  stripUserContextPrefix,
  HIDDEN_START,
  HIDDEN_END,
} from "./sandbox-chat-protocol";

function promptReplyIdFromHiddenPrefix(hiddenPrefix?: string): string | undefined {
  if (!hiddenPrefix) return undefined;
  const m = hiddenPrefix.match(/^prompt-reply\s+id=([\w.-]+)/);
  return m ? m[1] : undefined;
}

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
  // Ground truth for isThinking: set when we send (or see res status=started),
  // cleared when chat event with state=final/error arrives for this runId.
  // Stale finals for older runs are ignored.
  activeRunId: string | null;
  // /compact has no completion event — after the user sends it we poll on
  // tick/cron until the server history grows a newer compaction marker.
  pendingCompactRefresh: boolean;
  lastCompactionTs: number;
}

function emptyStore(): SessionStore {
  return {
    messages: [],
    isThinking: false,
    segCounter: {},
    currentStreamId: null,
    historyFetched: false,
    activeRunId: null,
    pendingCompactRefresh: false,
    lastCompactionTs: 0,
  };
}

function maxCompactionTs(messages: ChatMessage[]): number {
  let ts = 0;
  for (const m of messages) {
    if (m.role === "system" && m.systemKind === "compaction" && m.timestamp > ts) {
      ts = m.timestamp;
    }
  }
  return ts;
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
  // chat-history request ids that should replace (not merge) local messages.
  const pendingReplaceRef = useRef<Set<string>>(new Set());

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

  const refreshHistory = useCallback((key?: string) => {
    const target = key ?? sessionKeyRef.current;
    send({
      type: "req",
      id: `chat-hist-${target}-${Date.now()}`,
      method: "chat.history",
      params: { sessionKey: target },
    });
  }, [send]);

  const clearMessages = useCallback((key?: string) => {
    const target = key ?? sessionKeyRef.current;
    const s = getStore(target);
    s.messages = [];
    s.isThinking = false;
    s.currentStreamId = null;
    s.historyFetched = false;
    s.activeRunId = null;
    s.pendingCompactRefresh = false;
    s.lastCompactionTs = 0;
    flush(target);
  }, [getStore, flush]);

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

      // Run started confirmation: res { ok, payload: { runId, status: "started" } }.
      // This is the ground-truth signal that the agent has begun thinking.
      if (data.type === "res" && data.ok) {
        const payload = data.payload as { runId?: string; status?: string } | undefined;
        if (payload?.runId && payload.status === "started") {
          for (const [key, store] of Object.entries(storeRef.current)) {
            if (store.activeRunId === payload.runId) {
              store.isThinking = true;
              flush(key);
              break;
            }
          }
        }
      }

      // History response
      if (
        data.type === "res" &&
        typeof data.id === "string" &&
        data.id.startsWith("chat-hist-")
      ) {
        const payload = data.payload as Record<string, unknown> | undefined;
        const idStr = data.id as string;
        const isReplace = pendingReplaceRef.current.delete(idStr);
        if (data.ok && payload?.messages) {
          // Extract the session key from the request id: "chat-hist-<sessionKey>-<timestamp>"
          const afterPrefix = idStr.slice("chat-hist-".length);
          const lastDash = afterPrefix.lastIndexOf("-");
          const histKey = lastDash > 0 ? afterPrefix.slice(0, lastDash) : sessionKeyRef.current;

          const store = getStore(histKey);
          const history = parseHistoryMessages(payload.messages as unknown[]);

          // Post-/compact poll: only adopt the server view once it shows a
          // compaction newer than what we've seen — otherwise the work hasn't
          // landed yet and we just keep polling on the next tick/cron.
          if (isReplace) {
            const ts = maxCompactionTs(history);
            if (ts > store.lastCompactionTs) {
              store.messages = history.sort((a, b) => a.timestamp - b.timestamp);
              store.lastCompactionTs = ts;
              store.pendingCompactRefresh = false;
              store.isThinking = false;
              flush(histKey);
            }
            return;
          }

          // History entries can carry different ids than the live stream
          // (history uses `hist:` or `run:<runId>`, stream uses
          // `run:<runId>:<seg>`) and user entries may pick up a `System:`
          // wrapper after compaction. Dedupe by displayable content — but
          // count-based, so re-running the same command (e.g. /usage twice
          // returning identical text) doesn't drop the second response.
          const userKey = (s: string) =>
            stripUserContextPrefix(stripHiddenPrefix(s)).trim();
          const remaining = new Map<string, number>();
          const bump = (key: string) =>
            remaining.set(key, (remaining.get(key) ?? 0) + 1);
          for (const m of store.messages) {
            if (m.role === "assistant") bump(`a:${m.content.trim()}`);
            else if (m.role === "user") bump(`u:${userKey(m.content)}`);
          }
          const filteredHistory = history.filter((m) => {
            const key =
              m.role === "assistant" ? `a:${m.content.trim()}`
              : m.role === "user" ? `u:${userKey(m.content)}`
              : null;
            if (!key) return true;
            const count = remaining.get(key) ?? 0;
            if (count > 0) {
              remaining.set(key, count - 1);
              return false;
            }
            return true;
          });

          store.messages = dedupe([...filteredHistory, ...store.messages])
            .sort((a, b) => a.timestamp - b.timestamp);
          const ts = maxCompactionTs(history);
          if (ts > store.lastCompactionTs) store.lastCompactionTs = ts;
          flush(histKey);
        }
        return;
      }

      // tick / cron events are our polling clock for compactions that have no
      // completion event — refetch history on each tick while a /compact is
      // pending; the response handler decides whether to adopt it.
      if (
        data.type === "event" &&
        (data.event === "tick" || data.event === "cron")
      ) {
        for (const [key, store] of Object.entries(storeRef.current)) {
          if (!store.pendingCompactRefresh) continue;
          const reqId = `chat-hist-${key}-${Date.now()}`;
          pendingReplaceRef.current.add(reqId);
          send({
            type: "req",
            id: reqId,
            method: "chat.history",
            params: { sessionKey: key },
          });
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
          // isThinking is no longer driven from lifecycle — `res status=started`
          // and chat `state=final` are the ground truth. We still use phase=end
          // to clean up the streaming flag on the last segment.
          const phase = (payload.data as Record<string, unknown> | undefined)?.phase;
          if (phase !== "end") return;
          const msgId = store.currentStreamId;
          if (msgId) {
            const idx = store.messages.findIndex((m) => m.id === msgId);
            if (idx !== -1) {
              store.messages[idx] = { ...store.messages[idx], isStreaming: false };
            }
            store.currentStreamId = null;
          }
          const runId = payload.runId as string | undefined;
          if (runId != null) delete store.segCounter[runId];
          flush(evtKey);
          return;
        }
      }

      // Chat events: full entries (gateway-injected messages like /status,
      // /compact summaries) AND streaming error reports.
      if (data.type === "event" && data.event === "chat") {
        const chatPayload = data.payload as Record<string, unknown>;
        const evtKey = (chatPayload?.sessionKey as string) || sessionKeyRef.current;
        const store = getStore(evtKey);

        const entry = chatPayload?.entry as unknown;
        if (entry) {
          const parsed = parseHistoryMessages([entry]);
          if (parsed.length > 0) {
            store.messages = dedupe([...store.messages, ...parsed]);
            flush(evtKey);
          }
          return;
        }

        const event = parseChatEvent(chatPayload);
        if (!event) return;
        const runId = chatPayload?.runId as string | undefined;
        const isActiveRun = runId != null && store.activeRunId === runId;
        if (event.state === "final") {
          if (isActiveRun) {
            store.activeRunId = null;
            // After /compact, the slash command's `final` fires before the
            // compaction itself runs — keep "thinking" true and let the
            // tick/cron poll clear it once the new compaction lands.
            if (!store.pendingCompactRefresh) {
              store.isThinking = false;
            }
            flush(evtKey);
          }
          return;
        }
        if (event.state === "error") {
          if (isActiveRun) {
            store.isThinking = false;
            store.activeRunId = null;
          }
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
      }
    });
  }, [subscribe, getStore, flush, send]);

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

      store.messages = dedupe([...store.messages, { id, role: "user", content, timestamp: Date.now(), promptReplyId: promptReplyIdFromHiddenPrefix(hiddenPrefix) }]);
      store.isThinking = true;
      store.activeRunId = id;
      if (/^\/compact\b/i.test(content.trim())) store.pendingCompactRefresh = true;
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

      store.messages = dedupe([...store.messages, { id, role: "user", content, timestamp: Date.now(), promptReplyId: promptReplyIdFromHiddenPrefix(hiddenPrefix) }]);
      store.isThinking = true;
      store.activeRunId = id;
      if (/^\/compact\b/i.test(content.trim())) store.pendingCompactRefresh = true;
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
    clearMessages,
    refreshHistory,
    currentModel,
    setModel,
  };
}
