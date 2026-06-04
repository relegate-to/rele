"use client";

// Binary-install button (apt/brew/npm/etc., chosen by `entry.kind`).
// Posts to the sidecar to start an install job, then polls /api/skills/install/<jobId>
// every 500ms for status + accumulated stdout/stderr.

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2Icon, DownloadIcon, RefreshCwIcon } from "lucide-react";
import { EASE } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { type InstallEntry } from "../_lib/skills";
import {
  getInstallJob,
  startInstallJob,
  subscribeInstallJob,
  type InstallJobState,
} from "../_lib/install-jobs";

type InstallState = InstallJobState;

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
  const initial = getInstallJob(skillId, entry.id);
  const [state, setState] = useState<InstallState>(initial.state);
  const [output, setOutput] = useState<string | null>(initial.output);
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    // Notify parent on mount if a job is already in progress (so the dialog
    // can collapse the other entries again).
    const cur = getInstallJob(skillId, entry.id);
    if (cur.state !== "idle") onStateChangeRef.current?.(cur.state);
    return subscribeInstallJob(skillId, entry.id, (job) => {
      setState(job.state);
      setOutput(job.output);
      onStateChangeRef.current?.(job.state);
    });
  }, [skillId, entry.id]);

  const install = () => {
    void startInstallJob(skillId, entry.id, () => onDoneRef.current());
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
