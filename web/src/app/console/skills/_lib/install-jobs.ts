// Module-level registry of in-flight install jobs so polling and output
// survive when the skill dialog is closed and reopened.

import { apiFetch } from "./skills";

export type InstallJobState = "idle" | "running" | "done" | "error";

export interface InstallJob {
  state: InstallJobState;
  output: string | null;
  jobId: string | null;
}

type Listener = (job: InstallJob) => void;

interface JobRecord extends InstallJob {
  listeners: Set<Listener>;
  pollTimer: ReturnType<typeof setInterval> | null;
}

const jobs = new Map<string, JobRecord>();

function key(skillId: string, entryId: string) {
  return `${skillId}:${entryId}`;
}

function snapshot(rec: JobRecord): InstallJob {
  return { state: rec.state, output: rec.output, jobId: rec.jobId };
}

function emit(rec: JobRecord) {
  const snap = snapshot(rec);
  rec.listeners.forEach((l) => l(snap));
}

function stopPolling(rec: JobRecord) {
  if (rec.pollTimer) {
    clearInterval(rec.pollTimer);
    rec.pollTimer = null;
  }
}

function startPolling(rec: JobRecord, jobId: string, onDone: () => void) {
  stopPolling(rec);
  rec.pollTimer = setInterval(async () => {
    try {
      const job = await apiFetch(`/api/skills/install/${jobId}`);
      if (job.output) {
        rec.output = job.output;
        emit(rec);
      }
      if (job.status === "done") {
        rec.state = "done";
        stopPolling(rec);
        emit(rec);
        onDone();
      } else if (job.status === "error") {
        rec.state = "error";
        rec.output = job.output || job.error || rec.output;
        stopPolling(rec);
        emit(rec);
      }
    } catch {}
  }, 500);
}

export function getInstallJob(skillId: string, entryId: string): InstallJob {
  const rec = jobs.get(key(skillId, entryId));
  return rec ? snapshot(rec) : { state: "idle", output: null, jobId: null };
}

export function subscribeInstallJob(
  skillId: string,
  entryId: string,
  listener: Listener,
): () => void {
  const k = key(skillId, entryId);
  let rec = jobs.get(k);
  if (!rec) {
    rec = { state: "idle", output: null, jobId: null, listeners: new Set(), pollTimer: null };
    jobs.set(k, rec);
  }
  rec.listeners.add(listener);
  return () => {
    const r = jobs.get(k);
    if (!r) return;
    r.listeners.delete(listener);
  };
}

export async function startInstallJob(
  skillId: string,
  entryId: string,
  onDone: () => void,
): Promise<void> {
  const k = key(skillId, entryId);
  let rec = jobs.get(k);
  if (!rec) {
    rec = { state: "idle", output: null, jobId: null, listeners: new Set(), pollTimer: null };
    jobs.set(k, rec);
  }
  if (rec.state === "running") return;
  rec.state = "running";
  rec.output = null;
  rec.jobId = null;
  emit(rec);
  try {
    const { jobId } = await apiFetch(`/api/skills/${skillId}/install/${entryId}`, { method: "POST" });
    rec.jobId = jobId;
    startPolling(rec, jobId, onDone);
  } catch (err) {
    rec.state = "error";
    rec.output = err instanceof Error ? err.message : "Failed to start";
    emit(rec);
  }
}
