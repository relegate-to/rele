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
  createSession: (label: string) => Promise<string>;
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
  const { connected, rpc } = useGateway();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionKey, setActiveSessionKey] = useState(MAIN_SESSION_KEY);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await rpc("sessions.list", {
        includeGlobal: true,
        includeDerivedTitles: true,
        limit: 100,
      });
      setSessions(parseSessions((payload.sessions as any[]) ?? []));
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
    async (label: string): Promise<string> => {
      const key = `agent:main:webui-${Date.now()}`;
      await rpc("sessions.create", { key, label });
      await fetchSessions();
      setActiveSessionKey(key);
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

  return (
    <SessionsContext.Provider
      value={{ sessions, activeSessionKey, setActiveSessionKey, createSession, deleteSession, renameSession, refreshSessions: fetchSessions, loading }}
    >
      {children}
    </SessionsContext.Provider>
  );
}
