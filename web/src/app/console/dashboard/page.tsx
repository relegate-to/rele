"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  MessageSquareIcon,
  MonitorIcon,
  PlayIcon,
  RefreshCwIcon,
  SquareIcon,
} from "lucide-react";
import { useMachinesContext } from "../_context/machines-context";
import { useInstanceStats } from "@/hooks/use-instance-stats";
import { LogItem } from "@/components/ui/log-item";
import {
  REGION_LABELS,
  CHANNEL_ICONS,
  DEFAULT_CHANNEL_ICON,
} from "@/lib/constants";
import { formatDuration } from "@/lib/format";

// --- UI Helpers ---
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Mono className="text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">
      {children}
    </Mono>
  );
}

export default function DashboardPage() {
  const { machines, loading, startMachine, stopMachine, refreshMachine } = useMachinesContext();
  const router = useRouter();
  const stats = useInstanceStats();
  const machine = machines[0];
  const machineStarted = machine
    ? machine.state === "started" || machine.state === "running"
    : false;
  const isRunning = machineStarted && stats.gatewayConnected;

  if (loading || !machine) return null;



  const displayMessages = [...stats.recentMessages]
    .filter(msg => msg.content?.trim().length > 0)
    .reverse().slice(0, 5);

  return (
    <div className="h-svh w-full bg-[var(--bg)] text-[var(--text)] overflow-hidden">
      <div className="h-full w-full overflow-y-auto overflow-x-hidden custom-scrollbar">
        <div className="mx-auto max-w-[1400px] px-6 md:px-10 py-8 sm:py-10">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6 sm:gap-7">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
                <Mono className="text-xs text-[var(--muted)]">{machine.flyAppName}</Mono>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => refreshMachine(machine.id)} className="p-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)] transition-colors"><RefreshCwIcon className="size-3.5" /></button>
                {isRunning ? (
                  <button onClick={() => stopMachine(machine.id)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--status-error-bg)] text-[var(--status-error-text)] border border-[var(--status-error-border)] text-xs"><SquareIcon className="size-3.5" /><Mono>STOP</Mono></button>
                ) : (
                  <button onClick={() => startMachine(machine.id)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-xs"><PlayIcon className="size-3.5" /><Mono>START</Mono></button>
                )}
              </div>
            </div>

            {/* Navigation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button onClick={() => router.push("/console/chat")} disabled={!isRunning} className="group flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-left transition-all hover:border-[var(--accent)]/40 hover:bg-[var(--surface-hi)] disabled:opacity-40 cursor-pointer">
                <div className="flex size-10 items-center justify-center rounded-lg bg-[var(--surface-hi)] text-[var(--muted)] group-hover:text-[var(--accent)] transition-colors"><MessageSquareIcon className="size-5" /></div>
                <div><p className="text-base font-medium">Chat Console</p><p className="text-xs text-[var(--muted)]">Direct agent interaction</p></div>
              </button>
              <button onClick={() => router.push("/console/control-ui")} disabled={!isRunning} className="group flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-left transition-all hover:border-[var(--accent)]/40 hover:bg-[var(--surface-hi)] disabled:opacity-40 cursor-pointer">
                <div className="flex size-10 items-center justify-center rounded-lg bg-[var(--surface-hi)] text-[var(--muted)] group-hover:text-[var(--accent)] transition-colors"><MonitorIcon className="size-5" /></div>
                <div><p className="text-base font-medium">Control UI</p><p className="text-xs text-[var(--muted)]">Visual interface management</p></div>
              </button>
            </div>

            {/* Activity */}
            <div className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="flex items-center gap-2 mb-0.5"><MessageSquareIcon className="size-3 text-[var(--muted)]" /><SectionLabel>Recent Activity</SectionLabel></div>
              <div className="flex flex-col">{displayMessages.map(msg => <LogItem key={msg.id} msg={msg} />)}</div>
            </div>

            {/* Infrastructure */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_2.5fr] gap-3">
               <div className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <SectionLabel>Gateway</SectionLabel>
                  <div className="flex items-center gap-2.5">
                    <div className={`size-2 rounded-full ${stats.gatewayConnected ? "bg-[var(--status-success)]" : "bg-[var(--muted)]"}`} />
                    <Mono className="text-sm font-medium uppercase">{stats.gatewayConnected ? "Connected" : "Offline"}</Mono>
                  </div>
               </div>
               <div className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <SectionLabel>Live Channels</SectionLabel>
                  <div className="flex flex-wrap gap-2.5">
                    {["telegram", "discord", "slack", "signal", "whatsapp"].map(id => {
                      const active = stats.channels.find(c => c.id === id)?.connected;
                      const Icon = CHANNEL_ICONS[id] ?? DEFAULT_CHANNEL_ICON;
                      return (
                        <div key={id} className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg border transition-all ${active ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]" : "border-[var(--border)] opacity-30 grayscale"}`}>
                          <Icon className="size-3.5" /><Mono className="text-[10px] font-bold uppercase">{id}</Mono>
                        </div>
                      );
                    })}
                  </div>
               </div>
            </div>

            {/* Footer */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-6 mt-2 border-t border-[var(--border)]">
              <div className="flex flex-col gap-1"><SectionLabel>Region</SectionLabel><Mono className="text-[13px]">{REGION_LABELS[machine.region] || machine.region}</Mono></div>
              <div className="flex flex-col gap-1"><SectionLabel>Machine ID</SectionLabel><Mono className="text-[13px]">{machine.flyMachineId.slice(0, 16)}</Mono></div>
              <div className="flex flex-col gap-1"><SectionLabel>Uptime</SectionLabel><Mono className="text-[13px]">{isRunning ? formatDuration(Date.now() - new Date(machine.updatedAt).getTime()) : "Stopped"}</Mono></div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
