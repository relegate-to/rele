"use client";

import { NoiseGrain, Vignette } from "@/components/bg-effects";
import UserPill from "@/components/user-pill";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";

const GATE_PROXY = "/api/gate";
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// ── Types ─────────────────────────────────────────────────────────────────────

type HealthCheck = {
  label: string;
  endpoint: string;
  ok: boolean | null;
  latencyMs: number | null;
};

// ── Sub-components ────────────────────────────────────────────────────────────

function Mono({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={`font-[var(--font-dm-mono),monospace] ${className}`} style={style}>
      {children}
    </span>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden shadow-sm">
      {children}
    </div>
  );
}

function CardHeader({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)] bg-[var(--surface-hi)]">
      <div>{children}</div>
      {right && <div>{right}</div>}
    </div>
  );
}

// ── Health Panel ──────────────────────────────────────────────────────────────

function HealthPanel() {
  const [checks, setChecks] = useState<HealthCheck[]>([
    { label: "API Gateway", endpoint: "/health", ok: null, latencyMs: null },
    { label: "Auth Service", endpoint: "/me", ok: null, latencyMs: null },
  ]);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [checking, setChecking] = useState(false);

  const runChecks = useCallback(async () => {
    setChecking(true);
    const results = await Promise.all([
      (async () => {
        const t0 = performance.now();
        try {
          const r = await fetch(`${GATE_PROXY}/health`);
          return { ok: r.ok, latencyMs: Math.round(performance.now() - t0) };
        } catch {
          return { ok: false, latencyMs: null };
        }
      })(),
      (async () => {
        const t0 = performance.now();
        try {
          const r = await fetch(`${GATE_PROXY}/me`);
          return { ok: r.ok, latencyMs: Math.round(performance.now() - t0) };
        } catch {
          return { ok: false, latencyMs: null };
        }
      })(),
    ]);

    setChecks((prev) =>
      prev.map((c, i) => ({ ...c, ok: results[i].ok, latencyMs: results[i].latencyMs }))
    );
    setLastChecked(new Date());
    setChecking(false);
  }, []);

  useEffect(() => {
    runChecks();
    const id = setInterval(runChecks, 30_000);
    return () => clearInterval(id);
  }, [runChecks]);

  const allOk = checks.every((c) => c.ok === true);
  const anyNull = checks.some((c) => c.ok === null);
  const overallStatus = anyNull ? "checking" : allOk ? "operational" : "degraded";

  const statusKey = overallStatus === "operational" ? "success" : overallStatus === "degraded" ? "warning" : "neutral";

  function dotColor(ok: boolean | null) {
    if (ok === null) return "var(--status-neutral)";
    return ok ? "var(--status-success)" : "var(--status-error)";
  }

  function dotShadow(ok: boolean | null) {
    if (ok === true)  return "0 0 8px color-mix(in srgb, var(--status-success) 60%, transparent)";
    if (ok === false) return "0 0 8px color-mix(in srgb, var(--status-error) 60%, transparent)";
    return "none";
  }

  function latencyColor(ms: number) {
    if (ms < 100) return "var(--status-success)";
    if (ms < 300) return "var(--status-warning)";
    return "var(--status-error)";
  }

  function statusColor(ok: boolean | null) {
    if (ok === null) return "var(--status-neutral-text)";
    return ok ? "var(--status-success-text)" : "var(--status-error-text)";
  }

  return (
    <Card>
      <CardHeader
        right={
          <button
            onClick={runChecks}
            disabled={checking}
            className="bg-transparent border border-[var(--border)] rounded-md text-[var(--muted)] font-[var(--font-dm-mono),monospace] text-xs px-3 py-1.5 tracking-wide transition-all hover:border-[var(--border-hi)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            {checking ? "checking…" : "refresh"}
          </button>
        }
      >
        <div className="flex items-center gap-3">
          <span className="font-[var(--font-dm-mono),monospace] text-sm font-medium text-[var(--text)]">
            System Health
          </span>
          <span
            className="font-[var(--font-dm-mono),monospace] text-xs tracking-widest px-2.5 py-0.5 rounded-full border"
            style={{
              background: `var(--status-${statusKey}-bg)`,
              color: `var(--status-${statusKey}-text)`,
              borderColor: `var(--status-${statusKey}-border)`,
            }}
          >
            {overallStatus}
          </span>
        </div>
      </CardHeader>

      {checks.map((check, i) => (
        <div
          key={check.endpoint}
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: i < checks.length - 1 ? "1px solid var(--border)" : undefined }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: dotColor(check.ok), boxShadow: dotShadow(check.ok) }}
            />
            <span className="font-[var(--font-dm-mono),monospace] text-sm text-[var(--text)]">
              {check.label}
            </span>
            <span className="font-[var(--font-dm-mono),monospace] text-xs text-[var(--muted)]">
              {check.endpoint}
            </span>
          </div>
          <div className="flex items-center gap-5">
            {check.latencyMs !== null && (
              <Mono
                className="text-xs tabular-nums"
                style={{ color: latencyColor(check.latencyMs) } as React.CSSProperties}
              >
                {check.latencyMs}ms
              </Mono>
            )}
            <Mono
              className="text-xs w-8 text-right"
              style={{ color: statusColor(check.ok) } as React.CSSProperties}
            >
              {check.ok === null ? "—" : check.ok ? "ok" : "error"}
            </Mono>
          </div>
        </div>
      ))}

      {lastChecked && (
        <div className="px-6 py-2.5 border-t border-[var(--border)] bg-[var(--bg)]">
          <Mono className="text-xs text-[var(--muted)]">
            Last checked{" "}
            {lastChecked.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </Mono>
        </div>
      )}
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-[var(--font-crimson-pro),serif] font-light">
      <NoiseGrain />
      <Vignette />

      <div className="fixed top-5 right-6 z-10">
        <UserPill />
      </div>

      <div className="relative z-10 max-w-[520px] mx-auto px-8 py-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <HealthPanel />
        </motion.div>
      </div>
    </div>
  );
}
