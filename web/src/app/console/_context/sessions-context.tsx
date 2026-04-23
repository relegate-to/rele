"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useGateway } from "./gateway-context";

export interface Session {
  key: string;
  sessionId: string;
  displayName: string;
  updatedAt: number;
  kind: string;
}

interface SessionsContextValue {
  sessions: Session[];
  activeSessionKey: string;
  setActiveSessionKey: (key: string) => void;
  createSession: (label: string, activate?: boolean) => Promise<string>;
  deleteSession: (key: string) => Promise<void>;
  renameSession: (key: string, label: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
  loading: boolean;
}

const MAIN_SESSION_KEY = "agent:main:main";

const SessionsContext = createContext<SessionsContextValue | null>(null);

export function useSessions(): SessionsContextValue {
  const ctx = useContext(SessionsContext);
  if (!ctx) throw new Error("useSessions must be used inside SessionsProvider");
  return ctx;
}

function parseSessions(raw: any[]): Session[] {
  return raw.map((s) => ({
    key: s.key,
    sessionId: s.sessionId,
    displayName: s.displayName ?? s.sessionId ?? s.key,
    updatedAt: s.updatedAt ?? 0,
    kind: s.kind ?? "main",
  }));
}

export function SessionsProvider({ children }: { children: ReactNode }) {
  const { connected, rpc, subscribe } = useGateway();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionKey, setActiveSessionKey] = useState(MAIN_SESSION_KEY);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);
  const sessionsRef = useRef<Session[]>([]);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await rpc("sessions.list", {
        includeGlobal: true,
        includeDerivedTitles: true,
        limit: 100,
      });
      const list = parseSessions((payload.sessions as any[]) ?? []);
      sessionsRef.current = list;
      setSessions(list);
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, [rpc]);

  // Fetch sessions when connected
  useEffect(() => {
    if (!connected) {
      fetchedRef.current = false;
      return;
    }
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchSessions();
  }, [connected, fetchSessions]);

  const createSession = useCallback(
    async (label: string, activate = true): Promise<string> => {
      const key = `agent:main:webui-${Date.now()}`;
      await rpc("sessions.create", { key, label });
      await fetchSessions();
      if (activate) setActiveSessionKey(key);
      return key;
    },
    [rpc, fetchSessions],
  );

  const deleteSession = useCallback(
    async (key: string) => {
      if (activeSessionKey === key) {
        setActiveSessionKey(MAIN_SESSION_KEY);
      }
      try {
        await rpc("sessions.delete", { key });
      } catch {
        // May already be gone
      }
      await fetchSessions();
    },
    [rpc, activeSessionKey, fetchSessions],
  );

  const renameSession = useCallback(
    async (key: string, label: string) => {
      await rpc("sessions.patch", { key, label });
      await fetchSessions();
    },
    [rpc, fetchSessions],
  );

  // Clean up dot-prefixed sessions on lifecycle:end.
  useEffect(() => {
    return subscribe((raw) => {
      const data = raw as Record<string, unknown>;
      if (data.type !== "event" || data.event !== "agent") return;
      const payload = data.payload as Record<string, unknown>;
      if (payload?.stream !== "lifecycle") return;
      if ((payload.data as Record<string, unknown> | undefined)?.phase !== "end") return;
      const key = payload.sessionKey as string | undefined;
      if (!key) return;
      const session = sessionsRef.current.find((s) => s.key === key);
      if (!session || !session.displayName.startsWith(".tmp ")) return;
      setActiveSessionKey((cur) => (cur === key ? MAIN_SESSION_KEY : cur));
      rpc("sessions.delete", { key }).catch(() => {});
      fetchSessions();
    });
  }, [subscribe, rpc, fetchSessions]);

  return (
    <SessionsContext.Provider
      value={{ sessions, activeSessionKey, setActiveSessionKey, createSession, deleteSession, renameSession, refreshSessions: fetchSessions, loading }}
    >
      {children}
    </SessionsContext.Provider>
  );
}
