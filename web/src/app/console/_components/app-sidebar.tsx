"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, useEffect } from "react";
import { ActivityIcon, ArrowRightIcon, BookOpenIcon, CheckCircle2Icon, ExternalLinkIcon, LayoutGridIcon, MessageSquareIcon, MonitorIcon, RocketIcon, SettingsIcon, SparklesIcon, XIcon } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { AddInstanceItem, InstanceItem } from "./instance";
import type { Instance, InstanceStatus } from "./instance";
import UserPill from "./user-pill";
import { useMachinesContext, type Machine } from "../_context/machines-context";
import { useGateway } from "../_context/gateway-context";
import { cn } from "@/lib/utils";
import { RoadmapDialog } from "@/components/ui/roadmap-dialog";

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: "Dashboard",  href: "/console/dashboard",   icon: LayoutGridIcon },
  { label: "Chat",       href: "/console/chat",        icon: MessageSquareIcon },
  { label: "Control UI", href: "/console/control-ui",  icon: MonitorIcon },
] as const;

const DEBUG_NAV_ITEMS = [
  { label: "Settings",  href: "/console/settings",  icon: SettingsIcon },
  { label: "Status",    href: "/console/status",    icon: ActivityIcon },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function flyStateToStatus(state: string, gatewayConnected: boolean): InstanceStatus {
  switch (state) {
    case "started":
    case "running":    return gatewayConnected ? "running" : "connecting";
    case "created":
    case "starting":   return "provisioning";
    case "stopping":
    case "suspending":
    case "destroying": return "stopping";
    case "stopped":
    case "suspended":
    case "destroyed":  return "stopped";
    default:           return "error";
  }
}

const REGION_LABELS: Record<string, string> = {
  sin: "Singapore",
  sjc: "San Jose",
  iad: "Ashburn",
  ams: "Amsterdam",
  nrt: "Tokyo",
  syd: "Sydney",
};

function machineToInstance(m: Machine, gatewayConnected: boolean): Instance {
  const status = flyStateToStatus(m.state, gatewayConnected);
  const config = m.config as { image?: string; name?: string; icon?: string };
  const image = config.image ?? "";
  const name = config.name ?? image.split("/").pop()?.split(":")[0] ?? m.flyMachineId.slice(0, 8);
  const regionLabel = REGION_LABELS[m.region] ?? m.region;
  return {
    id: m.id,
    name,
    icon: config.icon,
    status,
    ...(status === "running" && { uptime: regionLabel }),
    ...(status === "stopped" && { lastActive: regionLabel }),
  };
}

// ─── Onboarding sidebar section with exit animation ──────────────────────────

type ExitPhase = "visible" | "completing" | "collapsing" | "gone";

function OnboardingSection({
  show,
  hasInstances,
  pathname,
}: {
  show: boolean;
  hasInstances: boolean;
  pathname: string;
}) {
  const [phase, setPhase] = useState<ExitPhase>(show ? "visible" : "gone");
  const prevShow = useRef(show);
  const containerRef = useRef<HTMLDivElement>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (prevShow.current && !show) {
      if (containerRef.current) {
        setMeasuredHeight(containerRef.current.scrollHeight);
      }
      setPhase("completing");
      const t1 = setTimeout(() => setPhase("collapsing"), 800);
      const t2 = setTimeout(() => setPhase("gone"), 1200);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    if (!prevShow.current && show) {
      setPhase("visible");
      setMeasuredHeight(undefined);
    }
    prevShow.current = show;
  }, [show]);

  if (phase === "gone") return null;

  return (
    <div
      ref={containerRef}
      className="overflow-hidden transition-all duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
      style={{
        height: phase === "collapsing" ? 0 : measuredHeight ?? "auto",
        opacity: phase === "collapsing" ? 0 : 1,
      }}
    >
      <SidebarGroup className="px-2 pt-0 pb-1">
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === "/console/onboarding"}
                tooltip="Set up your instance"
                render={<Link href="/console/onboarding" />}
                className={cn(
                  "h-auto gap-2.5 rounded-lg border px-2.5 py-2 transition-all duration-500",
                  phase === "completing"
                    ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success)]"
                    : "border-[var(--accent)]/20 bg-[var(--accent)]/5 text-[var(--accent)] hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/10"
                )}
              >
                {phase === "completing" ? (
                  <CheckCircle2Icon className="size-4 shrink-0" />
                ) : (
                  <SparklesIcon className="size-4 shrink-0" />
                )}
                <div className="flex flex-col">
                  <span className="text-sm font-semibold leading-tight">
                    {phase === "completing" ? "All done!" : "Onboarding"}
                  </span>
                  <span className="text-xs font-normal opacity-60">
                    {phase === "completing"
                      ? "Instance is ready"
                      : hasInstances
                        ? "View setup"
                        : "Create your instance"}
                  </span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </div>
  );
}

// ─── AppSidebar ───────────────────────────────────────────────────────────────

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { machines, loading, startMachine, stopMachine, deleteMachine } = useMachinesContext();
  const { connected: gatewayConnected, connect: connectGateway, disconnect: disconnectGateway } = useGateway();
  const hasInstances = !loading && machines.length > 0;

  // Connect when any machine is running; disconnect when none are (and machines are loaded).
  const anyMachineRunning = machines.some(
    (m) => m.state === "started" || m.state === "running"
  );
  useEffect(() => {
    if (anyMachineRunning) {
      connectGateway();
    } else if (!loading) {
      disconnectGateway();
    }
  }, [anyMachineRunning, loading, connectGateway, disconnectGateway]);

  const [showDebug, setShowDebug] = useState(false);
  const [showRoadmap, setShowRoadmap] = useState(false);
  const [showRoadmapBanner, setShowRoadmapBanner] = useState(true);
  const dismissRoadmapBanner = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowRoadmapBanner(false);
    localStorage.setItem("roadmap-banner-dismissed", "1");
  };
  useEffect(() => {
    const toggle = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "d") setShowDebug((v) => !v);
    };
    window.addEventListener("keydown", toggle);
    return () => window.removeEventListener("keydown", toggle);
  }, []);

  return (
    <Sidebar variant="floating">

      {/* Wordmark */}
      <SidebarHeader className="border-b border-sidebar-border px-4 py-[9px]">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold tracking-[-0.01em] text-sidebar-foreground">
            rele
          </span>
          <span className="text-xs text-sidebar-foreground/25">·</span>
          <span className="text-xs text-sidebar-foreground/30">
            console
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>

        {/* Instance */}
        <SidebarGroup className="px-2.5 py-2.5">
          <SidebarGroupContent>
            <SidebarMenu>
              {loading && machines.length === 0 && (
                <SidebarMenuItem>
                  <div className="flex h-auto items-center gap-3 rounded-lg border border-sidebar-border px-3 py-2">
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-md border border-sidebar-border bg-sidebar-accent/50 animate-pulse">
                      <span className="text-xs italic text-sidebar-foreground/30">r</span>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className="h-3.5 w-20 rounded bg-sidebar-accent/60 animate-pulse" />
                      <span className="h-2.5 w-14 rounded bg-sidebar-accent/40 animate-pulse" />
                    </div>
                  </div>
                </SidebarMenuItem>
              )}
              {machines.map((m) => (
                <InstanceItem
                  key={m.id}
                  instance={machineToInstance(m, gatewayConnected)}
                  isActive={pathname === "/console/status" || pathname === "/console/dashboard"}
                  onStop={() => stopMachine(m.id)}
                  onStart={() => startMachine(m.id)}
                  onDelete={() => deleteMachine(m.id)}
                />
              ))}
              {!loading && machines.length === 0 && (
                <AddInstanceItem onClick={() => router.push("/console/onboarding")} />
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Onboarding — animated exit when user has instance and navigates away */}
        <OnboardingSection show={!hasInstances || pathname === "/console/onboarding"} hasInstances={hasInstances} pathname={pathname} />



        {/* Navigation */}
        <SidebarGroup className="px-2 py-1">
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href;
                const primaryStatus = machines[0] ? flyStateToStatus(machines[0].state, gatewayConnected) : null;
                const notReady = primaryStatus === "provisioning" || primaryStatus === "connecting" || primaryStatus === "stopping";
                const disabled = !hasInstances || notReady;
                const tooltip = !hasInstances
                  ? "Create an instance first"
                  : primaryStatus === "provisioning"
                  ? "Instance is starting up…"
                  : primaryStatus === "connecting"
                  ? "Connecting to instance…"
                  : primaryStatus === "stopping"
                  ? "Instance is stopping…"
                  : item.label;
                const isControlUi = item.href === "/console/control-ui";
                return (
                  <SidebarMenuItem key={item.href} className={isControlUi ? "group/control-ui" : undefined}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={tooltip}
                      render={disabled ? <span /> : <Link href={item.href} />}
                      aria-disabled={disabled}
                      className={cn(
                        "h-9 gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                        "data-[active]:bg-sidebar-primary/10 data-[active]:text-sidebar-primary data-[active]:ring-sidebar-primary/40 data-[active]:shadow-[0_1px_6px_rgba(0,0,0,0.18)]",
                        !active && "text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                        disabled && "pointer-events-none opacity-35",
                        isControlUi && "pr-8"
                      )}
                    >
                      <item.icon className="size-4 shrink-0" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                    {isControlUi && (
                      <button
                        className={cn(
                          "absolute right-1.5 top-1/2 -translate-y-1/2 flex size-6 items-center justify-center rounded-md",
                          "text-sidebar-foreground/35 transition-colors",
                          "hover:text-sidebar-foreground",
                          disabled && "pointer-events-none"
                        )}
                        title="Open in new tab"
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          try {
                            const r = await fetch("/api/gate/ws-auth");
                            const data = await r.json() as { url?: string; token?: string; gatewayToken?: string; error?: string };
                            if (!r.ok || !data.url || !data.token || !data.gatewayToken) throw new Error(data.error ?? "Failed");
                            const httpBase = data.url.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
                            window.open(`${httpBase}/__openclaw__/?jwt=${encodeURIComponent(data.token)}&token=${encodeURIComponent(data.gatewayToken)}`, "_blank");
                          } catch {
                            // ignore
                          }
                        }}
                      >
                        <ExternalLinkIcon className="size-3.5" />
                      </button>
                    )}
                  </SidebarMenuItem>
                );
              })}
              {showDebug && DEBUG_NAV_ITEMS.map((item) => {
                const active = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.label}
                      render={<Link href={item.href} />}
                      className={cn(
                        "h-9 gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                        "data-[active]:bg-sidebar-primary/10 data-[active]:text-sidebar-primary data-[active]:ring-sidebar-primary/40 data-[active]:shadow-[0_1px_6px_rgba(0,0,0,0.18)]",
                        !active && "text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      )}
                    >
                      <item.icon className="size-4 shrink-0" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>

      <SidebarFooter className="px-3 py-3">
        <div className="space-y-2">
          <RoadmapDialog open={showRoadmap} onOpenChange={setShowRoadmap} />
          <AnimatePresence>
            {showRoadmapBanner && (
              <motion.div
                className="group relative flex w-full items-center gap-3 p-px cursor-pointer"
                style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-dim))", borderRadius: "10px" }}
                onClick={() => setShowRoadmap(true)}
                initial={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, y: 4 }}
                transition={{ duration: 0.2, ease: "easeIn" }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {/* inner surface */}
                <div className="relative flex w-full items-center gap-3 overflow-hidden rounded-[9.1px] bg-[var(--surface)] px-3 py-2.5">
                  {/* shimmer */}
                  <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[var(--accent)]/8 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
                  <RocketIcon className="size-4 shrink-0 text-[var(--accent)]" />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm font-semibold text-[var(--text)]">Roadmap</span>
                    <span className="text-xs text-[var(--muted)]">See what we're building</span>
                  </div>
                  <button
                    onClick={dismissRoadmapBanner}
                    className="relative z-10 rounded p-0.5 text-[var(--muted)] hover:text-[var(--text)] transition-colors"
                    aria-label="Dismiss"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <UserPill />
        </div>
      </SidebarFooter>

    </Sidebar>
  );
}
