"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  MessageSquareIcon,
  MonitorIcon,
  PlayIcon,
  RefreshCwIcon,
  SquareIcon,
  WifiIcon,
  SendIcon,
  HashIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
} from "lucide-react";
import { useMachinesContext } from "../_context/machines-context";
import { useInstanceStats } from "@/hooks/use-instance-stats";

// --- Helpers ---
const REGION_LABELS: Record<string, string> = {
  sin: "Singapore", sjc: "San Jose", iad: "Ashburn",
  ams: "Amsterdam", nrt: "Tokyo", syd: "Sydney",
};

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  telegram: SendIcon, discord: HashIcon, slack: MessageSquareIcon,
  signal: ShieldCheckIcon, whatsapp: MessageSquareIcon, imessage: SmartphoneIcon,
};

function flyStateToStatus(state: string) {
  switch (state) {
    case "started": case "running":    return "running";
    case "created": case "starting":   return "provisioning";
    case "stopping": case "destroying": return "stopping";
    case "stopped": case "destroyed":  return "stopped";
    default: return "error";
  }
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Mono({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`font-[var(--font-dm-mono),monospace] ${className}`}>{children}</span>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Mono className="text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">{children}</Mono>;
}

// --- Loading Component ---
function DashboardSkeleton() {
  const SkeletonPulse = ({ className = "" }) => <div className={`animate-pulse rounded bg-[var(--surface-hi)] ${className}`} />;

  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      <div className="flex justify-between items-center">
        <div className="flex flex-col gap-2">
          <SkeletonPulse className="h-6 w-32" />
          <SkeletonPulse className="h-3 w-48" />
        </div>
        <SkeletonPulse className="h-10 w-24" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SkeletonPulse className="h-24 w-full rounded-xl" />
        <SkeletonPulse className="h-24 w-full rounded-xl" />
      </div>
      <div className="flex flex-col gap-4 rounded-xl border border-[var(--border)] p-5">
        <SkeletonPulse className="h-3 w-24" />
        <div className="flex flex-col gap-2">
          <SkeletonPulse className="h-12 w-full" />
          <SkeletonPulse className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}

// --- Main Page ---
export default function DashboardPage() {
  const { machines, loading, startMachine, stopMachine, refreshMachine } = useMachinesContext();
  const router = useRouter();
  const stats = useInstanceStats();
  const machine = machines[0];
  const status = machine ? flyStateToStatus(machine.state) : "stopped";
  const isRunning = status === "running";

  useEffect(() => { if (isRunning) stats.connect(); }, [isRunning]);

  const imageName = ((machine?.config as any)?.image ?? "").split("/").pop()?.split(":")[0] ?? "—";

  return (
    <div className="h-svh w-full bg-[var(--bg)] text-[var(--text)] overflow-hidden">
      <div className="h-full w-full overflow-y-auto overflow-x-hidden">
        <div className="mx-auto max-w-[1400px] px-6 md:px-10 py-8 sm:py-10">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>

            {loading || !machine ? (
              <DashboardSkeleton />
            ) : (
              <div className="flex flex-col gap-6 sm:gap-7">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex flex-col gap-0.5">
                    <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
                    <Mono className="text-xs text-[var(--muted)]">{machine.flyAppName}</Mono>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => refreshMachine(machine.id)} className="p-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)] cursor-pointer transition-colors"><RefreshCwIcon className="size-3.5" /></button>
                    {isRunning ? (
                      <button onClick={() => stopMachine(machine.id)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--status-error-bg)] text-[var(--status-error-text)] border border-[var(--status-error-border)] cursor-pointer text-xs"><SquareIcon className="size-3.5" /><Mono>STOP</Mono></button>
                    ) : (
                      <button onClick={() => startMachine(machine.id)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white cursor-pointer text-xs"><PlayIcon className="size-3.5" /><Mono>START</Mono></button>
                    )}
                  </div>
                </div>

                {/* Quick Access */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button onClick={() => router.push("/console/chat")} disabled={!isRunning} className="group flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-left transition-all hover:border-[var(--accent)]/40 hover:bg-[var(--surface-hi)] disabled:opacity-40 cursor-pointer">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-[var(--surface-hi)] text-[var(--muted)] group-hover:text-[var(--accent)] transition-colors"><MessageSquareIcon className="size-5" /></div>
                    <div><p className="text-base font-medium">Chat Console</p><p className="text-xs text-[var(--muted)]">Direct agent interaction & logs</p></div>
                  </button>
                  <button onClick={() => router.push("/console/control-ui")} disabled={!isRunning} className="group flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-left transition-all hover:border-[var(--accent)]/40 hover:bg-[var(--surface-hi)] disabled:opacity-40 cursor-pointer">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-[var(--surface-hi)] text-[var(--muted)] group-hover:text-[var(--accent)] transition-colors"><MonitorIcon className="size-5" /></div>
                    <div><p className="text-base font-medium">Control UI</p><p className="text-xs text-[var(--muted)]">Visual interface management</p></div>
                  </button>
                </div>

                {/* Recent Messages */}
                <div className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <div className="flex items-center gap-2 mb-0.5"><MessageSquareIcon className="size-3 text-[var(--muted)]" /><SectionLabel>Recent Activity</SectionLabel></div>
                  <div className="flex flex-col gap-2">
                    {stats.recentMessages.length === 0 ? <Mono className="text-xs text-[var(--muted)] py-1">No active logs</Mono> :
                      stats.recentMessages.slice(0, 5).map((msg) => (
                        <div key={msg.id} className="flex items-start gap-4 rounded-lg px-3.5 py-2.5 bg-[var(--surface-hi)]/40 border border-[var(--border)]/50">
                          <span className="mt-0.5 shrink-0 font-[var(--font-dm-mono),monospace] text-[8px] tracking-[0.1em] uppercase px-1.5 py-0.5 rounded border"
                            style={msg.role === "user" ? { background: "var(--accent-subtle)", color: "var(--accent)", borderColor: "var(--accent-border)" } : { background: "var(--surface)", color: "var(--muted)", borderColor: "var(--border)" }}>
                            {msg.role === "user" ? "user" : "agent"}
                          </span>
                          <span className="flex-1 text-xs text-[var(--text-dim)] leading-relaxed tracking-tight">{msg.content}</span>
                          <Mono className="shrink-0 text-[9px] text-[var(--muted)] mt-1">{formatTime(msg.timestamp)}</Mono>
                        </div>
                      ))
                    }
                  </div>
                </div>

                {/* Infrastructure */}
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_2.5fr] gap-3">
                   <div className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                      <SectionLabel>Gateway</SectionLabel>
                      <div className="flex items-center gap-2.5">
                        <div className={`size-2 rounded-full ${stats.gatewayConnected ? "bg-[var(--status-success)]" : "bg-[var(--muted)]"}`} />
                        <Mono className="text-sm font-medium uppercase tracking-tight">{stats.gatewayConnected ? "Connected" : "Offline"}</Mono>
                      </div>
                   </div>
                   <div className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                      <SectionLabel>Live Channels</SectionLabel>
                      <div className="flex flex-wrap gap-2.5">
                        {["telegram", "discord", "slack", "signal", "whatsapp"].map(id => {
                          const active = stats.channels.find(c => c.id === id)?.connected;
                          const Icon = CHANNEL_ICONS[id] || WifiIcon;
                          return (
                            <div key={id} className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg border transition-all ${active ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]" : "border-[var(--border)] opacity-30 grayscale"}`}>
                              <Icon className="size-3.5" /><Mono className="text-[10px] font-bold uppercase tracking-tight">{id}</Mono>
                            </div>
                          );
                        })}
                      </div>
                   </div>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-6 mt-2 border-t border-[var(--border)]">
                  <div className="flex flex-col gap-1"><SectionLabel>Region</SectionLabel><Mono className="text-[13px] text-[var(--text)]">{REGION_LABELS[machine.region] || machine.region}</Mono></div>
                  <div className="flex flex-col gap-1"><SectionLabel>Machine ID</SectionLabel><Mono className="text-[13px] text-[var(--text)]">{machine.flyMachineId.slice(0, 16)}</Mono></div>
                  <div className="flex flex-col gap-1"><SectionLabel>Image</SectionLabel><Mono className="text-[13px] text-[var(--text)]">{imageName}</Mono></div>
                  <div className="flex flex-col gap-1"><SectionLabel>Uptime</SectionLabel><Mono className="text-[13px] text-[var(--text)]">{isRunning ? formatDuration(Date.now() - new Date(machine.updatedAt).getTime()) : "Stopped"}</Mono></div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
