"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "../_context/i18n-context";

const GATE_PROXY = "/api/gate";

// ── Types ─────────────────────────────────────────────────────────────────────

type HealthCheck = {
  labelKey: string;
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

export function HealthPanel() {
  const { t } = useTranslation();
  const [checks, setChecks] = useState<HealthCheck[]>([
    { labelKey: "health.api-gateway", endpoint: "/health", ok: null, latencyMs: null },
    { labelKey: "health.auth-service", endpoint: "/me", ok: null, latencyMs: null },
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
            {checking ? t("health.checking") : t("health.refresh")}
          </button>
        }
      >
        <div className="flex items-center gap-3">
          <span className="font-[var(--font-dm-mono),monospace] text-sm font-medium text-[var(--text)]">
            {t("health.title")}
          </span>
          <span
            className="font-[var(--font-dm-mono),monospace] text-xs tracking-widest px-2.5 py-0.5 rounded-full border"
            style={{
              background: `var(--status-${statusKey}-bg)`,
              color: `var(--status-${statusKey}-text)`,
              borderColor: `var(--status-${statusKey}-border)`,
            }}
          >
            {t(`health.status.${overallStatus}`)}
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
              {t(check.labelKey)}
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
              {check.ok === null ? "—" : check.ok ? t("health.ok") : t("health.error")}
            </Mono>
          </div>
        </div>
      ))}

      {lastChecked && (
        <div className="px-6 py-2.5 border-t border-[var(--border)] bg-[var(--bg)]">
          <Mono className="text-xs text-[var(--muted)]">
            {t("health.last-checked")}{" "}
            {lastChecked.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </Mono>
        </div>
      )}
    </Card>
  );
}
