"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const GATE_PROXY = "/api/gate";

/** States that are still transitioning and worth polling for. */
const TRANSIENT_STATES = new Set(["created", "starting", "stopping", "replacing", "restarting"]);

/** How often to poll while any machine is in a transient state. */
const FAST_POLL_MS = 3_000;

/** Background poll interval when all machines are settled. */
const SLOW_POLL_MS = 30_000;

export interface Machine {
  id: string;
  userId: string;
  flyMachineId: string;
  flyAppName: string;
  region: string;
  state: string;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export function useMachines() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deletingRef = useRef<Set<string>>(new Set());
  /** Optimistic state overrides — polling won't clobber these until the action resolves. */
  const overridesRef = useRef<Map<string, string>>(new Map());

  const fetchMachines = useCallback(async () => {
    try {
      const res = await fetch(`${GATE_PROXY}/machines`);
      if (res.ok) {
        const data: Machine[] = await res.json();
        // Don't resurrect machines that are mid-deletion
        const filtered = data.filter((m) => !deletingRef.current.has(m.id));
        // Apply optimistic state overrides
        const merged = filtered.map((m) => {
          const override = overridesRef.current.get(m.id);
          return override ? { ...m, state: override } : m;
        });
        setMachines(merged);
        return merged;
      }
    } catch {
      // silent — sidebar should degrade gracefully
    } finally {
      setLoading(false);
    }
    return null;
  }, []);

  // Adaptive polling — fast when machines are transitioning, slow otherwise.
  useEffect(() => {
    function scheduleNext(ms: number) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(async () => {
        const data = await fetchMachines();
        const hasTransient = data?.some((m) => TRANSIENT_STATES.has(m.state));
        // If the pace needs to change, reschedule
        const nextMs = hasTransient ? FAST_POLL_MS : SLOW_POLL_MS;
        if (nextMs !== ms) scheduleNext(nextMs);
      }, ms);
    }

    // Initial fetch, then start polling
    fetchMachines().then((data) => {
      const hasTransient = data?.some((m) => TRANSIENT_STATES.has(m.state));
      scheduleNext(hasTransient ? FAST_POLL_MS : SLOW_POLL_MS);
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchMachines]);

  const createMachine = useCallback(
    async (config: { image: string; region?: string; env?: Record<string, string> }) => {
      const res = await fetch(`${GATE_PROXY}/machines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region: config.region, config: { image: config.image, env: config.env } }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to create machine" }));
        throw new Error(err.error);
      }

      const machine: Machine = await res.json();
      // Upsert: polling may have already added this machine while the POST was
      // in flight; don't create a duplicate entry.
      setMachines((prev) => {
        const idx = prev.findIndex((m) => m.id === machine.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = machine;
          return next;
        }
        return [...prev, machine];
      });
      return machine;
    },
    [],
  );

  const startMachine = useCallback(
    async (id: string) => {
      overridesRef.current.set(id, "starting");
      setMachines((prev) => prev.map((m) => (m.id === id ? { ...m, state: "starting" } : m)));
      try {
        const res = await fetch(`${GATE_PROXY}/machines/${id}/start`, { method: "POST" });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Failed to start machine" }));
          throw new Error(err.error);
        }
        const updated: Machine = await res.json();
        setMachines((prev) => prev.map((m) => (m.id === id ? updated : m)));
      } finally {
        overridesRef.current.delete(id);
      }
    },
    [],
  );

  const stopMachine = useCallback(
    async (id: string) => {
      setMachines((prev) => prev.map((m) => (m.id === id ? { ...m, state: "stopping" } : m)));
      const res = await fetch(`${GATE_PROXY}/machines/${id}/stop`, { method: "POST" });
      if (!res.ok) {
        // Revert — let next poll fix the real state
        await fetchMachines();
        const err = await res.json().catch(() => ({ error: "Failed to stop machine" }));
        throw new Error(err.error);
      }
      const updated: Machine = await res.json();
      setMachines((prev) => prev.map((m) => (m.id === id ? updated : m)));
    },
    [fetchMachines],
  );

  const deleteMachine = useCallback(
    async (id: string) => {
      deletingRef.current.add(id);
      try {
        const res = await fetch(`${GATE_PROXY}/machines/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Failed to delete machine" }));
          throw new Error(err.error);
        }
      } finally {
        deletingRef.current.delete(id);
      }
      setMachines((prev) => prev.filter((m) => m.id !== id));
    },
    [],
  );

  const refreshMachine = useCallback(
    async (id: string) => {
      const res = await fetch(`${GATE_PROXY}/machines/${id}`);
      if (!res.ok) return;
      const updated: Machine = await res.json();
      setMachines((prev) => prev.map((m) => (m.id === id ? updated : m)));
    },
    [],
  );

  return { machines, loading, fetchMachines, createMachine, startMachine, stopMachine, deleteMachine, refreshMachine };
}
