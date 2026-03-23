"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, useEffect } from "react";
import { ActivityIcon, CheckCircle2Icon, LayoutDashboardIcon, MessageSquareIcon, SettingsIcon, SparklesIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { AddInstanceItem, InstanceItem } from "./instance";
import type { Instance, InstanceStatus } from "./instance";
import UserPill from "./user-pill";
import { useMachinesContext, type Machine } from "../_context/machines-context";

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: "Dashboard", href: "/console/dashboard", icon: LayoutDashboardIcon },
  { label: "Chat",      href: "/console/chat",      icon: MessageSquareIcon },
] as const;

const DEBUG_NAV_ITEMS = [
  { label: "Settings",  href: "/console/settings",  icon: SettingsIcon },
  { label: "Status",    href: "/console/status",    icon: ActivityIcon },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function flyStateToStatus(state: string): InstanceStatus {
  switch (state) {
    case "started":
    case "running":   return "running";
    case "created":
    case "starting":  return "provisioning";
    case "stopping":
    case "destroying": return "stopping";
    case "stopped":
    case "destroyed": return "stopped";
    default:          return "error";
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

function machineToInstance(m: Machine): Instance {
  const status = flyStateToStatus(m.state);
  const image = (m.config as { image?: string })?.image ?? "";
  const name = image.split("/").pop()?.split(":")[0] ?? m.flyMachineId.slice(0, 8);
  const regionLabel = REGION_LABELS[m.region] ?? m.region;
  return {
    id: m.id,
    name,
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
    // Trigger exit animation when show goes from true → false
    if (prevShow.current && !show) {
      // Measure current height before animating
      if (containerRef.current) {
        setMeasuredHeight(containerRef.current.scrollHeight);
      }
      setPhase("completing");
      const t1 = setTimeout(() => setPhase("collapsing"), 800);
      const t2 = setTimeout(() => setPhase("gone"), 1200);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    // Reset when show goes back to true
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
      <SidebarGroup>
        <SidebarGroupLabel className="text-xs">
          {phase === "completing" ? (
            <span className="flex items-center gap-1.5 text-[var(--status-success)] transition-colors duration-300">
              <CheckCircle2Icon className="size-3" />
              Setup complete
            </span>
          ) : (
            "Get started"
          )}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === "/console/onboarding"}
                tooltip="Set up your instance"
                render={<Link href="/console/onboarding" />}
                className={`h-auto gap-2.5 rounded-lg border px-2.5 py-2 transition-all duration-500 ${
                  phase === "completing"
                    ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success)]"
                    : "border-[var(--copper)]/20 bg-[var(--copper)]/5 text-[var(--copper)] hover:border-[var(--copper)]/40 hover:bg-[var(--copper)]/10"
                }`}
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
  const hasInstances = !loading && machines.length > 0;

  const [showDebug, setShowDebug] = useState(false);
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
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-[5px] border border-[#c8845a]/30 bg-[#fdf6ee] font-['Lora',Georgia,serif] text-xs italic text-[#c8845a]">
            r
          </div>
          <span className="font-['Lora',Georgia,serif] text-base italic tracking-[-0.01em] text-sidebar-foreground">
            rele
          </span>
          <span className="ml-auto text-xs text-sidebar-foreground/30">
            console
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>

        {/* Instances — add button when empty, instance when exists (max 1) */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs">
            {loading ? "Instances" : `Instances (${machines.length})`}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {loading && machines.length === 0 && (
                <SidebarMenuItem>
                  <div className="flex h-auto items-center gap-2.5 rounded-lg border border-sidebar-border px-2.5 py-2">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-sidebar-border bg-sidebar-accent/50 animate-pulse">
                      <span className="font-['Lora',Georgia,serif] text-sm italic text-sidebar-foreground/30">r</span>
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
                  instance={machineToInstance(m)}
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

        {/* Navigation — instance-required items disabled until ready */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const disabled = !hasInstances;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={pathname === item.href}
                      tooltip={disabled ? "Create an instance first" : item.label}
                      render={disabled ? <span /> : <Link href={item.href} />}
                      className={disabled ? "pointer-events-none opacity-35" : undefined}
                      aria-disabled={disabled}
                    >
                      <item.icon className="size-4 opacity-70" />
                      <span className="text-sm">{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              {showDebug && DEBUG_NAV_ITEMS.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={pathname === item.href}
                      tooltip={item.label}
                      render={<Link href={item.href} />}
                    >
                      <item.icon className="size-4 opacity-70" />
                      <span className="text-sm">{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-2 py-2">
        <UserPill />
      </SidebarFooter>

    </Sidebar>
  );
}
