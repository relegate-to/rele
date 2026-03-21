"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { EASE } from "@/lib/theme";
import { useMachinesContext } from "../_context/machines-context";

function Mono({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`font-[var(--font-dm-mono),monospace] ${className}`}>{children}</span>;
}

function PlaceholderCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] bg-[var(--surface-hi)] px-6 py-4">
        <Mono className="text-sm font-medium text-[var(--text)]">{title}</Mono>
        <p className="mt-0.5 font-[var(--font-crimson-pro),serif] text-sm text-[var(--muted)]">
          {description}
        </p>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function BarPlaceholder({ widths }: { widths: string[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      {widths.map((w, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="h-2 rounded-full bg-[var(--copper)]/15 animate-pulse" style={{ width: w }} />
          <span className="h-2 w-8 rounded-full bg-[var(--surface-hi)]" />
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { machines, loading } = useMachinesContext();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (machines.length === 0) {
      router.replace("/console/onboarding");
    }
  }, [machines, loading, router]);

  if (loading || machines.length === 0) return null;

  const machine = machines[0];
  const isRunning = machine.state === "started" || machine.state === "running";

  return (
    <div className="relative min-h-[calc(100svh-3rem)] bg-[var(--bg)] text-[var(--text)]">
      <div className="relative z-10 mx-auto max-w-[820px] px-8 py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="flex flex-col gap-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-['Lora',Georgia,serif] text-2xl italic tracking-[-0.01em]">
                Dashboard
              </h1>
              <p className="mt-1 font-[var(--font-crimson-pro),serif] text-base text-[var(--text-dim)]">
                Manage your OpenClaw instance.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {isRunning && (
                <button
                  onClick={() => router.push("/console/chat")}
                  className="rounded-lg bg-[var(--copper)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                >
                  <Mono>Open Chat</Mono>
                </button>
              )}
              <div className="flex items-center gap-2">
                <span className={`size-2 rounded-full ${isRunning ? "bg-[var(--status-success)]" : "bg-[var(--status-neutral)]"}`} />
                <Mono className={`text-xs ${isRunning ? "text-[var(--status-success)]" : "text-[var(--muted)]"}`}>
                  {isRunning ? "Running" : machine.state}
                </Mono>
              </div>
            </div>
          </div>

          {/* Instance info */}
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="grid grid-cols-4 divide-x divide-[var(--border)] bg-[var(--surface-hi)]">
              <div className="px-5 py-3.5">
                <Mono className="text-[11px] uppercase tracking-wider text-[var(--muted)]">Region</Mono>
                <p className="mt-0.5"><Mono className="text-sm text-[var(--text)]">{machine.region}</Mono></p>
              </div>
              <div className="px-5 py-3.5">
                <Mono className="text-[11px] uppercase tracking-wider text-[var(--muted)]">Machine</Mono>
                <p className="mt-0.5"><Mono className="text-sm text-[var(--text)]">{machine.flyMachineId.slice(0, 8)}</Mono></p>
              </div>
              <div className="px-5 py-3.5">
                <Mono className="text-[11px] uppercase tracking-wider text-[var(--muted)]">App</Mono>
                <p className="mt-0.5"><Mono className="text-sm text-[var(--text)]">{machine.flyAppName}</Mono></p>
              </div>
              <div className="px-5 py-3.5">
                <Mono className="text-[11px] uppercase tracking-wider text-[var(--muted)]">URL</Mono>
                <p className="mt-0.5">
                  <Mono className="text-sm text-[var(--copper)]">
                    {machine.flyAppName}.fly.dev
                  </Mono>
                </p>
              </div>
            </div>
          </div>

          {/* Placeholder cards */}
          <div className="grid grid-cols-3 gap-4">
            <PlaceholderCard title="Requests" description="Last 24h">
              <BarPlaceholder widths={["70%", "45%", "85%", "30%", "60%"]} />
            </PlaceholderCard>
            <PlaceholderCard title="Latency" description="p50 / p99">
              <BarPlaceholder widths={["50%", "80%", "35%", "65%", "45%"]} />
            </PlaceholderCard>
            <PlaceholderCard title="Uptime" description="Last 30 days">
              <div className="flex flex-col items-center gap-2 py-2">
                <Mono className="text-2xl font-medium text-[var(--status-success)]">99.9%</Mono>
                <Mono className="text-xs text-[var(--muted)]">All systems normal</Mono>
              </div>
            </PlaceholderCard>
          </div>

          <PlaceholderCard title="Logs" description="Recent activity from your instance">
            <div className="flex flex-col gap-2">
              {[
                { time: "now", msg: "Instance is healthy" },
                { time: "2m ago", msg: "Health check passed" },
                { time: "5m ago", msg: "Connection established" },
              ].map((log, i) => (
                <div key={i} className="flex items-baseline gap-3">
                  <Mono className="shrink-0 text-xs text-[var(--muted)]">{log.time}</Mono>
                  <Mono className="text-xs text-[var(--text-dim)]">{log.msg}</Mono>
                </div>
              ))}
            </div>
          </PlaceholderCard>
        </motion.div>
      </div>
    </div>
  );
}
