"use client";

import { C } from "@/lib/theme";
import UserPill from "@/components/user-pill";
import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
// All backend calls go through the server-side proxy at /api/gate.
// The proxy validates the session and injects the JWT — neither is ever
// visible to the browser.
const GATE_PROXY = "/api/gate";
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// ── Types ─────────────────────────────────────────────────────────────────────

type InstanceStatus = "running" | "stopped" | "degraded" | "provisioning";

type Instance = {
  id: string;
  name: string;
  region: string;
  status: InstanceStatus;
  uptime: string;
  requests: number;
  latencyMs: number;
  createdAt: string;
};

type HealthCheck = {
  label: string;
  endpoint: string;
  ok: boolean | null;
  latencyMs: number | null;
};

// ── Mock data (UI-only placeholders) ─────────────────────────────────────────

const MOCK_INSTANCES: Instance[] = [
  {
    id: "inst_01",
    name: "production",
    region: "us-east-1",
    status: "running",
    uptime: "14d 3h",
    requests: 84231,
    latencyMs: 42,
    createdAt: "2026-03-01",
  },
  {
    id: "inst_02",
    name: "staging",
    region: "eu-west-2",
    status: "degraded",
    uptime: "2d 11h",
    requests: 1204,
    latencyMs: 218,
    createdAt: "2026-03-13",
  },
];

const REGIONS = [
  "us-east-1",
  "us-west-2",
  "eu-west-1",
  "eu-west-2",
  "ap-southeast-1",
  "ap-northeast-1",
];

const PLANS = ["hobby", "pro", "enterprise"];

// ── Utilities ─────────────────────────────────────────────────────────────────

function statusColor(s: InstanceStatus): string {
  return s === "running"
    ? "#6dbf8b"
    : s === "degraded"
      ? "#c8845a"
      : s === "provisioning"
        ? "#8ab4d8"
        : C.muted;
}

function statusLabel(s: InstanceStatus): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmt(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

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

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: "var(--font-dm-mono), monospace",
        fontSize: "0.58rem",
        color: C.muted,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        marginBottom: "0.35rem",
      }}
    >
      {children}
    </p>
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

function StatusDot({ status }: { status: InstanceStatus }) {
  const color = statusColor(status);
  const pulse = status === "running" || status === "provisioning";
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "8px",
        height: "8px",
        flexShrink: 0,
      }}
    >
      {pulse && (
        <span
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: color,
            opacity: 0.3,
            animation: "ping 1.8s ease-in-out infinite",
          }}
        />
      )}
      <span
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: color,
          display: "block",
          flexShrink: 0,
        }}
      />
    </span>
  );
}

function inputCss(): React.CSSProperties {
  return {
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: "5px",
    color: C.text,
    fontFamily: "var(--font-dm-mono), monospace",
    fontSize: "0.78rem",
    padding: "0.55rem 0.75rem",
    width: "100%",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  };
}

function selectCss(): React.CSSProperties {
  return {
    ...inputCss(),
    appearance: "none" as React.CSSProperties["appearance"],
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%236b5c4e'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 0.75rem center",
    paddingRight: "2rem",
    cursor: "pointer",
  };
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

// ── Instance Card ─────────────────────────────────────────────────────────────

function InstanceCard({
  instance,
  onConfigure,
  onDelete,
}: {
  instance: Instance;
  onConfigure: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.35, ease: EASE }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? C.surfaceHi : C.surface,
        border: `1px solid ${hovered ? C.borderHi : C.border}`,
        borderRadius: "8px",
        overflow: "hidden",
        transition: "background 0.2s, border-color 0.2s",
        cursor: "default",
      }}
    >
      {/* Top accent line on hover */}
      <div
        style={{
          height: "2px",
          background: `linear-gradient(to right, transparent, ${statusColor(instance.status)}, transparent)`,
          opacity: hovered ? 0.6 : 0,
          transition: "opacity 0.3s",
        }}
      />

      <div style={{ padding: "1.1rem 1.25rem" }}>
        {/* Header row */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: "1rem",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "0.25rem",
              }}
            >
              <StatusDot status={instance.status} />
              <h3
                style={{
                  fontFamily: "var(--font-lora), serif",
                  fontWeight: 400,
                  fontSize: "1.05rem",
                  color: C.cream,
                  letterSpacing: "-0.01em",
                  margin: 0,
                }}
              >
                {instance.name}
              </h3>
            </div>
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <Mono size="0.65rem" color={C.muted}>
                {instance.id}
              </Mono>
              <span style={{ color: C.border }}>·</span>
              <Mono size="0.65rem" color={C.muted}>
                {instance.region}
              </Mono>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: "0.6rem",
                letterSpacing: "0.1em",
                padding: "0.2rem 0.55rem",
                borderRadius: "999px",
                background: `${statusColor(instance.status)}18`,
                color: statusColor(instance.status),
                border: `1px solid ${statusColor(instance.status)}40`,
              }}
            >
              {statusLabel(instance.status)}
            </span>
          </div>
        </div>

        {/* Metrics row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "0.75rem",
            marginBottom: "1rem",
            padding: "0.75rem",
            background: C.bg,
            borderRadius: "5px",
            border: `1px solid ${C.border}`,
          }}
        >
          <div>
            <Label>Uptime</Label>
            <Mono size="0.78rem" color={C.cream}>
              {instance.uptime}
            </Mono>
          </div>
          <div>
            <Label>Requests</Label>
            <Mono size="0.78rem" color={C.cream}>
              {fmt(instance.requests)}
            </Mono>
          </div>
          <div>
            <Label>Latency</Label>
            <Mono
              size="0.78rem"
              color={
                instance.latencyMs < 100
                  ? "#6dbf8b"
                  : instance.latencyMs < 300
                    ? C.copper
                    : "#c0504d"
              }
            >
              {instance.latencyMs}ms
            </Mono>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => onConfigure(instance.id)}
            style={{
              flex: 1,
              background: "transparent",
              border: `1px solid ${C.border}`,
              borderRadius: "5px",
              color: C.textDim,
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: "0.65rem",
              letterSpacing: "0.06em",
              padding: "0.4rem 0",
              cursor: "pointer",
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = C.borderHi;
              e.currentTarget.style.color = C.cream;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = C.border;
              e.currentTarget.style.color = C.textDim;
            }}
          >
            Configure
          </button>
          <button
            onClick={() => onDelete(instance.id)}
            style={{
              background: "transparent",
              border: `1px solid ${C.border}`,
              borderRadius: "5px",
              color: C.muted,
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: "0.65rem",
              letterSpacing: "0.06em",
              padding: "0.4rem 0.75rem",
              cursor: "pointer",
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#c0504d60";
              e.currentTarget.style.color = "#c0504d";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = C.border;
              e.currentTarget.style.color = C.muted;
            }}
          >
            Remove
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Create Instance Modal ─────────────────────────────────────────────────────

function CreateInstanceModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (i: Instance) => void;
}) {
  const [name, setName] = useState("");
  const [region, setRegion] = useState(REGIONS[0]);
  const [plan, setPlan] = useState(PLANS[1]);
  const [creating, setCreating] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    await new Promise((r) => setTimeout(r, 900)); // simulate async
    const newInstance: Instance = {
      id: `inst_${Date.now().toString(36)}`,
      name: name.trim() || "unnamed",
      region,
      status: "provisioning",
      uptime: "0m",
      requests: 0,
      latencyMs: 0,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    onCreate(newInstance);
    setCreating(false);
    onClose();
  };

  return (
    <motion.div
      ref={overlayRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,16,12,0.8)",
        backdropFilter: "blur(4px)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.3, ease: EASE }}
        style={{
          background: C.surface,
          border: `1px solid ${C.borderHi}`,
          borderRadius: "10px",
          width: "100%",
          maxWidth: "480px",
          overflow: "hidden",
        }}
      >
        {/* Modal header */}
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderBottom: `1px solid ${C.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: C.surfaceHi,
          }}
        >
          <div>
            <p
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: "0.55rem",
                color: C.copper,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                marginBottom: "0.2rem",
              }}
            >
              New Instance
            </p>
            <h2
              style={{
                fontFamily: "var(--font-lora), serif",
                fontWeight: 400,
                fontSize: "1.2rem",
                color: C.cream,
                letterSpacing: "-0.01em",
                margin: 0,
              }}
            >
              Create an Instance
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: C.muted,
              cursor: "pointer",
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: "1rem",
              lineHeight: 1,
              padding: "0.25rem",
            }}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleCreate}
          style={{
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.1rem",
          }}
        >
          <div>
            <Label>Instance Name</Label>
            <input
              style={inputCss()}
              placeholder="production"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              onFocus={(e) => (e.currentTarget.style.borderColor = C.borderHi)}
              onBlur={(e) => (e.currentTarget.style.borderColor = C.border)}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.75rem",
            }}
          >
            <div>
              <Label>Region</Label>
              <select
                style={selectCss()}
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r} style={{ background: C.surface }}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Plan</Label>
              <select
                style={selectCss()}
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
              >
                {PLANS.map((p) => (
                  <option key={p} value={p} style={{ background: C.surface }}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Preview pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.65rem 0.9rem",
              background: C.bg,
              border: `1px solid ${C.border}`,
              borderRadius: "5px",
            }}
          >
            <div
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#8ab4d8",
                flexShrink: 0,
              }}
            />
            <Mono size="0.7rem" color={C.textDim}>
              {name.trim() || "instance-name"}
            </Mono>
            <span style={{ color: C.border }}>·</span>
            <Mono size="0.65rem" color={C.muted}>
              {region}
            </Mono>
            <span style={{ color: C.border }}>·</span>
            <Mono size="0.65rem" color={C.muted}>
              {plan}
            </Mono>
          </div>

          <div
            style={{ display: "flex", gap: "0.5rem", paddingTop: "0.25rem" }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                background: "transparent",
                border: `1px solid ${C.border}`,
                borderRadius: "5px",
                color: C.muted,
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: "0.7rem",
                letterSpacing: "0.06em",
                padding: "0.65rem",
                cursor: "pointer",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = C.borderHi)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = C.border)
              }
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              style={{
                flex: 2,
                background: creating ? C.copperDim : C.copper,
                border: "none",
                borderRadius: "5px",
                color: C.bg,
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: "0.7rem",
                letterSpacing: "0.08em",
                fontWeight: 500,
                padding: "0.65rem",
                cursor: creating ? "not-allowed" : "pointer",
                transition: "background 0.15s, opacity 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!creating) e.currentTarget.style.opacity = "0.85";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
            >
              {creating ? "Provisioning…" : "Create Instance"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ── Configure Modal ───────────────────────────────────────────────────────────

function ConfigureModal({
  instance,
  onClose,
}: {
  instance: Instance;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"general" | "env" | "scaling">("general");
  const [autoscale, setAutoscale] = useState(true);
  const [maxWorkers, setMaxWorkers] = useState("4");
  const [timeout, setTimeout_] = useState("30");
  const [logLevel, setLogLevel] = useState("info");
  const [envVars, setEnvVars] = useState(
    "NODE_ENV=production\nLOG_FORMAT=json",
  );
  const overlayRef = useRef<HTMLDivElement>(null);

  const tabs: { id: typeof tab; label: string }[] = [
    { id: "general", label: "General" },
    { id: "env", label: "Environment" },
    { id: "scaling", label: "Scaling" },
  ];

  return (
    <motion.div
      ref={overlayRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,16,12,0.8)",
        backdropFilter: "blur(4px)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.3, ease: EASE }}
        style={{
          background: C.surface,
          border: `1px solid ${C.borderHi}`,
          borderRadius: "10px",
          width: "100%",
          maxWidth: "520px",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderBottom: `1px solid ${C.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: C.surfaceHi,
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "0.2rem",
              }}
            >
              <StatusDot status={instance.status} />
              <Mono
                size="0.55rem"
                color={C.copper}
                style={{ letterSpacing: "0.2em", textTransform: "uppercase" }}
              >
                Configure Instance
              </Mono>
            </div>
            <h2
              style={{
                fontFamily: "var(--font-lora), serif",
                fontWeight: 400,
                fontSize: "1.2rem",
                color: C.cream,
                letterSpacing: "-0.01em",
                margin: 0,
              }}
            >
              {instance.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: C.muted,
              cursor: "pointer",
              fontSize: "1rem",
              padding: "0.25rem",
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: `1px solid ${C.border}`,
            background: C.bg,
          }}
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: "transparent",
                border: "none",
                borderBottom:
                  tab === t.id
                    ? `2px solid ${C.copper}`
                    : "2px solid transparent",
                color: tab === t.id ? C.copper : C.muted,
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: "0.65rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                padding: "0.7rem 1.25rem",
                cursor: "pointer",
                transition: "color 0.15s",
                marginBottom: "-1px",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div
          style={{
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          {tab === "general" && (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0.75rem",
                }}
              >
                <div>
                  <Label>Region</Label>
                  <Mono size="0.75rem">{instance.region}</Mono>
                </div>
                <div>
                  <Label>Created</Label>
                  <Mono size="0.75rem">{instance.createdAt}</Mono>
                </div>
              </div>
              <div>
                <Label>Request Timeout (seconds)</Label>
                <input
                  style={inputCss()}
                  type="number"
                  min="1"
                  max="300"
                  value={timeout}
                  onChange={(e) => setTimeout_(e.target.value)}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = C.borderHi)
                  }
                  onBlur={(e) => (e.currentTarget.style.borderColor = C.border)}
                />
              </div>
              <div>
                <Label>Log Level</Label>
                <select
                  style={selectCss()}
                  value={logLevel}
                  onChange={(e) => setLogLevel(e.target.value)}
                >
                  {["debug", "info", "warn", "error"].map((l) => (
                    <option key={l} value={l} style={{ background: C.surface }}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {tab === "env" && (
            <div>
              <Label>Environment Variables</Label>
              <p
                style={{
                  fontFamily: "var(--font-crimson-pro), serif",
                  fontSize: "0.85rem",
                  color: C.muted,
                  marginBottom: "0.5rem",
                  lineHeight: 1.5,
                }}
              >
                One variable per line in KEY=VALUE format.
              </p>
              <textarea
                style={
                  {
                    ...inputCss(),
                    height: "140px",
                    resize: "vertical",
                    fontFamily: "var(--font-dm-mono), monospace",
                    fontSize: "0.72rem",
                    lineHeight: 1.6,
                  } as React.CSSProperties
                }
                value={envVars}
                onChange={(e) => setEnvVars(e.target.value)}
                onFocus={(e) =>
                  (e.currentTarget.style.borderColor = C.borderHi)
                }
                onBlur={(e) => (e.currentTarget.style.borderColor = C.border)}
                spellCheck={false}
              />
            </div>
          )}

          {tab === "scaling" && (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.75rem 1rem",
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: "5px",
                }}
              >
                <div>
                  <Mono size="0.72rem">Autoscale</Mono>
                  <p
                    style={{
                      fontFamily: "var(--font-crimson-pro), serif",
                      fontSize: "0.8rem",
                      color: C.muted,
                      margin: "0.15rem 0 0",
                    }}
                  >
                    Automatically adjust workers based on load
                  </p>
                </div>
                <button
                  onClick={() => setAutoscale((a) => !a)}
                  style={{
                    width: "36px",
                    height: "20px",
                    borderRadius: "999px",
                    background: autoscale ? C.copper : C.border,
                    border: "none",
                    cursor: "pointer",
                    position: "relative",
                    transition: "background 0.2s",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: "2px",
                      left: autoscale ? "18px" : "2px",
                      width: "16px",
                      height: "16px",
                      borderRadius: "50%",
                      background: C.cream,
                      transition: "left 0.2s",
                      display: "block",
                    }}
                  />
                </button>
              </div>
              <div>
                <Label>Max Workers</Label>
                <input
                  style={inputCss()}
                  type="number"
                  min="1"
                  max="64"
                  value={maxWorkers}
                  onChange={(e) => setMaxWorkers(e.target.value)}
                  disabled={!autoscale}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = C.borderHi)
                  }
                  onBlur={(e) => (e.currentTarget.style.borderColor = C.border)}
                />
              </div>
            </>
          )}

          {/* Save */}
          <div
            style={{ display: "flex", gap: "0.5rem", paddingTop: "0.25rem" }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                background: "transparent",
                border: `1px solid ${C.border}`,
                borderRadius: "5px",
                color: C.muted,
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: "0.7rem",
                letterSpacing: "0.06em",
                padding: "0.65rem",
                cursor: "pointer",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = C.borderHi)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = C.border)
              }
            >
              Discard
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 2,
                background: C.copper,
                border: "none",
                borderRadius: "5px",
                color: C.bg,
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: "0.7rem",
                letterSpacing: "0.08em",
                fontWeight: 500,
                padding: "0.65rem",
                cursor: "pointer",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              Save Changes
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [instances, setInstances] = useState<Instance[]>(MOCK_INSTANCES);
  const [showCreate, setShowCreate] = useState(false);
  const [configureId, setConfigureId] = useState<string | null>(null);

  const configureInstance = instances.find((i) => i.id === configureId) ?? null;

  const handleCreate = (newInstance: Instance) => {
    setInstances((prev) => [newInstance, ...prev]);
  };

  const handleDelete = (id: string) => {
    setInstances((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <>
      {/* Keyframe for pulse */}
      <style>{`
        @keyframes ping {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>

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
            maxWidth: "860px",
            margin: "0 auto",
            padding: "5rem 2rem 5rem",
          }}
        >
          {/* ── Page header ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            style={{ marginBottom: "3rem" }}
          >
            <p
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: "0.6rem",
                color: C.copper,
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                marginBottom: "0.65rem",
              }}
            >
              rele · dashboard
            </p>
            <h1
              style={{
                fontFamily: "var(--font-lora), serif",
                fontWeight: 400,
                fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)",
                color: C.cream,
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
                marginBottom: "0.6rem",
              }}
            >
              Instances
            </h1>
            <p
              style={{
                fontSize: "1rem",
                color: C.textDim,
                lineHeight: 1.65,
                maxWidth: "520px",
              }}
            >
              Manage your relay instances, monitor live health, and tune
              configuration — all from one place.
            </p>
          </motion.div>

          {/* ── Two-column layout ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 300px",
              gap: "1.5rem",
              alignItems: "start",
            }}
          >
            {/* Left: Instances list */}
            <div>
              {/* Instances header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "0.9rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                  }}
                >
                  <Mono size="0.7rem" color={C.muted}>
                    {instances.length} instance
                    {instances.length !== 1 ? "s" : ""}
                  </Mono>
                </div>
                <button
                  onClick={() => setShowCreate(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    background: C.copper,
                    border: "none",
                    borderRadius: "5px",
                    color: C.bg,
                    fontFamily: "var(--font-dm-mono), monospace",
                    fontSize: "0.68rem",
                    letterSpacing: "0.07em",
                    fontWeight: 500,
                    padding: "0.5rem 1rem",
                    cursor: "pointer",
                    transition: "opacity 0.15s, transform 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = "0.85";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = "1";
                    e.currentTarget.style.transform = "none";
                  }}
                >
                  <span style={{ fontSize: "0.85rem", lineHeight: 1 }}>+</span>
                  New Instance
                </button>
              </div>

              {/* Instance cards */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.85rem",
                }}
              >
                <AnimatePresence mode="popLayout">
                  {instances.length === 0 ? (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <Card>
                        <div
                          style={{
                            padding: "3rem 1.5rem",
                            textAlign: "center",
                          }}
                        >
                          <div
                            style={{
                              width: "40px",
                              height: "40px",
                              borderRadius: "50%",
                              border: `1px dashed ${C.border}`,
                              margin: "0 auto 1rem",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Mono size="1rem" color={C.border}>
                              +
                            </Mono>
                          </div>
                          <Mono size="0.75rem" color={C.muted}>
                            No instances yet
                          </Mono>
                          <p
                            style={{
                              fontFamily: "var(--font-crimson-pro), serif",
                              fontSize: "0.9rem",
                              color: C.muted,
                              marginTop: "0.4rem",
                            }}
                          >
                            Create your first instance to get started.
                          </p>
                          <button
                            onClick={() => setShowCreate(true)}
                            style={{
                              marginTop: "1.25rem",
                              background: "transparent",
                              border: `1px solid ${C.borderHi}`,
                              borderRadius: "5px",
                              color: C.textDim,
                              fontFamily: "var(--font-dm-mono), monospace",
                              fontSize: "0.67rem",
                              letterSpacing: "0.06em",
                              padding: "0.5rem 1.25rem",
                              cursor: "pointer",
                            }}
                          >
                            Create Instance
                          </button>
                        </div>
                      </Card>
                    </motion.div>
                  ) : (
                    instances.map((inst) => (
                      <InstanceCard
                        key={inst.id}
                        instance={inst}
                        onConfigure={(id) => setConfigureId(id)}
                        onDelete={handleDelete}
                      />
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Right sidebar */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              {/* Health panel */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE, delay: 0.1 }}
              >
                <HealthPanel />
              </motion.div>

              {/* Quick stats */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE, delay: 0.2 }}
              >
                <Card>
                  <CardHeader>
                    <Mono size="0.7rem" color={C.muted}>
                      Overview
                    </Mono>
                  </CardHeader>
                  <div
                    style={{
                      padding: "0.9rem 1.25rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.8rem",
                    }}
                  >
                    {[
                      {
                        label: "Running",
                        value: instances.filter((i) => i.status === "running")
                          .length,
                        color: "#6dbf8b",
                      },
                      {
                        label: "Degraded",
                        value: instances.filter((i) => i.status === "degraded")
                          .length,
                        color: C.copper,
                      },
                      {
                        label: "Total requests",
                        value: fmt(
                          instances.reduce((sum, i) => sum + i.requests, 0),
                        ),
                        color: C.text,
                      },
                      {
                        label: "Avg latency",
                        value: instances.length
                          ? `${Math.round(instances.reduce((s, i) => s + i.latencyMs, 0) / instances.length)}ms`
                          : "—",
                        color: C.text,
                      },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Mono size="0.65rem" color={C.muted}>
                          {stat.label}
                        </Mono>
                        <Mono size="0.75rem" color={stat.color}>
                          {String(stat.value)}
                        </Mono>
                      </div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showCreate && (
          <CreateInstanceModal
            key="create"
            onClose={() => setShowCreate(false)}
            onCreate={handleCreate}
          />
        )}
        {configureInstance && (
          <ConfigureModal
            key="configure"
            instance={configureInstance}
            onClose={() => setConfigureId(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
