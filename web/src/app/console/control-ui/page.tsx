"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMachinesContext } from "../_context/machines-context";

export default function ControlUiPage() {
  const { machines, loading } = useMachinesContext();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const machine = machines[0] ?? null;
  const isRunning = machine?.state === "started" || machine?.state === "running";

  useEffect(() => {
    if (loading) return;
    if (!machine) { router.replace("/console/dashboard"); return; }
    if (!isRunning) { setError("Instance is not running."); return; }

    fetch("/api/gate/ws-auth")
      .then((r) => r.ok ? r.json() : r.json().then((e: { error?: string }) => Promise.reject(e.error ?? "Failed")))
      .then(({ url, token, gatewayToken }: { url: string; token: string; gatewayToken: string }) => {
        const httpBase = url.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
        window.location.href = `${httpBase}/__openclaw__/?jwt=${encodeURIComponent(token)}&token=${encodeURIComponent(gatewayToken)}`;
      })
      .catch((e: unknown) => setError(typeof e === "string" ? e : "Failed to get connection info."));
  }, [loading, machine, isRunning, router]);

  if (error) {
    return (
      <div className="flex h-[calc(100svh-3rem)] items-center justify-center">
        <p className="font-mono text-sm text-[var(--status-error-text)]">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100svh-3rem)] items-center justify-center">
      <p className="font-mono text-sm text-[var(--muted)]">Opening control UI…</p>
    </div>
  );
}
