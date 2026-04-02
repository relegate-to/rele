"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMachinesContext } from "../_context/machines-context";

export default function ControlUiPage() {
  const { machines, loading } = useMachinesContext();
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const router = useRouter();
  const fetched = useRef(false);

  const machine = machines[0] ?? null;
  const isRunning = machine?.state === "started" || machine?.state === "running";

  useEffect(() => {
    if (loading) return;
    if (!machine) { router.replace("/console/dashboard"); return; }
    if (!isRunning) { setError("Instance is not running."); return; }
    if (fetched.current) return;
    fetched.current = true;

    fetch("/api/gate/ws-auth")
      .then((r) => r.ok ? r.json() : r.json().then((e: { error?: string }) => Promise.reject(e.error ?? "Failed")))
      .then(({ url, token, gatewayToken }: { url: string; token: string; gatewayToken: string }) => {
        const httpBase = url.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
        setSrc(`${httpBase}/__openclaw__/?jwt=${encodeURIComponent(token)}&token=${encodeURIComponent(gatewayToken)}`);
      })
      .catch((e: unknown) => setError(typeof e === "string" ? e : "Failed to get connection info."));
  }, [loading, machine, isRunning, router]);

  if (error) {
    return (
      <div className="flex h-[100svh] items-center justify-center">
        <p className="font-mono text-sm text-[var(--status-error-text)]">{error}</p>
      </div>
    );
  }

  return (
    <div className="h-[100svh] w-full">
      {src && (
        <iframe
          src={src}
          className="h-full w-full border-0 transition-opacity duration-500"
          style={{ opacity: iframeReady ? 1 : 0 }}
          allow="clipboard-read; clipboard-write"
          onLoad={() => setIframeReady(true)}
        />
      )}
    </div>
  );
}
