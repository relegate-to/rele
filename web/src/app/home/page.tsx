"use client";

import { C } from "@/lib/theme";
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

function GrainOverlay() {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        mixBlendMode: "overlay" as React.CSSProperties["mixBlendMode"],
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E")`,
        backgroundSize: "512px 512px",
      }}
    />
  );
}

function Mono({
  children,
  size = "0.72rem",
  color = C.text,
  style,
}: {
  children: React.ReactNode;
  size?: string;
  color?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={{
        fontFamily: "var(--font-dm-mono), monospace",
        fontSize: size,
        color,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: "8px",
        overflow: "hidden",
        ...style,
      }}
    >
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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "1rem 1.25rem",
        borderBottom: `1px solid ${C.border}`,
        background: C.surfaceHi,
      }}
    >
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
          const ok = r.ok;
          return { ok, latencyMs: Math.round(performance.now() - t0) };
        } catch {
          return { ok: false, latencyMs: null };
        }
      })(),
      (async () => {
        const t0 = performance.now();
        try {
          const r = await fetch(`${GATE_PROXY}/me`);
          const ok = r.ok;
          return { ok, latencyMs: Math.round(performance.now() - t0) };
        } catch {
          return { ok: false, latencyMs: null };
        }
      })(),
    ]);

    setChecks((prev) =>
      prev.map((c, i) => ({
        ...c,
        ok: results[i].ok,
        latencyMs: results[i].latencyMs,
      })),
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
  const overallStatus = anyNull
    ? "checking"
    : allOk
      ? "operational"
      : "degraded";

  return (
    <Card>
      <CardHeader
        right={
          <button
            onClick={runChecks}
            disabled={checking}
            style={{
              background: "transparent",
              border: `1px solid ${C.border}`,
              borderRadius: "4px",
              color: C.muted,
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: "0.62rem",
              padding: "0.25rem 0.6rem",
              cursor: checking ? "not-allowed" : "pointer",
              letterSpacing: "0.06em",
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = C.borderHi;
              e.currentTarget.style.color = C.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = C.border;
              e.currentTarget.style.color = C.muted;
            }}
          >
            {checking ? "checking…" : "refresh"}
          </button>
        }
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <Mono size="0.7rem" color={C.muted}>
            System Health
          </Mono>
          <span
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: "0.6rem",
              letterSpacing: "0.1em",
              padding: "0.15rem 0.5rem",
              borderRadius: "999px",
              background:
                overallStatus === "operational"
                  ? "rgba(109,191,139,0.12)"
                  : overallStatus === "degraded"
                    ? "rgba(200,132,90,0.12)"
                    : "rgba(107,92,78,0.15)",
              color:
                overallStatus === "operational"
                  ? "#6dbf8b"
                  : overallStatus === "degraded"
                    ? C.copper
                    : C.muted,
              border: `1px solid ${
                overallStatus === "operational"
                  ? "rgba(109,191,139,0.25)"
                  : overallStatus === "degraded"
                    ? "rgba(200,132,90,0.25)"
                    : C.border
              }`,
            }}
          >
            {overallStatus}
          </span>
        </div>
      </CardHeader>
      {checks.map((check, i) => (
        <div
          key={check.endpoint}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.85rem 1.25rem",
            borderBottom:
              i < checks.length - 1 ? `1px solid ${C.border}` : undefined,
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
          >
            <div
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background:
                  check.ok === null
                    ? C.muted
                    : check.ok
                      ? "#6dbf8b"
                      : "#c0504d",
                flexShrink: 0,
                boxShadow:
                  check.ok === true
                    ? "0 0 6px rgba(109,191,139,0.5)"
                    : check.ok === false
                      ? "0 0 6px rgba(192,80,77,0.5)"
                      : "none",
              }}
            />
            <Mono size="0.75rem">{check.label}</Mono>
            <Mono size="0.65rem" color={C.muted}>
              {check.endpoint}
            </Mono>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            {check.latencyMs !== null && (
              <Mono
                size="0.68rem"
                color={
                  check.latencyMs < 100
                    ? "#6dbf8b"
                    : check.latencyMs < 300
                      ? C.copper
                      : "#c0504d"
                }
              >
                {check.latencyMs}ms
              </Mono>
            )}
            <Mono
              size="0.65rem"
              color={
                check.ok === null ? C.muted : check.ok ? "#6dbf8b" : "#c0504d"
              }
            >
              {check.ok === null ? "—" : check.ok ? "ok" : "error"}
            </Mono>
          </div>
        </div>
      ))}
      {lastChecked && (
        <div
          style={{
            padding: "0.5rem 1.25rem",
            borderTop: `1px solid ${C.border}`,
            background: C.bg,
          }}
        >
          <Mono size="0.58rem" color={C.muted}>
            Last checked{" "}
            {lastChecked.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </Mono>
        </div>
      )}
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div
      style={{
        background: C.bg,
        color: C.text,
        minHeight: "100vh",
        fontFamily: "var(--font-crimson-pro), serif",
        fontWeight: 300,
      }}
    >
      <GrainOverlay />

      {/* User pill */}
      <div
        style={{
          position: "fixed",
          top: "1.25rem",
          right: "1.5rem",
          zIndex: 10,
        }}
      >
        <UserPill />
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "480px",
          margin: "0 auto",
          padding: "5rem 2rem",
        }}
      >
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
