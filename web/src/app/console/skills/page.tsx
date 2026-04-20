"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  DownloadIcon,
  RefreshCwIcon,
  SearchIcon,
  WrenchIcon,
  XCircleIcon,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
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

function hasAllDeps(s: Skill) {
  return s.missingBins.length === 0 && (s.missingAnyBins ?? []).length === 0 && s.missingEnv.length === 0 && s.missingConfig.length === 0;
}

function filterSkills(skills: Skill[], filter: FilterTab): Skill[] {
  switch (filter) {
    case "enabled":     return skills.filter((s) => s.enabled && s.status !== "missing-deps" && s.status !== "needs-config");
    case "ready":       return skills.filter((s) => !s.enabled && (s.status === "ready" || (s.status === "disabled" && hasAllDeps(s))));
    case "needs-setup": return skills.filter((s) => s.status === "missing-deps" || s.status === "needs-config");
    default:            return skills;
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

function SkillCard({ skill, onChanged, onToggled }: { skill: Skill; onChanged: () => void; onToggled: (skillId: string, lockedStatus: SkillStatus, newEnabled: boolean) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [toggling, setToggling] = useState(false);

  const toggle = async () => {
    setToggling(true);
    onToggled(skill.id, skill.status, !skill.enabled);
    try {
      await apiFetch(`/api/skills/${skill.id}/${skill.enabled ? "disable" : "enable"}`, { method: "POST" });
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

  const dotColor =
    skill.status === "ready"          ? "bg-[var(--status-success-text)]"
    : needsSetup                      ? "bg-[var(--status-warning-text)]"
                                      : "bg-[var(--border-hi)]";

  const statusLabel =
    skill.status === "ready"          ? "Ready"
    : skill.status === "missing-deps" ? "Missing deps"
    : skill.status === "needs-config" ? "Needs config"
                                      : "Disabled";

  const statusTextColor =
    skill.status === "ready"          ? "text-[var(--status-success-text)]"
    : needsSetup                      ? "text-[var(--status-warning-text)]"
                                      : "text-[var(--muted)]";

  return (
    <div
      className={cn(
        "group flex flex-col rounded-xl border bg-[var(--surface)] transition-all duration-150",
        expanded
          ? "border-[var(--border-hi)] shadow-lg shadow-black/10"
          : needsSetup
            ? "border-[var(--status-warning-border)] hover:border-[var(--status-warning)] hover:shadow-md hover:shadow-black/10"
            : "border-[var(--border)] hover:border-[var(--border-hi)] hover:shadow-sm hover:shadow-black/10",
        !skill.enabled && !needsSetup && !expanded && "opacity-60 hover:opacity-100",
      )}
    >
      {/* Card top */}
      <div className="flex flex-col p-4 flex-1 gap-3">
        {/* Emoji + switch */}
        <div className="flex items-start justify-between">
          <span className={cn("text-2xl leading-none", !skill.enabled && !needsSetup && "grayscale")}>
            {skill.emoji ?? "🔧"}
          </span>
          <Switch
            checked={skill.enabled && !needsSetup}
            onClick={() => { void toggle(); }}
            disabled={toggling || needsSetup}
            title={needsSetup ? "Fix issues before enabling" : skill.enabled ? "Disable" : "Enable"}
          />
        </div>

        {/* Name + status + description */}
        <div className="flex flex-col gap-1 flex-1">
          <p className="text-sm font-medium text-[var(--text)] leading-snug">
            {skill.name}
          </p>
          <div className={cn("flex items-center gap-1.5 text-[11px]", statusTextColor)}>
            <span className={cn("size-1.5 rounded-full shrink-0", dotColor)} />
            {statusLabel}
          </div>
          {skill.description && (
            <p className="mt-1 text-xs text-[var(--text-dim)] leading-relaxed line-clamp-2">
              {skill.description}
            </p>
          )}
        </div>
      </div>

      {/* Details toggle */}
      {hasDetails && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "flex w-full items-center justify-between border-t px-4 py-2.5 text-xs transition-colors",
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
            <div className="space-y-4 px-4 pb-4 pt-3">
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

type RestartState = "pending" | "restarting" | "done" | "timeout";

async function triggerRestart(
  onStateChange: (s: RestartState) => void,
  onRestarted: () => void,
) {
  onStateChange("restarting");
  try { await apiFetch("/api/gateway/restart", { method: "POST" }); } catch {}
  let attempts = 0;
  const poll = setInterval(async () => {
    attempts++;
    if (attempts > 30) {
      clearInterval(poll);
      onStateChange("timeout");
      return;
    }
    try {
      const { ready } = await apiFetch("/api/gateway/restart/status");
      if (ready) {
        clearInterval(poll);
        onStateChange("done");
        setTimeout(() => { onRestarted(); }, 2_000);
      }
    } catch {}
  }, 2_000);
}

function RestartBanner({
  state,
  onRestart,
  onDismiss,
}: {
  state: RestartState;
  onRestart: () => void;
  onDismiss: () => void;
}) {
  const isDone    = state === "done";
  const isTimeout = state === "timeout";
  const isActive  = state === "restarting";

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-xl shadow-black/20 text-sm backdrop-blur",
        isDone
          ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
          : isTimeout
            ? "border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[var(--status-error-text)]"
            : "border-[var(--border-hi)] bg-[var(--surface)] text-[var(--text)]",
      )}
    >
        {isDone ? (
          <CheckCircle2Icon className="size-4 shrink-0" />
        ) : isTimeout ? (
          <AlertTriangleIcon className="size-4 shrink-0" />
        ) : isActive ? (
          <RefreshCwIcon className="size-4 shrink-0 animate-spin" />
        ) : (
          <WrenchIcon className="size-4 shrink-0 text-[var(--muted)]" />
        )}

        <span className="whitespace-nowrap">
          {isDone    ? "Gateway restarted"
           : isTimeout ? "Restart timed out — gateway may still be starting"
           : isActive  ? "Restarting gateway…"
                       : "Restart required to apply changes"}
        </span>

        {!isDone && !isTimeout && !isActive && (
          <button
            onClick={onRestart}
            className="ml-1 rounded-lg border border-[var(--border)] bg-[var(--surface-hi)] px-3 py-1 text-xs font-medium text-[var(--text)] transition-colors hover:border-[var(--border-hi)] whitespace-nowrap"
          >
            Restart now
          </button>
        )}

        {!isActive && (
          <button
            onClick={onDismiss}
            className="ml-1 text-[var(--muted)] transition-colors hover:text-[var(--text)]"
          >
            <XCircleIcon className="size-4" />
          </button>
        )}
    </div>
  );
}


// ── Page ──────────────────────────────────────────────────────────────────────

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [restartState, setRestartState] = useState<RestartState | null>(null);
  const [lockedStatus, setLockedStatus] = useState<Record<string, SkillStatus>>({});
  const [pendingEnabled, setPendingEnabled] = useState<Record<string, boolean>>({});

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

  const handleRestarted = useCallback(() => {
    setRestartState(null);
    setLockedStatus({});
    setPendingEnabled({});
    setTimeout(fetchSkills, 1_000);
  }, [fetchSkills]);

  const handleToggled = useCallback((skillId: string, status: SkillStatus, newEnabled: boolean) => {
    setLockedStatus((prev) => ({ ...prev, [skillId]: status }));
    setPendingEnabled((prev) => ({ ...prev, [skillId]: newEnabled }));
    setRestartState((prev) => prev === null ? "pending" : prev);
  }, []);

  const handleChanged = useCallback(() => {
    setRestartState((prev) => prev === null ? "pending" : prev);
    fetchSkills();
  }, [fetchSkills]);

  // For filtering/counts: lock status to pre-toggle value, keep enabled unchanged
  const skillsForFilter = skills.map((s) => ({
    ...s,
    ...(s.id in lockedStatus && { status: lockedStatus[s.id] }),
  }));

  // For display: also apply the new enabled state so the switch reflects the toggle
  const skillsForDisplay = skillsForFilter.map((s) => ({
    ...s,
    ...(s.id in pendingEnabled && { enabled: pendingEnabled[s.id] }),
  }));

  const total      = skillsForFilter.length;
  const ready      = skillsForFilter.filter((s) => !s.enabled && (s.status === "ready" || (s.status === "disabled" && hasAllDeps(s)))).length;
  const needsSetup = skillsForFilter.filter((s) => s.status === "missing-deps" || s.status === "needs-config").length;

  const counts: Record<FilterTab, number> = {
    all: total,
    enabled: skillsForFilter.filter((s) => s.enabled && s.status !== "missing-deps" && s.status !== "needs-config").length,
    ready,
    "needs-setup": needsSetup,
  };

  const filteredIds = new Set(filterSkills(skillsForFilter, activeFilter).map((s) => s.id));
  const filtered = skillsForDisplay.filter((s) => {
    if (!filteredIds.has(s.id)) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
  });

  return (
    <div className="h-[100svh] relative flex flex-col">
      <div className="flex-1 overflow-y-auto stable-gutter">
      <div className="relative bg-[var(--bg)] text-[var(--text)]">
        <div className="relative z-10 mx-auto max-w-[900px] px-8 py-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            {/* Toolbar */}
            <div className="mb-4 flex items-center gap-4">
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
              <div className="relative ml-auto w-48">
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
                      <SkillCard key={skill.id} skill={skill} onChanged={handleChanged} onToggled={handleToggled} />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </motion.div>
        </div>
      </div>
      </div>
      <AnimatePresence>
        {restartState !== null && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute bottom-6 left-1/2 z-50 -translate-x-1/2"
          >
            <RestartBanner
              state={restartState}
              onRestart={() => triggerRestart(setRestartState, handleRestarted)}
              onDismiss={() => setRestartState(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
