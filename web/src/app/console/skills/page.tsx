"use client";

// TODO: Improve status at end of install.
// Fix messages not showing in log.

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SearchIcon, XCircleIcon } from "lucide-react";
import { EASE } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useGateway } from "../_context/gateway-context";
import { SkillCard } from "./_components/skill-card";
import {
  apiFetch,
  FILTERS,
  filterSkills,
  hasAllDeps,
  type FilterTab,
  type Skill,
  type SkillStatus,
} from "./_lib/skills";

export default function SkillsPage() {
  const { connected, rpc } = useGateway();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [lockedStatus, setLockedStatus] = useState<Record<string, SkillStatus>>({});
  const [pendingEnabled, setPendingEnabled] = useState<Record<string, boolean>>({});
  const [installSessions, setInstallSessions] = useState<Record<string, { key: string; label: string }>>({});

  const fetchSkills = useCallback(async () => {
    try {
      let config = {};
      try { config = await rpc("config.get"); } catch {}
      const { skills } = await apiFetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      setSkills(skills);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load skills");
    } finally {
      setLoading(false);
    }
  }, [rpc]);

  // Fetch skills when gateway connects (and on reconnect after restart).
  useEffect(() => {
    if (connected) fetchSkills();
  }, [connected, fetchSkills]);

  const handleToggled = useCallback((skillId: string, status: SkillStatus, newEnabled: boolean) => {
    setLockedStatus((prev) => ({ ...prev, [skillId]: status }));
    setPendingEnabled((prev) => ({ ...prev, [skillId]: newEnabled }));
  }, []);

  const handleChanged = useCallback(() => {
    fetchSkills();
  }, [fetchSkills]);

  // For filtering/counts: lock status to pre-toggle value, keep enabled unchanged
  const skillsForFilter = useMemo(() => skills.map((s) => ({
    ...s,
    ...(s.id in lockedStatus && { status: lockedStatus[s.id] }),
  })), [skills, lockedStatus]);

  // For display: also apply the new enabled state so the switch reflects the toggle
  const skillsForDisplay = useMemo(() => skillsForFilter.map((s) => ({
    ...s,
    ...(s.id in pendingEnabled && { enabled: pendingEnabled[s.id] }),
  })), [skillsForFilter, pendingEnabled]);

  const { total, needsSetup, counts } = useMemo(() => {
    const total = skillsForFilter.length;
    const ready = skillsForFilter.filter((s) => !s.enabled && (s.status === "ready" || (s.status === "disabled" && hasAllDeps(s)))).length;
    const needsSetup = skillsForFilter.filter((s) => s.status === "missing-deps" || s.status === "needs-config").length;
    const counts: Record<FilterTab, number> = {
      all: total,
      enabled: skillsForFilter.filter((s) => s.enabled && s.status !== "missing-deps" && s.status !== "needs-config").length,
      ready,
      "needs-setup": needsSetup,
    };
    return { total, needsSetup, counts };
  }, [skillsForFilter]);

  const filtered = useMemo(() => {
    const filteredIds = new Set(filterSkills(skillsForFilter, activeFilter).map((s) => s.id));
    return skillsForDisplay.filter((s) => {
      if (!filteredIds.has(s.id) && !installSessions[s.id]?.key) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
    });
  }, [skillsForDisplay, skillsForFilter, activeFilter, search, installSessions]);

  return (
    <div className="h-[100svh] relative flex flex-col">
      <div className="flex-1 overflow-y-auto stable-gutter">
      <div className="relative bg-[var(--bg)] text-[var(--text)]">
        <div className="relative z-10 mx-auto px-8 py-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            {/* Toolbar */}
            <div className="mb-4 flex justify-center">
              <div className="inline-flex flex-wrap items-center justify-center gap-3">
              {/* Filter tabs */}
              {!loading && !error && total > 0 && (
                <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
                  {FILTERS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setActiveFilter(f.id)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                        activeFilter === f.id
                          ? "bg-[var(--surface-hi)] text-[var(--text)] shadow-sm"
                          : "text-[var(--muted)] hover:text-[var(--text-dim)]",
                      )}
                    >
                      {f.label}
                      {counts[f.id] > 0 && (
                        <span
                          className={cn(
                            "min-w-[16px] rounded-full px-1 py-px text-[10px] font-semibold tabular-nums text-center",
                            f.id === "needs-setup" && needsSetup > 0
                              ? "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]"
                              : "bg-[var(--border)] text-[var(--muted)]",
                          )}
                        >
                          {counts[f.id]}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Search */}
              <div className="relative w-85 ">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--muted)]" />
                <input
                  type="text"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1.5 pl-8 pr-4 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:border-[var(--border-hi)] focus:outline-none transition-colors"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)] transition-colors"
                  >
                    <XCircleIcon className="size-3.5" />
                  </button>
                )}
              </div>
              </div>
            </div>



            {/* Loading skeleton */}
            {loading && (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div
                    key={i}
                    className="h-32 animate-pulse rounded-md border border-[var(--border-hi)] bg-[var(--surface)]"
                  />
                ))}
              </div>
            )}

            {/* Error */}
            {!loading && error && (
              <div className="flex items-center gap-3 rounded-2xl border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-5 py-4">
                <XCircleIcon className="size-4 shrink-0 text-[var(--status-error)]" />
                <p className="text-sm text-[var(--status-error-text)]">{error}</p>
              </div>
            )}

            {/* Skills grid */}
            {!loading && !error && (
              <>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-3">
                  <AnimatePresence mode="popLayout">
                    {filtered.map((skill) => (
                      <motion.div
                        key={skill.id}
                        layout="position"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2, layout: { duration: 0.25, ease: EASE } }}
                        className="will-change-[transform,opacity]"
                      >
                        <SkillCard skill={skill} onChanged={handleChanged} onToggled={handleToggled} installSessionKey={installSessions[skill.id]?.key} installSessionLabel={installSessions[skill.id]?.label} onInstallSessionStart={(skillId, key, label) => setInstallSessions((prev) => ({ ...prev, [skillId]: { key, label } }))} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
                <AnimatePresence>
                  {filtered.length === 0 && (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-6 py-14 text-center"
                    >
                      <p className="text-sm text-[var(--muted)]">
                        {total === 0
                          ? "No skills found in /app/skills/"
                          : search.trim()
                            ? `No skills match "${search}"`
                            : `No skills match "${FILTERS.find((f) => f.id === activeFilter)?.label}"`}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </motion.div>
        </div>
      </div>
      </div>
    </div>
  );
}
