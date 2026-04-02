"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BoxIcon,
  CheckIcon,
  CopyIcon,
  GlobeIcon,
  ClockIcon,
  MessageSquareIcon,
  MonitorIcon,
  PlayIcon,
  RefreshCwIcon,
  ServerIcon,
  SquareIcon,
  WifiIcon,
  WifiOffIcon,
  ZapIcon,
  UsersIcon,
} from "lucide-react";
import { EASE } from "@/lib/theme";
import { useMachinesContext, type Machine } from "../_context/machines-context";
import { useInstanceStats } from "@/hooks/use-instance-stats";
import type { ChannelStatus } from "@/hooks/use-instance-stats";

// ── Helpers ───────────────────────────────────────────────────────────────────

const REGION_LABELS: Record<string, string> = {
  sin: "Singapore",
  sjc: "San Jose",
  iad:  "Ashburn",
  ams:  "Amsterdam",
  nrt:  "Tokyo",
  syd:  "Sydney",
};

type Status = "running" | "provisioning" | "stopping" | "stopped" | "error";

function flyStateToStatus(state: string): Status {
  switch (state) {
    case "started":
    case "running":    return "running";
    case "created":
    case "starting":   return "provisioning";
    case "stopping":
    case "destroying": return "stopping";
    case "stopped":
    case "destroyed":  return "stopped";
    default:           return "error";
  }
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

function formatRelative(dateStr: string): string {
  return formatDuration(Date.now() - new Date(dateStr).getTime()) + " ago";
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Mono({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`font-[var(--font-dm-mono),monospace] ${className}`}>{children}</span>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Mono className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
      {children}
    </Mono>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      title="Copy"
      className="ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--muted)] hover:text-[var(--text-dim)] cursor-pointer"
    >
      {copied ? <CheckIcon className="size-3" /> : <CopyIcon className="size-3" />}
    </button>
  );
}

const STATUS_CFG: Record<Status, { key: string; label: string; pulse: boolean }> = {
  running:      { key: "success", label: "Running",      pulse: true  },
  provisioning: { key: "info",    label: "Provisioning", pulse: true  },
  stopping:     { key: "warning", label: "Stopping",     pulse: true  },
  stopped:      { key: "neutral", label: "Stopped",      pulse: false },
  error:        { key: "error",   label: "Error",        pulse: false },
};

function StatusPill({ status }: { status: Status }) {
  const { key, label, pulse } = STATUS_CFG[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 font-[var(--font-dm-mono),monospace] text-xs tracking-widest px-2.5 py-1 rounded-full border"
      style={{ background: `var(--status-${key}-bg)`, color: `var(--status-${key}-text)`, borderColor: `var(--status-${key}-border)` }}
    >
      <span className={`size-1.5 rounded-full shrink-0 ${pulse ? "animate-pulse" : ""}`} style={{ background: `var(--status-${key})` }} />
      {label}
    </span>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, copyValue }: {
  icon: React.ElementType; label: string; value: string; sub?: string; copyValue?: string;
}) {
  return (
    <div className="group flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
      <div className="flex items-center gap-1.5">
        <Icon className="size-3 text-[var(--muted)]" />
        <Mono className="text-[10px] uppercase tracking-widest text-[var(--muted)]">{label}</Mono>
      </div>
      <div className="flex items-center min-w-0">
        <Mono className="text-sm font-medium text-[var(--text)] truncate">{value}</Mono>
        {copyValue && <CopyButton value={copyValue} />}
      </div>
      {sub && <Mono className="text-[11px] text-[var(--muted)] truncate">{sub}</Mono>}
    </div>
  );
}

// ── Gateway status card ───────────────────────────────────────────────────────

function GatewayCard({ connected, connecting, latencyMs, error }: {
  connected: boolean; connecting: boolean; latencyMs: number | null; error: string | null;
}) {
  const statusKey = connected ? "success" : connecting ? "info" : "neutral";
  const label     = connected ? "Connected" : connecting ? "Connecting…" : "Disconnected";
  const Icon      = connected ? WifiIcon : WifiOffIcon;

  function latencyColor(ms: number) {
    if (ms < 200)  return "var(--status-success-text)";
    if (ms < 500)  return "var(--status-warning-text)";
    return "var(--status-error-text)";
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ZapIcon className="size-3 text-[var(--muted)]" />
          <SectionLabel>Gateway</SectionLabel>
        </div>
        <span
          className="inline-flex items-center gap-1.5 font-[var(--font-dm-mono),monospace] text-[10px] tracking-widest px-2 py-0.5 rounded-full border"
          style={{ background: `var(--status-${statusKey}-bg)`, color: `var(--status-${statusKey}-text)`, borderColor: `var(--status-${statusKey}-border)` }}
        >
          <span className={`size-1.5 rounded-full ${connecting ? "animate-pulse" : connected ? "animate-pulse" : ""}`} style={{ background: `var(--status-${statusKey})` }} />
          {label}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border"
          style={{ borderColor: `var(--status-${statusKey}-border)`, background: `var(--status-${statusKey}-bg)`, color: `var(--status-${statusKey})` }}
        >
          <Icon className="size-4" />
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <Mono className="text-sm font-medium text-[var(--text)]">OpenClaw Instance</Mono>
          {error && !connected && (
            <Mono className="text-xs text-[var(--status-error-text)] truncate">{error}</Mono>
          )}
          {!error && !connected && !connecting && (
            <Mono className="text-xs text-[var(--muted)]">Start the instance to connect</Mono>
          )}
          {connecting && (
            <Mono className="text-xs text-[var(--muted)]">Establishing connection…</Mono>
          )}
          {connected && latencyMs !== null && (
            <Mono className="text-xs" style={{ color: latencyColor(latencyMs) }}>
              {latencyMs}ms handshake
            </Mono>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Channel icons (emoji fallback) ────────────────────────────────────────────

const CHANNEL_ICONS: Record<string, string> = {
  telegram:  "✈️",
  discord:   "🎮",
  slack:     "💼",
  signal:    "🔐",
  whatsapp:  "💬",
  imessage:  "📱",
  teams:     "🏢",
  matrix:    "🔢",
};

// ── Channels card ─────────────────────────────────────────────────────────────

function ChannelsCard({ channels, loading }: { channels: ChannelStatus[]; loading: boolean }) {
  // Merge live data with the 4 configured channels (always show them)
  const configured = ["telegram", "discord", "slack", "signal"];
  const displayed = configured.map((id) => {
    const live = channels.find((c) => c.id === id);
    return live ?? { id, label: id.charAt(0).toUpperCase() + id.slice(1), connected: false };
  });

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
      <div className="flex items-center gap-2">
        <WifiIcon className="size-3 text-[var(--muted)]" />
        <SectionLabel>Channels</SectionLabel>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {displayed.map((ch) => {
          const key = loading ? "neutral" : ch.connected ? "success" : "neutral";
          return (
            <div
              key={ch.id}
              className="flex flex-col items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-3 text-center"
              style={ch.connected ? { borderColor: `var(--status-success-border)`, background: `var(--status-success-bg)` } : {}}
            >
              <span className="text-xl leading-none">{CHANNEL_ICONS[ch.id] ?? "📡"}</span>
              <Mono className="text-[10px] text-[var(--text-dim)]">{ch.label}</Mono>
              <span
                className="inline-flex items-center gap-1 font-[var(--font-dm-mono),monospace] text-[9px] tracking-wider px-1.5 py-0.5 rounded-full border"
                style={{ background: `var(--status-${key}-bg)`, color: `var(--status-${key}-text)`, borderColor: `var(--status-${key}-border)` }}
              >
                <span className={`size-1 rounded-full ${ch.connected ? "animate-pulse" : ""}`} style={{ background: `var(--status-${key})` }} />
                {loading ? "—" : ch.connected ? "active" : "idle"}
              </span>
            </div>
          );
        })}
      </div>

      {channels.some((c) => !configured.includes(c.id) && c.connected) && (
        <div className="flex flex-wrap gap-1.5 border-t border-[var(--border)] pt-3">
          {channels
            .filter((c) => !configured.includes(c.id) && c.connected)
            .map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1 rounded-full border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-2 py-0.5">
                <span className="size-1 rounded-full bg-[var(--status-success)] animate-pulse" />
                <Mono className="text-[10px] text-[var(--status-success-text)]">{c.label}</Mono>
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

// ── Sessions card ─────────────────────────────────────────────────────────────

function SessionsCard({ sessions, loading }: { sessions: { id: string; agentId?: string; active?: boolean }[]; loading: boolean }) {
  const active = sessions.filter((s) => s.active !== false);
  const count  = active.length;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UsersIcon className="size-3 text-[var(--muted)]" />
          <SectionLabel>Active Sessions</SectionLabel>
        </div>
        {!loading && (
          <Mono
            className="text-xs px-2 py-0.5 rounded-full border"
            style={{
              background: count > 0 ? "var(--status-success-bg)" : "var(--status-neutral-bg)",
              color: count > 0 ? "var(--status-success-text)" : "var(--status-neutral-text)",
              borderColor: count > 0 ? "var(--status-success-border)" : "var(--status-neutral-border)",
            }}
          >
            {count} active
          </Mono>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-8 rounded-lg bg-[var(--surface-hi)] animate-pulse" />
          ))}
        </div>
      ) : active.length === 0 ? (
        <Mono className="text-xs text-[var(--muted)]">No active sessions</Mono>
      ) : (
        <div className="flex flex-col gap-1.5">
          {active.slice(0, 4).map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg bg-[var(--surface-hi)] px-3 py-2">
              <Mono className="text-xs text-[var(--text)] truncate">{s.id}</Mono>
              {s.agentId && (
                <Mono className="text-[10px] text-[var(--muted)] shrink-0 ml-2">{s.agentId}</Mono>
              )}
            </div>
          ))}
          {active.length > 4 && (
            <Mono className="text-[11px] text-[var(--muted)]">+{active.length - 4} more</Mono>
          )}
        </div>
      )}
    </div>
  );
}

// ── Recent messages ───────────────────────────────────────────────────────────

function RecentMessagesCard({ messages, loading }: {
  messages: { id: string; role: "user" | "assistant"; content: string; timestamp: number }[];
  loading: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
      <div className="flex items-center gap-2">
        <MessageSquareIcon className="size-3 text-[var(--muted)]" />
        <SectionLabel>Recent Messages</SectionLabel>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded-lg bg-[var(--surface-hi)] animate-pulse" />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <Mono className="text-xs text-[var(--muted)]">No messages yet — start a chat</Mono>
      ) : (
        <div className="flex flex-col gap-1.5">
          {messages.map((msg) => (
            <div key={msg.id} className="flex items-start gap-3 rounded-lg px-3 py-2.5 bg-[var(--surface-hi)]">
              <span
                className="mt-0.5 shrink-0 font-[var(--font-dm-mono),monospace] text-[9px] tracking-widest uppercase px-1.5 py-0.5 rounded border"
                style={
                  msg.role === "user"
                    ? { background: "var(--accent-subtle)", color: "var(--accent)", borderColor: "color-mix(in srgb, var(--accent) 25%, transparent)" }
                    : { background: "var(--surface)", color: "var(--muted)", borderColor: "var(--border)" }
                }
              >
                {msg.role === "user" ? "you" : "agent"}
              </span>
              <span className="flex-1 text-xs text-[var(--text-dim)] truncate leading-relaxed">
                {msg.content || <span className="italic text-[var(--muted)]">(empty)</span>}
              </span>
              <Mono className="shrink-0 text-[10px] text-[var(--muted)]">{formatTime(msg.timestamp)}</Mono>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Quick link ────────────────────────────────────────────────────────────────

function QuickLink({ icon: Icon, label, description, onClick, disabled }: {
  icon: React.ElementType; label: string; description: string;
  onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 text-left transition-all hover:border-[var(--accent)]/40 hover:bg-[var(--accent-subtle)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-hi)] text-[var(--muted)] transition-colors group-hover:border-[var(--accent)]/30 group-hover:text-[var(--accent)]">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--text)]">{label}</p>
        <p className="text-xs text-[var(--muted)]">{description}</p>
      </div>
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { machines, loading, startMachine, stopMachine, refreshMachine } = useMachinesContext();
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState<"start" | "stop" | "refresh" | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (machines.length === 0) router.replace("/console/onboarding");
  }, [machines, loading, router]);

  const machine: Machine | undefined = machines[0];
  const status = machine ? flyStateToStatus(machine.state) : "stopped";
  const isRunning   = status === "running";
  const isStopped   = status === "stopped";
  const isTransient = status === "provisioning" || status === "stopping";

  const stats = useInstanceStats();

  // Connect when the instance is running — same pattern as the chat page
  useEffect(() => {
    if (isRunning) stats.connect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  if (loading || !machine) return null;

  const image       = (machine.config as { image?: string })?.image ?? "";
  const imageName   = image.split("/").pop()?.split(":")[0] ?? "—";
  const imageTag    = image.includes(":") ? image.split(":").pop()! : "latest";
  const regionLabel = REGION_LABELS[machine.region] ?? machine.region;
  const createdDate = new Date(machine.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  async function handleStart()   { setActionLoading("start");   try { await startMachine(machine.id);   } finally { setActionLoading(null); } }
  async function handleStop()    { setActionLoading("stop");    try { await stopMachine(machine.id);    } finally { setActionLoading(null); } }
  async function handleRefresh() { setActionLoading("refresh"); try { await refreshMachine(machine.id); } finally { setActionLoading(null); } }

  const busy = !!actionLoading;
  const liveDataLoading = isRunning && !stats.gatewayConnected;

  return (
    <div className="min-h-svh bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto max-w-[900px] px-8 py-16">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="flex flex-col gap-7"
        >
          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-[-0.01em]">Dashboard</h1>
                <StatusPill status={status} />
              </div>
              <Mono className="text-sm text-[var(--muted)]">{machine.flyAppName}</Mono>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleRefresh}
                disabled={busy}
                title="Refresh machine state"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-dim)] transition-all hover:border-[var(--border-hi)] hover:text-[var(--text)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <RefreshCwIcon className={`size-4 ${actionLoading === "refresh" ? "animate-spin" : ""}`} />
                <Mono>refresh</Mono>
              </button>

              {(isRunning || isTransient) && (
                <button
                  onClick={handleStop}
                  disabled={busy || isTransient}
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-3 py-2 text-sm text-[var(--status-error-text)] transition-all hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <SquareIcon className="size-4" />
                  <Mono>stop</Mono>
                </button>
              )}

              {isStopped && (
                <button
                  onClick={handleStart}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <PlayIcon className="size-4" />
                  <Mono>start</Mono>
                </button>
              )}

              {isRunning && (
                <button
                  onClick={() => router.push("/console/chat")}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm text-white transition-all hover:opacity-90 cursor-pointer"
                >
                  <MessageSquareIcon className="size-4" />
                  <Mono>open chat</Mono>
                </button>
              )}
            </div>
          </div>

          {/* ── Instance stat cards ─────────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-3">
            <StatCard icon={GlobeIcon}  label="Region"    value={regionLabel}                    sub={machine.region} />
            <StatCard icon={ServerIcon} label="Machine"   value={machine.flyMachineId.slice(0, 12)} sub="fly machine id" copyValue={machine.flyMachineId} />
            <StatCard icon={BoxIcon}    label="Image"     value={imageName}                      sub={imageTag} />
            <StatCard
              icon={ClockIcon}
              label={isRunning ? "Uptime" : "Last Active"}
              value={isRunning
                ? formatDuration(Date.now() - new Date(machine.updatedAt).getTime())
                : formatRelative(machine.updatedAt)
              }
              sub={`created ${createdDate}`}
            />
          </div>

          {/* ── Gateway + Channels row ──────────────────────────────────────── */}
          <div className="grid grid-cols-[1fr_2fr] gap-3">
            <GatewayCard
              connected={stats.gatewayConnected}
              connecting={stats.gatewayConnecting}
              latencyMs={stats.gatewayLatencyMs}
              error={stats.error}
            />
            <ChannelsCard channels={stats.channels} loading={liveDataLoading} />
          </div>

          {/* ── Messages + Sessions row ─────────────────────────────────────── */}
          <div className="grid grid-cols-[2fr_1fr] gap-3">
            <RecentMessagesCard messages={stats.recentMessages} loading={liveDataLoading} />
            <SessionsCard sessions={stats.sessions} loading={liveDataLoading} />
          </div>

          {/* ── Quick access ────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-3">
            <SectionLabel>Quick Access</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <QuickLink
                icon={MessageSquareIcon}
                label="Chat"
                description="Talk to your agent"
                onClick={() => router.push("/console/chat")}
                disabled={!isRunning}
              />
              <QuickLink
                icon={MonitorIcon}
                label="Control UI"
                description="Visual interface"
                onClick={() => router.push("/console/control-ui")}
                disabled={!isRunning}
              />
            </div>
          </div>

        </motion.div>
      </div>
    </div>
  );
}
