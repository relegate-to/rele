"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMachinesContext } from "../_context/machines-context";

const STATUSES = ["Connecting to instance", "Authenticating", "Loading interface"];

function LoadingOverlay({ visible }: { visible: boolean }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % STATUSES.length), 1800);
    return () => clearInterval(id);
  }, [visible]);

  // r=22 → circumference ≈ 138.2; arc=55 fills ~144° (40%)
  const R = 22;
  const arc = 55;
  const gap = Math.PI * 2 * R - arc;

  return (
    <>
      <style>{`
        @keyframes ctrl-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes ctrl-status-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ctrl-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        .ctrl-spinner { animation: ctrl-spin 1.1s linear infinite; transform-origin: center; }
        .ctrl-status  { animation: ctrl-status-in 0.28s ease-out; }
        .ctrl-blink   { animation: ctrl-blink 1s step-end infinite; }
      `}</style>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "18px",
          background: "var(--bg)",
          zIndex: 10,
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? "auto" : "none",
          transition: "opacity 0.45s ease",
        }}
      >
        {/* Spinner */}
        <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden>
          <circle cx="26" cy="26" r={R} stroke="var(--border)" strokeWidth="2" />
          <circle
            cx="26"
            cy="26"
            r={R}
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={`${arc} ${gap}`}
            className="ctrl-spinner"
            style={{ filter: "drop-shadow(0 0 5px var(--accent))" }}
          />
        </svg>

        {/* Cycling status line */}
        <div style={{ height: 17, overflow: "hidden" }}>
          <p
            key={idx}
            className="ctrl-status"
            style={{
              fontFamily: "var(--font-dm-mono), ui-monospace, monospace",
              fontSize: "11.5px",
              letterSpacing: "0.06em",
              color: "var(--muted)",
              whiteSpace: "nowrap",
            }}
          >
            {STATUSES[idx]}
            <span className="ctrl-blink" style={{ marginLeft: "2px" }}>_</span>
          </p>
        </div>
      </div>
    </>
  );
}

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
    if (!machine) { router.replace("/console/chat"); return; }
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
    <div className="relative h-[100svh] w-full overflow-hidden">
      <LoadingOverlay visible={!iframeReady} />

      {src && (
        <iframe
          src={src}
          className="absolute inset-0 border-0 transition-opacity duration-500"
          style={{ opacity: iframeReady ? 1 : 0, width: "100%", height: "100%" }}
          allow="clipboard-read; clipboard-write"
          onLoad={() => {
            setTimeout(() => setIframeReady(true), 500);
          }}
        />
      )}
    </div>
  );
}
