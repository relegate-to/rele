"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  CircleDashedIcon,
  DownloadIcon,
  PowerIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  XCircleIcon,
} from "lucide-react";
import { EASE } from "@/lib/theme";
import { cn } from "@/lib/utils";

const INSTANCE_PROXY = "/api/instance";

// ── Types ─────────────────────────────────────────────────────────────────────

type SkillStatus = "ready" | "missing-deps" | "needs-config" | "disabled";

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

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_META: Record<
  SkillStatus,
  { label: string; icon: React.ReactNode; colorVar: string }
> = {
  ready: {
    label: "Ready",
    icon: <CheckCircle2Icon className="size-3" />,
    colorVar: "success",
  },
  "missing-deps": {
    label: "Missing deps",
    icon: <AlertTriangleIcon className="size-3" />,
    colorVar: "warning",
  },
  "needs-config": {
    label: "Needs config",
    icon: <AlertTriangleIcon className="size-3" />,
    colorVar: "warning",
  },
  disabled: {
    label: "Disabled",
    icon: <CircleDashedIcon className="size-3" />,
    colorVar: "neutral",
  },
};

function StatusBadge({ status }: { status: SkillStatus }) {
  const { label, icon, colorVar } = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
      style={{
        background: `var(--status-${colorVar}-bg, rgba(255,255,255,0.05))`,
        color: `var(--status-${colorVar}-text, var(--text-dim))`,
        borderColor: `var(--status-${colorVar}-border, var(--border))`,
      }}
    >
      {icon}
      {label}
    </span>
  );
}

// ── Install button ────────────────────────────────────────────────────────────

type InstallState = "idle" | "running" | "done" | "error";

function InstallButton({
  skillId,
  entry,
  onDone,
}: {
  skillId: string;
  entry: InstallEntry;
  onDone: () => void;
}) {
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
      const { jobId } = await apiFetch(
        `/api/skills/${skillId}/install/${entry.id}`,
        { method: "POST" },
      );
      pollRef.current = setInterval(async () => {
        try {
          const job = await apiFetch(`/api/skills/install/${jobId}`);
          if (job.status === "done") {
            stopPolling();
            setOutput(job.output || null);
            setState("done");
            onDone();
          } else if (job.status === "error") {
            stopPolling();
            setOutput(job.output || job.error || null);
            setState("error");
          }
        } catch {}
      }, 2_000);
    } catch (err) {
      setOutput(err instanceof Error ? err.message : "Failed to start");
      setState("error");
    }
  };

  return (
    <div className="space-y-1.5">
      <button
        onClick={install}
        disabled={state === "running" || state === "done"}
        className={cn(
          "flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          state === "done"
            ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
            : state === "error"
              ? "border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[var(--status-error-text)]"
              : "border-[var(--border)] bg-[var(--surface-hi)] text-[var(--text)] hover:border-[var(--border-hi)]",
        )}
      >
        {state === "running" ? (
          <RefreshCwIcon className="size-3 animate-spin" />
        ) : state === "done" ? (
          <CheckCircle2Icon className="size-3" />
        ) : (
          <DownloadIcon className="size-3" />
        )}
        {state === "running" ? "Installing…" : state === "done" ? "Installed" : entry.label}
      </button>
      {output && (
        <pre className="rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-mono text-[11px] text-[var(--text-dim)] whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
          {output}
        </pre>
      )}
    </div>
  );
}

// ── Config editor ─────────────────────────────────────────────────────────────

function ConfigEditor({
  skillId,
  initial,
  onSaved,
}: {
  skillId: string;
  initial: Record<string, unknown> | null;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(
    initial ? JSON.stringify(initial, null, 2) : "{}",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
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
    <div className="space-y-3">
      <textarea
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 font-mono text-xs text-[var(--text)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none resize-none"
        rows={6}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        spellCheck={false}
      />
      {error && (
        <p className="text-xs text-[var(--status-error-text)]">{error}</p>
      )}
      <button
        onClick={save}
        disabled={saving}
        className="rounded-md border border-[var(--border)] bg-[var(--surface-hi)] px-3 py-1.5 text-xs font-medium text-[var(--text)] transition-colors hover:border-[var(--border-hi)] hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save config"}
      </button>
    </div>
  );
}

// ── Skill card ────────────────────────────────────────────────────────────────

function SkillCard({
  skill,
  onChanged,
}: {
  skill: Skill;
  onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [toggling, setToggling] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setToggling(true);
    try {
      const action = skill.enabled ? "disable" : "enable";
      await apiFetch(`/api/skills/${skill.id}/${action}`, { method: "POST" });
      onChanged();
    } catch (err) {
      console.error("Toggle failed:", err);
    } finally {
      setToggling(false);
    }
  };

  const hasConfig = skill.pluginConfig !== null;
  const hasMissing = skill.missingBins.length > 0 || skill.missingConfig.length > 0;
  const hasInstall = skill.installEntries.length > 0;
  const canExpand = hasConfig || hasMissing || hasInstall;

  return (
    <div
      className={cn(
        "rounded-xl border bg-[var(--surface)] transition-colors",
        expanded
          ? "border-[var(--border-hi)]"
          : "border-[var(--border)] hover:border-[var(--border-hi)]",
      )}
    >
      {/* Header row */}
      <div
        className={cn(
          "flex items-center gap-4 px-5 py-4",
          canExpand && "cursor-pointer select-none",
        )}
        onClick={() => canExpand && setExpanded((v) => !v)}
      >
        {/* Emoji / fallback */}
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-hi)] text-lg">
          {skill.emoji ?? "🔧"}
        </div>

        {/* Name + description */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--text)]">
              {skill.name}
            </span>
            <span className="font-mono text-[11px] text-[var(--muted)]">
              {skill.id}
            </span>
          </div>
          {skill.description && (
            <p className="mt-0.5 truncate text-xs text-[var(--text-dim)]">
              {skill.description}
            </p>
          )}
        </div>

        {/* Status + toggle */}
        <div className="flex shrink-0 items-center gap-3">
          <StatusBadge status={skill.status} />

          {canExpand && (
            <ChevronDownIcon
              className={cn(
                "size-4 text-[var(--muted)] transition-transform duration-200",
                expanded && "rotate-180",
              )}
            />
          )}

          <button
            onClick={toggle}
            disabled={toggling}
            title={skill.enabled ? "Disable skill" : "Enable skill"}
            className={cn(
              "flex size-8 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              skill.enabled
                ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success)] hover:bg-[var(--status-success-bg)]/80"
                : "border-[var(--border)] bg-[var(--surface-hi)] text-[var(--muted)] hover:border-[var(--border-hi)] hover:text-[var(--text)]",
            )}
          >
            <PowerIcon className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      <AnimatePresence initial={false}>
        {expanded && canExpand && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-[var(--border)] px-5 py-4">
              {/* Missing bins */}
              {skill.missingBins.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-[var(--status-warning-text)]">
                    Missing binaries
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {skill.missingBins.map((bin) => (
                      <code
                        key={bin}
                        className="rounded border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2 py-0.5 text-xs text-[var(--status-warning-text)]"
                      >
                        {bin}
                      </code>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing config */}
              {skill.missingConfig.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-[var(--status-warning-text)]">
                    Missing config
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {skill.missingConfig.map((path) => (
                      <code
                        key={path}
                        className="rounded border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2 py-0.5 text-xs text-[var(--status-warning-text)]"
                      >
                        {path}
                      </code>
                    ))}
                  </div>
                </div>
              )}

              {/* Install options */}
              {hasInstall && (
                <div>
                  <p className="mb-2 text-xs font-medium text-[var(--text-dim)]">
                    Install
                  </p>
                  <div className="space-y-2">
                    {skill.installEntries.map((entry) => (
                      <InstallButton
                        key={entry.id}
                        skillId={skill.id}
                        entry={entry}
                        onDone={onChanged}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Plugin config editor */}
              {hasConfig && (
                <div>
                  <p className="mb-2 text-xs font-medium text-[var(--text-dim)]">
                    Plugin config
                  </p>
                  <ConfigEditor
                    skillId={skill.id}
                    initial={skill.pluginConfig}
                    onSaved={onChanged}
                  />
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
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => () => stopPolling(), []);

  const restart = async () => {
    setState("restarting");
    try {
      await apiFetch("/api/gateway/restart", { method: "POST" });
    } catch {
      // 502s are expected while the gateway restarts — treat as success.
    }
    setState("polling");

    // Poll until the gateway is back up, with a 60 s timeout.
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 30) {
        stopPolling();
        setState("error");
        return;
      }
      try {
        const { ready } = await apiFetch("/api/gateway/restart/status");
        if (ready) {
          stopPolling();
          setState("done");
          onRestarted();
        }
      } catch {}
    }, 2_000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: EASE }}
      className="mb-6 flex items-center gap-4 rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-5 py-3.5"
    >
      <AlertTriangleIcon className="size-4 shrink-0 text-[var(--status-warning)]" />
      <p className="flex-1 text-sm text-[var(--status-warning-text)]">
        {state === "polling"
          ? "Restarting gateway…"
          : state === "done"
            ? "Gateway restarted."
            : state === "error"
              ? "Restart timed out — gateway may still be starting."
              : "Changes require a gateway restart to take effect."}
      </p>
      {(state === "idle" || state === "error") && (
        <button
          onClick={restart}
          className="flex items-center gap-1.5 rounded-md border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-1.5 text-xs font-medium text-[var(--status-warning-text)] transition-colors hover:bg-[var(--status-warning)]/20"
        >
          <RotateCcwIcon className="size-3" />
          Restart now
        </button>
      )}
      {state === "polling" && (
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

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const handleChanged = useCallback(() => {
    setPendingRestart(true);
    fetchSkills();
  }, [fetchSkills]);

  const handleRestarted = useCallback(() => {
    setPendingRestart(false);
    // Brief pause before re-fetching so the gateway is fully up.
    setTimeout(fetchSkills, 1_000);
  }, [fetchSkills]);

  const ready = skills.filter((s) => s.status === "ready").length;
  const total = skills.length;

  return (
    <div className="h-[100svh] overflow-y-auto">
    <div className="relative bg-[var(--bg)] text-[var(--text)]">
      <div className="relative z-10 mx-auto max-w-[820px] px-8 py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          {/* Page header */}
          <div className="mb-8">
            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">Skills</h1>
              {!loading && total > 0 && (
                <span className="font-mono text-sm text-[var(--muted)]">
                  {ready}/{total} ready
                </span>
              )}
            </div>
            <p className="mt-1.5 text-sm text-[var(--text-dim)]">
              Manage the skills available to your OpenClaw instance.
            </p>
          </div>

          {/* Restart banner */}
          <AnimatePresence>
            {pendingRestart && (
              <RestartBanner onRestarted={handleRestarted} />
            )}
          </AnimatePresence>

          {/* Loading */}
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-[72px] animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)]"
                />
              ))}
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="flex items-center gap-3 rounded-xl border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-5 py-4">
              <XCircleIcon className="size-4 shrink-0 text-[var(--status-error)]" />
              <p className="text-sm text-[var(--status-error-text)]">{error}</p>
            </div>
          )}

          {/* Skills list */}
          {!loading && !error && (
            <div className="space-y-3">
              {skills.length === 0 ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 py-10 text-center">
                  <p className="text-sm text-[var(--muted)]">
                    No skills found in{" "}
                    <code className="font-mono">/app/skills/</code>
                  </p>
                </div>
              ) : (
                skills.map((skill) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    onChanged={handleChanged}
                  />
                ))
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
    </div>
  );
}
