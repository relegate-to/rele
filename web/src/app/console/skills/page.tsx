"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  DownloadIcon,
  PowerIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SearchIcon,
  WrenchIcon,
  XCircleIcon,
} from "lucide-react";
import { EASE } from "@/lib/theme";
import { cn } from "@/lib/utils";

const INSTANCE_PROXY = "/api/instance";

// ── Types ─────────────────────────────────────────────────────────────────────

type SkillStatus = "ready" | "missing-deps" | "needs-config" | "disabled";
type FilterTab = "all" | "ready" | "needs-setup" | "enabled";

interface InstallEntry {
  id: string;
  kind: string;
  label: string;
  bins: string[];
}

interface Skill {
  id: string;
  name: string;
  description: string | null;
  emoji: string | null;
  enabled: boolean;
  status: SkillStatus;
  missingBins: string[];
  missingAnyBins: string[];
  missingEnv: string[];
  missingConfig: string[];
  pluginConfig: Record<string, unknown> | null;
  installEntries: InstallEntry[];
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${INSTANCE_PROXY}${path}`, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? res.statusText);
  }
  return res.json();
}

// ── Filter helpers ────────────────────────────────────────────────────────────

const FILTERS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "enabled", label: "Enabled" },
  { id: "ready", label: "Ready" },
  { id: "needs-setup", label: "Needs setup" },
];

function filterSkills(skills: Skill[], filter: FilterTab): Skill[] {
  switch (filter) {
    case "enabled":    return skills.filter((s) => s.enabled);
    case "ready":      return skills.filter((s) => s.status === "ready");
    case "needs-setup": return skills.filter((s) => s.status === "missing-deps" || s.status === "needs-config");
    default:           return skills;
  }
}

// ── Install button ────────────────────────────────────────────────────────────

type InstallState = "idle" | "running" | "done" | "error";

function InstallButton({ skillId, entry, onDone }: { skillId: string; entry: InstallEntry; onDone: () => void }) {
  const [state, setState] = useState<InstallState>("idle");
  const [output, setOutput] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };
  useEffect(() => () => stopPolling(), []);

  const install = async () => {
    setState("running");
    setOutput(null);
    try {
      const { jobId } = await apiFetch(`/api/skills/${skillId}/install/${entry.id}`, { method: "POST" });
      pollRef.current = setInterval(async () => {
        try {
          const job = await apiFetch(`/api/skills/install/${jobId}`);
          if (job.status === "done") { stopPolling(); setOutput(job.output || null); setState("done"); onDone(); }
          else if (job.status === "error") { stopPolling(); setOutput(job.output || job.error || null); setState("error"); }
        } catch {}
      }, 2_000);
    } catch (err) {
      setOutput(err instanceof Error ? err.message : "Failed to start");
      setState("error");
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={install}
        disabled={state === "running" || state === "done"}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50",
          state === "done"   ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
          : state === "error" ? "border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[var(--status-error-text)]"
                              : "border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:border-[var(--border-hi)]",
        )}
      >
        {state === "running" ? <RefreshCwIcon className="size-3.5 animate-spin" />
         : state === "done"  ? <CheckCircle2Icon className="size-3.5" />
                              : <DownloadIcon className="size-3.5" />}
        {state === "running" ? "Installing…" : state === "done" ? "Installed" : entry.label}
      </button>
      {output && (
        <pre className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-mono text-[11px] text-[var(--text-dim)] whitespace-pre-wrap break-all max-h-28 overflow-y-auto">
          {output}
        </pre>
      )}
    </div>
  );
}

// ── Config editor ─────────────────────────────────────────────────────────────

function ConfigEditor({ skillId, initial, onSaved }: { skillId: string; initial: Record<string, unknown> | null; onSaved: () => void }) {
  const [value, setValue] = useState(initial ? JSON.stringify(initial, null, 2) : "{}");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const parsed = JSON.parse(value);
      await apiFetch(`/api/skills/${skillId}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: parsed }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <textarea
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-mono text-xs text-[var(--text)] focus:border-[var(--accent)] focus:outline-none resize-none"
        rows={5}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        spellCheck={false}
      />
      {error && <p className="text-xs text-[var(--status-error-text)]">{error}</p>}
      <button
        onClick={save}
        disabled={saving}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs font-medium text-[var(--text)] transition-colors hover:border-[var(--border-hi)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save config"}
      </button>
    </div>
  );
}

// ── Skill card ────────────────────────────────────────────────────────────────

function SkillCard({ skill, onChanged }: { skill: Skill; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [toggling, setToggling] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setToggling(true);
    try {
      await apiFetch(`/api/skills/${skill.id}/${skill.enabled ? "disable" : "enable"}`, { method: "POST" });
      onChanged();
    } catch (err) {
      console.error("Toggle failed:", err);
    } finally {
      setToggling(false);
    }
  };

  const missingAnyBins = skill.missingAnyBins ?? [];
  const missingEnv = skill.missingEnv ?? [];

  const needsSetup = skill.status === "missing-deps" || skill.status === "needs-config";
  const hasDetails = skill.pluginConfig !== null || skill.missingBins.length > 0 || missingAnyBins.length > 0 || missingEnv.length > 0 || skill.missingConfig.length > 0 || skill.installEntries.length > 0;

  const statusColor =
    skill.status === "ready"         ? "text-[var(--status-success-text)]"
    : needsSetup                     ? "text-[var(--status-warning-text)]"
                                     : "text-[var(--muted)]";

  const StatusIcon =
    skill.status === "ready"         ? CheckCircle2Icon
    : needsSetup                     ? AlertTriangleIcon
                                     : CircleDashedIcon;

  const statusLabel =
    skill.status === "ready"         ? "Ready"
    : skill.status === "missing-deps" ? "Missing deps"
    : skill.status === "needs-config" ? "Needs config"
                                      : "Disabled";

  return (
    <div
      className={cn(
        "group flex flex-col rounded-2xl border bg-[var(--surface)] transition-all duration-150",
        expanded
          ? "border-[var(--border-hi)] shadow-lg shadow-black/10"
          : needsSetup
            ? "border-[var(--status-warning-border)] hover:border-[var(--status-warning)] hover:shadow-md hover:shadow-black/10"
            : skill.enabled
              ? "border-[var(--border)] hover:border-[var(--border-hi)] hover:shadow-md hover:shadow-black/10"
              : "border-[var(--border)] opacity-70 hover:opacity-100 hover:border-[var(--border-hi)]",
      )}
    >
      {/* Card top */}
      <div className="flex flex-col gap-3 p-5 flex-1">
        {/* Top row: emoji + toggle */}
        <div className="flex items-start justify-between">
          <div
            className={cn(
              "flex size-14 items-center justify-center rounded-2xl border text-3xl",
              needsSetup
                ? "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)]"
                : skill.enabled
                  ? "border-[var(--border)] bg-[var(--surface-hi)]"
                  : "border-[var(--border)] bg-[var(--bg)] opacity-60",
            )}
          >
            {skill.emoji ?? "🔧"}
          </div>

          <button
            onClick={toggle}
            disabled={toggling}
            title={skill.enabled ? "Disable" : "Enable"}
            className={cn(
              "flex size-8 items-center justify-center rounded-lg border transition-all disabled:cursor-not-allowed disabled:opacity-50",
              skill.enabled
                ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success)]"
                : "border-[var(--border)] bg-[var(--surface-hi)] text-[var(--muted)] hover:border-[var(--border-hi)] hover:text-[var(--text)]",
            )}
          >
            {toggling
              ? <RefreshCwIcon className="size-3.5 animate-spin" />
              : <PowerIcon className="size-3.5" />}
          </button>
        </div>

        {/* Name + status */}
        <div>
          <p className="text-sm font-semibold text-[var(--text)] leading-snug">
            {skill.name}
          </p>
          <div className={cn("mt-1 flex items-center gap-1 text-xs", statusColor)}>
            <StatusIcon className="size-3 shrink-0" />
            <span>{statusLabel}</span>
          </div>
        </div>

        {/* Description */}
        {skill.description && (
          <p className="text-xs text-[var(--text-dim)] leading-relaxed line-clamp-3 flex-1">
            {skill.description}
          </p>
        )}
      </div>

      {/* Details toggle */}
      {hasDetails && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "flex w-full items-center justify-between border-t px-5 py-3 text-xs transition-colors",
            needsSetup
              ? "border-[var(--status-warning-border)] text-[var(--status-warning-text)] hover:bg-[var(--status-warning-bg)]"
              : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--text-dim)] hover:bg-[var(--surface-hi)]",
          )}
        >
          <span className="flex items-center gap-1.5">
            {needsSetup && <WrenchIcon className="size-3" />}
            {expanded ? "Hide details" : needsSetup ? "Fix issues" : "Configure"}
          </span>
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-[var(--muted)]"
          >
            ▾
          </motion.span>
        </button>
      )}

      {/* Expanded details */}
      <AnimatePresence initial={false}>
        {expanded && hasDetails && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-4 px-5 pb-5 pt-4">
              {skill.missingBins.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">Missing binaries</p>
                  <div className="flex flex-wrap gap-1.5">
                    {skill.missingBins.map((bin) => (
                      <code key={bin} className="rounded-md border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2 py-1 text-xs text-[var(--status-warning-text)]">
                        {bin}
                      </code>
                    ))}
                  </div>
                </div>
              )}
              {missingAnyBins.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">Needs one of</p>
                  <div className="flex flex-wrap gap-1.5">
                    {missingAnyBins.map((bin) => (
                      <code key={bin} className="rounded-md border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2 py-1 text-xs text-[var(--status-warning-text)]">
                        {bin}
                      </code>
                    ))}
                  </div>
                </div>
              )}
              {missingEnv.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">Missing env vars</p>
                  <div className="flex flex-wrap gap-1.5">
                    {missingEnv.map((v) => (
                      <code key={v} className="rounded-md border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2 py-1 text-xs text-[var(--status-warning-text)]">
                        {v}
                      </code>
                    ))}
                  </div>
                </div>
              )}
              {skill.missingConfig.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">Missing config</p>
                  <div className="flex flex-wrap gap-1.5">
                    {skill.missingConfig.map((path) => (
                      <code key={path} className="rounded-md border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2 py-1 text-xs text-[var(--status-warning-text)]">
                        {path}
                      </code>
                    ))}
                  </div>
                </div>
              )}
              {skill.installEntries.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">Install</p>
                  <div className="space-y-2">
                    {skill.installEntries.map((entry) => (
                      <InstallButton key={entry.id} skillId={skill.id} entry={entry} onDone={onChanged} />
                    ))}
                  </div>
                </div>
              )}
              {skill.pluginConfig !== null && (
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">Config</p>
                  <ConfigEditor skillId={skill.id} initial={skill.pluginConfig} onSaved={onChanged} />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Restart banner ────────────────────────────────────────────────────────────

type RestartState = "idle" | "restarting" | "polling" | "done" | "error";

function RestartBanner({ onRestarted }: { onRestarted: () => void }) {
  const [state, setState] = useState<RestartState>("idle");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };
  useEffect(() => () => stopPolling(), []);

  const restart = async () => {
    setState("restarting");
    try { await apiFetch("/api/gateway/restart", { method: "POST" }); } catch {}
    setState("polling");
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 30) { stopPolling(); setState("error"); return; }
      try {
        const { ready } = await apiFetch("/api/gateway/restart/status");
        if (ready) { stopPolling(); setState("done"); onRestarted(); }
      } catch {}
    }, 2_000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: EASE }}
      className="mb-6 flex items-center gap-4 rounded-2xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-5 py-4"
    >
      <AlertTriangleIcon className="size-4 shrink-0 text-[var(--status-warning)]" />
      <p className="flex-1 text-sm text-[var(--status-warning-text)]">
        {state === "polling"  ? "Restarting gateway…"
         : state === "done"  ? "Gateway restarted."
         : state === "error" ? "Restart timed out — gateway may still be starting."
                             : "Changes require a gateway restart to take effect."}
      </p>
      {(state === "idle" || state === "error") && (
        <button
          onClick={restart}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--status-warning-border)] px-3.5 py-2 text-xs font-medium text-[var(--status-warning-text)] transition-colors hover:bg-[var(--status-warning)]/20"
        >
          <RotateCcwIcon className="size-3.5" />
          Restart now
        </button>
      )}
      {(state === "restarting" || state === "polling") && (
        <RefreshCwIcon className="size-4 animate-spin text-[var(--status-warning)]" />
      )}
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingRestart, setPendingRestart] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  const fetchSkills = useCallback(async () => {
    try {
      const { skills } = await apiFetch("/api/skills");
      setSkills(skills);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load skills");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSkills(); }, [fetchSkills]);

  const handleChanged = useCallback(() => {
    setPendingRestart(true);
    fetchSkills();
  }, [fetchSkills]);

  const handleRestarted = useCallback(() => {
    setPendingRestart(false);
    setTimeout(fetchSkills, 1_000);
  }, [fetchSkills]);

  const total      = skills.length;
  const ready      = skills.filter((s) => s.status === "ready").length;
  const needsSetup = skills.filter((s) => s.status === "missing-deps" || s.status === "needs-config").length;

  const counts: Record<FilterTab, number> = {
    all: total,
    enabled: skills.filter((s) => s.enabled).length,
    ready,
    "needs-setup": needsSetup,
  };

  const filtered = filterSkills(skills, activeFilter).filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
  });

  return (
    <div className="h-[100svh] overflow-y-auto">
      <div className="relative bg-[var(--bg)] text-[var(--text)]">
        <div className="relative z-10 mx-auto max-w-[900px] px-8 py-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            {/* Header */}
            <div className="mb-8 flex items-end justify-between gap-6">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Skills</h1>
                <p className="mt-1.5 text-sm text-[var(--text-dim)]">
                  Manage the capabilities available to your OpenClaw instance.
                </p>
              </div>
              {!loading && total > 0 && (
                <div className="flex items-center gap-3 shrink-0 text-xs text-[var(--muted)]">
                  <span className="flex items-center gap-1.5 text-[var(--status-success-text)]">
                    <CheckCircle2Icon className="size-3.5" />
                    {ready} ready
                  </span>
                  {needsSetup > 0 && (
                    <span className="flex items-center gap-1.5 text-[var(--status-warning-text)]">
                      <WrenchIcon className="size-3.5" />
                      {needsSetup} need setup
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Restart banner */}
            <AnimatePresence>
              {pendingRestart && <RestartBanner onRestarted={handleRestarted} />}
            </AnimatePresence>

            {/* Search + filters */}
            {!loading && !error && total > 0 && (
              <div className="mb-6 flex flex-col gap-3">
                {/* Search */}
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--muted)]" />
                  <input
                    type="text"
                    placeholder="Search skills…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] py-2.5 pl-9 pr-4 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:border-[var(--border-hi)] focus:outline-none transition-colors"
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

              {/* Filter tabs */}
              <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setActiveFilter(f.id)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                      activeFilter === f.id
                        ? "bg-[var(--surface-hi)] text-[var(--text)] shadow-sm"
                        : "text-[var(--muted)] hover:text-[var(--text-dim)]",
                    )}
                  >
                    {f.label}
                    {counts[f.id] > 0 && (
                      <span
                        className={cn(
                          "min-w-[18px] rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums text-center",
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
            </div>
            )}

            {/* Loading skeleton grid */}
            {loading && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="h-44 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
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
              <AnimatePresence mode="wait">
                {filtered.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 py-14 text-center"
                  >
                    <p className="text-sm text-[var(--muted)]">
                      {total === 0
                        ? "No skills found in /app/skills/"
                        : search.trim()
                          ? `No skills match "${search}"`
                          : `No skills match "${FILTERS.find((f) => f.id === activeFilter)?.label}"`}
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key={activeFilter}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="grid grid-cols-2 gap-4 sm:grid-cols-3"
                  >
                    {filtered.map((skill) => (
                      <SkillCard key={skill.id} skill={skill} onChanged={handleChanged} />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
