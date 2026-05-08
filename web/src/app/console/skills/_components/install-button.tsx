"use client";

// Binary-install button (apt/brew/npm/etc., chosen by `entry.kind`).
// Posts to the sidecar to start an install job, then polls /api/skills/install/<jobId>
// every 500ms for status + accumulated stdout/stderr.

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2Icon, DownloadIcon, RefreshCwIcon } from "lucide-react";
import { EASE } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { apiFetch, type InstallEntry } from "../_lib/skills";

type InstallState = "idle" | "running" | "done" | "error";

export function InstallButton({
  skillId,
  entry,
  onDone,
  onStateChange,
}: {
  skillId: string;
  entry: InstallEntry;
  onDone: () => void;
  onStateChange?: (state: InstallState) => void;
}) {
  const [state, setState] = useState<InstallState>("idle");
  const [output, setOutput] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };
  useEffect(() => () => stopPolling(), []);

  const setStateAndNotify = (s: InstallState) => {
    setState(s);
    onStateChange?.(s);
  };

  const install = async () => {
    setStateAndNotify("running");
    setOutput(null);
    try {
      const { jobId } = await apiFetch(`/api/skills/${skillId}/install/${entry.id}`, { method: "POST" });
      pollRef.current = setInterval(async () => {
        try {
          const job = await apiFetch(`/api/skills/install/${jobId}`);
          if (job.output) setOutput(job.output);
          if (job.status === "done") {
            stopPolling();
            setStateAndNotify("done");
            onDone();
          } else if (job.status === "error") {
            stopPolling();
            setOutput(job.output || job.error || null);
            setStateAndNotify("error");
          }
        } catch {}
      }, 500);
    } catch (err) {
      setOutput(err instanceof Error ? err.message : "Failed to start");
      setStateAndNotify("error");
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={install}
        disabled={state === "running" || state === "done"}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50",
          state === "done"
            ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
            : state === "error"
              ? "border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[var(--status-error-text)]"
              : "border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:border-[var(--border-hi)]",
        )}
      >
        {state === "running" ? <RefreshCwIcon className="size-3.5 animate-spin" />
         : state === "done"  ? <CheckCircle2Icon className="size-3.5" />
                              : <DownloadIcon className="size-3.5" />}
        {state === "running" ? "Installing…" : state === "done" ? "Installed" : entry.label}
      </button>
      <AnimatePresence>
        {(state === "running" || output) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="overflow-hidden"
          >
            <pre className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-mono text-[11px] text-[var(--text-dim)] whitespace-pre-wrap break-all h-40 overflow-y-auto">
              {output ?? <span className="animate-pulse">…</span>}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
