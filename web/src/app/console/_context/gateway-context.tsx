"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type Listener = (data: unknown) => void;

interface GatewayContextValue {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  send: (msg: object) => void;
  subscribe: (listener: Listener) => () => void;
  rpc: (method: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

const GatewayContext = createContext<GatewayContextValue | null>(null);

export function useGateway(): GatewayContextValue {
  const ctx = useContext(GatewayContext);
  if (!ctx) throw new Error("useGateway must be used inside GatewayProvider");
  return ctx;
}

export function GatewayProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Set<Listener>>(new Set());
  // Set to true once connect() is ever called, so visibility-change can reconnect.
  const hasTriedRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Flips to true after the first successful auth — changes retry strategy.
  const everConnectedRef = useRef(false);
  // Set to true when disconnect() is called explicitly — suppresses auto-retry.
  const intentionalRef = useRef(false);

  const emit = useCallback((data: unknown) => {
    for (const listener of listenersRef.current) {
      listener(data);
    }
  }, []);

  const subscribe = useCallback((listener: Listener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const connect = useCallback(async () => {
    hasTriedRef.current = true;
    intentionalRef.current = false;

    // Clear any pending retry.
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    setConnecting(true);
    setError(null);

    let url: string, token: string, gatewayToken: string;
    try {
      const res = await fetch("/api/gate/ws-auth");
      if (!res.ok) throw new Error("Failed to get WS auth");
      ({ url, token, gatewayToken } = await res.json());
    } catch (e) {
      setConnecting(false);
      setError(e instanceof Error ? e.message : "Failed to connect.");
      // Auth fetch can fail transiently while the instance is starting up.
      // Retry with the same strategy as ws.onclose so we keep trying.
      if (!intentionalRef.current) {
        const delay = everConnectedRef.current
          ? Math.min(2000 * 2 ** retryCountRef.current, 30_000)
          : 3_000;
        retryCountRef.current += 1;
        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = null;
          connect();
        }, delay);
      }
      return;
    }

    const ws = new WebSocket(`${url}?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;
    let authenticated = false;

    ws.onmessage = (e) => {
      let data: unknown;
      try {
        data = JSON.parse(e.data);
      } catch {
        return;
      }

      if (!authenticated) {
        const d = data as Record<string, unknown>;
        if (d.type === "event" && d.event === "connect.challenge") {
          ws.send(
            JSON.stringify({
              type: "req",
              id: "gw-connect",
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
                scopes: [
                  "operator.admin",
                  "operator.read",
                  "operator.write",
                  "operator.approvals",
                  "operator.pairing",
                ],
                caps: ["tool-events"],
                auth: { token: gatewayToken },
                userAgent: navigator.userAgent,
                locale: navigator.language,
              },
            })
          );
          return;
        }
        if (d.type === "res" && d.id === "gw-connect") {
          if (d.ok) {
            authenticated = true;
            retryCountRef.current = 0;
            everConnectedRef.current = true;
            setConnected(true);
            setConnecting(false);
          } else {
            ws.close(4401, "Backend auth failed");
          }
          return;
        }
        return;
      }

      console.log("[GW]", data);
      emit(data);
    };

    ws.onclose = (event) => {
      setConnected(false);
      setConnecting(false);
      wsRef.current = null;

      if (event.code === 4401) {
        setError("Authentication failed.");
        return;
      }

      // Don't retry if the user explicitly disconnected.
      if (intentionalRef.current) return;

      // Before first successful connection (waiting for instance to boot):
      // retry every 3s. After an established connection drops: exponential
      // backoff 2s → 4s → 8s → … capped at 30s.
      const delay = everConnectedRef.current
        ? Math.min(2000 * 2 ** retryCountRef.current, 30_000)
        : 3_000;
      retryCountRef.current += 1;
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        connect();
      }, delay);
    };

    ws.onerror = () => {
      setConnected(false);
      setConnecting(false);
    };
  }, [emit]);

  const rpc = useCallback(
    (method: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> => {
      return new Promise((resolve, reject) => {
        const id = `rpc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const timer = setTimeout(() => {
          unsub();
          reject(new Error(`RPC timeout: ${method}`));
        }, 15_000);
        const unsub = subscribe((data) => {
          const d = data as Record<string, unknown>;
          if (d.type === "res" && d.id === id) {
            clearTimeout(timer);
            unsub();
            if (d.ok) resolve((d.payload ?? {}) as Record<string, unknown>);
            else reject(new Error(String((d as any).error?.message ?? (d as any).error?.code ?? `RPC failed: ${method}`)));
          }
        });
        send({ type: "req", id, method, params });
      });
    },
    [send, subscribe],
  );

  const disconnect = useCallback(() => {
    intentionalRef.current = true;
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    retryCountRef.current = 0;
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }, []);

  // Reconnect on tab visibility if we've previously connected.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        hasTriedRef.current &&
        wsRef.current?.readyState !== WebSocket.OPEN &&
        wsRef.current?.readyState !== WebSocket.CONNECTING
      ) {
        connect();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (retryTimerRef.current !== null) clearTimeout(retryTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return (
    <GatewayContext.Provider
      value={{ connected, connecting, error, connect, disconnect, send, subscribe, rpc }}
    >
      {children}
    </GatewayContext.Provider>
  );
}
