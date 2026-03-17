"use client";

import UserPill from "@/components/user-pill";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { NoiseGrain } from "@/components/bg-effects";

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

function Mono({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`font-[var(--font-dm-mono),monospace] ${className}`}>
      {children}
    </span>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
      {children}
    </div>
  );
}

function CardHeader({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[var(--surface-hi)]">
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

  const statusStyles = {
    operational: {
      bg: "rgba(109,191,139,0.12)",
      color: "#6dbf8b",
      border: "rgba(109,191,139,0.25)",
    },
    degraded: {
      bg: "rgba(200,132,90,0.12)",
      color: "var(--copper)",
      border: "rgba(200,132,90,0.25)",
    },
    checking: {
      bg: "rgba(107,92,78,0.15)",
      color: "var(--muted)",
      border: "var(--border)",
    },
  }[overallStatus];

  return (
    <Card>
      <CardHeader
        right={
          <button
            onClick={runChecks}
            disabled={checking}
            className="bg-transparent border border-[var(--border)] rounded text-[var(--muted)] font-[var(--font-dm-mono),monospace] text-[0.62rem] px-[0.6rem] py-1 tracking-[0.06em] transition-colors hover:border-[var(--border-hi)] hover:text-[var(--text)] disabled:cursor-not-allowed cursor-pointer"
          >
            {checking ? "checking…" : "refresh"}
          </button>
        }
      >
        <div className="flex items-center gap-[0.6rem]">
          <Mono className="text-[0.7rem] text-[var(--muted)]">System Health</Mono>
          <span
            className="font-[var(--font-dm-mono),monospace] text-[0.6rem] tracking-[0.1em] px-2 py-[0.15rem] rounded-full border"
            style={{ background: statusStyles.bg, color: statusStyles.color, borderColor: statusStyles.border }}
          >
            {overallStatus}
          </span>
        </div>
      </CardHeader>

      {checks.map((check, i) => (
        <div
          key={check.endpoint}
          className="flex items-center justify-between px-5 py-[0.85rem]"
          style={{ borderBottom: i < checks.length - 1 ? "1px solid var(--border)" : undefined }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-[6px] h-[6px] rounded-full shrink-0"
              style={{
                background: check.ok === null ? "var(--muted)" : check.ok ? "#6dbf8b" : "#c0504d",
                boxShadow: check.ok === true ? "0 0 6px rgba(109,191,139,0.5)" : check.ok === false ? "0 0 6px rgba(192,80,77,0.5)" : "none",
              }}
            />
            <Mono className="text-[0.75rem] text-[var(--text)]">{check.label}</Mono>
            <Mono className="text-[0.65rem] text-[var(--muted)]">{check.endpoint}</Mono>
          </div>
          <div className="flex items-center gap-4">
            {check.latencyMs !== null && (
              <Mono
                className="text-[0.68rem]"
                style={{ color: check.latencyMs < 100 ? "#6dbf8b" : check.latencyMs < 300 ? "var(--copper)" : "#c0504d" } as React.CSSProperties}
              >
                {check.latencyMs}ms
              </Mono>
            )}
            <Mono
              className="text-[0.65rem]"
              style={{ color: check.ok === null ? "var(--muted)" : check.ok ? "#6dbf8b" : "#c0504d" } as React.CSSProperties}
            >
              {check.ok === null ? "—" : check.ok ? "ok" : "error"}
            </Mono>
          </div>
        </div>
      ))}

      {lastChecked && (
        <div className="px-5 py-2 border-t border-[var(--border)] bg-[var(--bg)]">
          <Mono className="text-[0.58rem] text-[var(--muted)]">
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

      <div className="fixed top-5 right-6 z-10">
        <UserPill />
      </div>

      <div className="relative z-10 max-w-[480px] mx-auto px-8 py-20">
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
