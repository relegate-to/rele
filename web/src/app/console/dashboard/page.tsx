"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { EASE } from "@/lib/theme";
import { useMachinesContext } from "../_context/machines-context";

function Mono({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`font-[var(--font-dm-mono),monospace] ${className}`}>{children}</span>;
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
    <div className="relative min-h-svh bg-[var(--bg)] text-[var(--text)]">
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
              <h1 className="text-2xl font-semibold tracking-[-0.01em]">
                Dashboard
              </h1>
              <p className="mt-1 text-base text-[var(--text-dim)]">
                Manage your OpenClaw instance.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {isRunning && (
                <button
                  onClick={() => router.push("/console/chat")}
                  className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
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
            <div className="grid grid-cols-3 divide-x divide-[var(--border)] bg-[var(--surface-hi)]">
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
            </div>
          </div>

          <p className="text-center text-sm text-[var(--muted)]">
            More here soon.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
