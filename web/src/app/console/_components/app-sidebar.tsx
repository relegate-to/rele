"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useRef, useState, useEffect } from "react";
import { ActivityIcon, ArrowRightIcon, BarChart2Icon, BlocksIcon, BookOpenIcon, CheckCircle2Icon, ChevronRightIcon, ClockIcon, EyeIcon, EyeOffIcon, ExternalLinkIcon, Link2Icon, MessageCircleIcon, MessageSquareIcon, MonitorIcon, PlusIcon, RocketIcon, SettingsIcon, SparklesIcon, SquarePenIcon, SquareTerminalIcon, Trash2Icon, XIcon, ZapIcon } from "lucide-react";
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
import { useTranslation } from "../_context/i18n-context";
import { useSessions } from "../_context/sessions-context";

// ─── Nav items ────────────────────────────────────────────────────────────────

const MAIN_NAV = [
  { labelKey: "sidebar.canvas", href: "/console/canvas", icon: SquarePenIcon },
] as const;

const AUTOMATION_NAV = [
  { labelKey: "sidebar.skills",         href: "/console/skills",         icon: BlocksIcon },
  { labelKey: "sidebar.channels",       href: "/console/channels",       icon: Link2Icon },
  { labelKey: "sidebar.features",       href: "/console/features",       icon: ZapIcon },
  { labelKey: "sidebar.scheduled-jobs", href: "/console/scheduled-jobs", icon: ClockIcon },
  { labelKey: "sidebar.terminal",       href: "/console/terminal",       icon: SquareTerminalIcon },
] as const;

const ACCOUNT_NAV = [
  { labelKey: "sidebar.usage",    href: "/console/usage",    icon: BarChart2Icon },
  { labelKey: "sidebar.settings", href: "/console/settings", icon: SettingsIcon },
] as const;

const TOOLS_NAV = [
  { labelKey: "sidebar.control-ui", href: "/console/control-ui", icon: MonitorIcon, requiresInstance: true,  badge: "alpha" },
  { labelKey: "sidebar.status",     href: "/console/status",     icon: ActivityIcon, requiresInstance: false },
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
  t,
}: {
  show: boolean;
  hasInstances: boolean;
  pathname: string;
  t: (key: string) => string;
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
                tooltip={t("sidebar.onboarding.view-setup")}
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
                    {phase === "completing" ? t("sidebar.onboarding.all-done") : t("sidebar.onboarding.title")}
                  </span>
                  <span className="text-xs font-normal opacity-60">
                    {phase === "completing"
                      ? t("sidebar.onboarding.ready")
                      : hasInstances
                        ? t("sidebar.onboarding.view-setup")
                        : t("sidebar.onboarding.create")}
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

// ─── SessionItem ─────────────────────────────────────────────────────────────

function SessionItem({
  session,
  isActive,
  isEditing,
  editingLabel,
  onSelect,
  onStartEdit,
  onEditChange,
  onEditEnd,
  onEditCancel,
  onDelete,
  deleteLabel,
}: {
  session: { key: string; displayName: string };
  isActive: boolean;
  isEditing: boolean;
  editingLabel: string;
  onSelect: () => void;
  onStartEdit: () => void;
  onEditChange: (val: string) => void;
  onEditEnd: (val: string) => void;
  onEditCancel: () => void;
  onDelete: () => void;
  deleteLabel: string;
}) {
  return (
    <SidebarMenuItem className="group/session">
      {isEditing ? (
        <div className="flex h-8 items-center gap-2.5 rounded-lg pl-9 pr-2 [&_svg]:size-4 [&_svg]:shrink-0">
          <MessageCircleIcon className="text-sidebar-foreground/45" />
          <input
            autoFocus
            value={editingLabel}
            onChange={(e) => onEditChange(e.target.value)}
            onBlur={() => onEditEnd(editingLabel)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              else if (e.key === "Escape") onEditCancel();
            }}
            className="flex-1 min-w-0 bg-transparent text-sm text-sidebar-foreground outline-none border-b border-sidebar-foreground/15 mx-1"
          />
        </div>
      ) : (
        <SidebarMenuButton
          isActive={isActive}
          render={<Link href="/console/chat" />}
          onClick={onSelect}
          onDoubleClick={(e) => { e.preventDefault(); onStartEdit(); }}
          className={cn(
            "h-8 gap-2.5 rounded-lg pl-9 pr-2 text-sm font-normal transition-colors",
            "data-[active]:bg-sidebar-primary/10 data-[active]:text-sidebar-primary",
            !isActive && "text-sidebar-foreground/45 hover:bg-sidebar-accent hover:text-sidebar-foreground/70",
          )}
        >
          <MessageCircleIcon className="size-3.5 shrink-0" />
          <span className="flex-1 truncate">{session.displayName}</span>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onDelete(); } }}
            className="flex size-5 items-center justify-center rounded text-sidebar-foreground/0 transition-colors group-hover/session:text-sidebar-foreground/30 hover:!text-red-400"
            aria-label={deleteLabel}
          >
            <Trash2Icon className="size-3" />
          </span>
        </SidebarMenuButton>
      )}
    </SidebarMenuItem>
  );
}

// ─── AppSidebar ───────────────────────────────────────────────────────────────

export function AppSidebar() {
  const { t } = useTranslation();
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

  const { sessions, activeSessionKey, setActiveSessionKey, createSession, deleteSession, renameSession } = useSessions();
  const [editingSessionKey, setEditingSessionKey] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [sessionsExpanded, setSessionsExpanded] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [showRoadmap, setShowRoadmap] = useState(false);
  const [showRoadmapBanner, setShowRoadmapBanner] = useState(true);
  const dismissRoadmapBanner = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowRoadmapBanner(false);
    localStorage.setItem("roadmap-banner-dismissed", "1");
  };

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
            {t("sidebar.console")}
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
                  isActive={pathname === "/console/status"}
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
        <OnboardingSection show={!hasInstances || pathname === "/console/onboarding"} hasInstances={hasInstances} pathname={pathname} t={t} />

        {/* Chat + Sessions */}
        {(() => {
          const primaryStatus = machines[0] ? flyStateToStatus(machines[0].state, gatewayConnected) : null;
          const notReady = primaryStatus === "provisioning" || primaryStatus === "connecting" || primaryStatus === "stopping";
          const chatDisabled = !hasInstances || notReady;
          const isOnChat = pathname === "/console/chat";
          const isMainActive = isOnChat && activeSessionKey === "agent:main:main";
          const nonMainSessions = sessions.filter((s) => s.key !== "agent:main:main");
          const normalSessions = nonMainSessions.filter((s) => !s.displayName.startsWith("."));
          const hiddenSessions = nonMainSessions.filter((s) => s.displayName.startsWith("."));
          const hasHidden = hiddenSessions.length > 0;

          return (
            <SidebarGroup className="px-2 py-1">
              <SidebarGroupContent>
                <SidebarMenu>
                  {/* Chat row with expand toggle inside */}
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={isMainActive}
                      tooltip={chatDisabled ? t("sidebar.tooltip.create-instance") : t("sidebar.chat")}
                      render={chatDisabled ? <span /> : <Link href="/console/chat" />}
                      aria-disabled={chatDisabled}
                      onClick={() => {
                        if (!chatDisabled) setActiveSessionKey("agent:main:main");
                      }}
                      className={cn(
                        "h-9 gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                        "data-[active]:bg-sidebar-primary/10 data-[active]:text-sidebar-primary data-[active]:ring-sidebar-primary/40 data-[active]:shadow-[0_1px_6px_rgba(0,0,0,0.18)]",
                        !isMainActive && "text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                        chatDisabled && "pointer-events-none opacity-35",
                      )}
                    >
                      <MessageSquareIcon className="size-4 shrink-0" />
                      <span className="flex-1">{t("sidebar.chat")}</span>
                      {!chatDisabled && hasHidden && sessionsExpanded && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowHidden((v) => !v); }}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setShowHidden((v) => !v); } }}
                          className={cn(
                            "-mr-2.5 flex size-5 items-center justify-center rounded transition-colors hover:text-sidebar-foreground/60",
                            showHidden ? "text-sidebar-foreground/50" : "text-sidebar-foreground/25",
                          )}
                          aria-label={t("sidebar.sessions.show-hidden")}
                        >
                          {showHidden ? <EyeOffIcon className="!size-3.5" /> : <EyeIcon className="!size-3.5" />}
                        </span>
                      )}
                      {!chatDisabled && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSessionsExpanded((v) => !v); }}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setSessionsExpanded((v) => !v); } }}
                          className="flex size-5 items-center justify-center rounded text-sidebar-foreground/30 transition-colors hover:text-sidebar-foreground/60"
                          aria-label={t("sidebar.sessions")}
                        >
                          <ChevronRightIcon
                            className={cn(
                              "size-3.5 transition-transform duration-200",
                              sessionsExpanded && "rotate-90",
                            )}
                          />
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  {/* Sessions list — animated expand/collapse */}
                  {!chatDisabled && (
                    <li
                      className="grid transition-[grid-template-rows,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
                      style={{
                        gridTemplateRows: sessionsExpanded ? "1fr" : "0fr",
                        opacity: sessionsExpanded ? 1 : 0,
                      }}
                    >
                      <div className="overflow-hidden">
                        <ul className="flex flex-col">
                          {normalSessions.map((session) => (
                            <SessionItem
                              key={session.key}
                              session={session}
                              isActive={isOnChat && activeSessionKey === session.key}
                              isEditing={editingSessionKey === session.key}
                              editingLabel={editingLabel}
                              onSelect={() => setActiveSessionKey(session.key)}
                              onStartEdit={() => { setEditingSessionKey(session.key); setEditingLabel(session.displayName); }}
                              onEditChange={setEditingLabel}
                              onEditEnd={(val) => {
                                const trimmed = val.trim();
                                if (trimmed && trimmed !== session.displayName) renameSession(session.key, trimmed);
                                setEditingSessionKey(null);
                              }}
                              onEditCancel={() => setEditingSessionKey(null)}
                              onDelete={() => deleteSession(session.key)}
                              deleteLabel={t("sidebar.sessions.delete")}
                            />
                          ))}

                          {/* Hidden sessions — animated */}
                          {hasHidden && (
                            <li
                              className="grid transition-[grid-template-rows,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
                              style={{
                                gridTemplateRows: showHidden ? "1fr" : "0fr",
                                opacity: showHidden ? 1 : 0,
                              }}
                            >
                              <div className="overflow-hidden">
                                <ul className="flex flex-col">
                                  {hiddenSessions.map((session) => (
                                    <SessionItem
                                      key={session.key}
                                      session={session}
                                      isActive={isOnChat && activeSessionKey === session.key}
                                      isEditing={editingSessionKey === session.key}
                                      editingLabel={editingLabel}
                                      onSelect={() => setActiveSessionKey(session.key)}
                                      onStartEdit={() => { setEditingSessionKey(session.key); setEditingLabel(session.displayName); }}
                                      onEditChange={setEditingLabel}
                                      onEditEnd={(val) => {
                                        const trimmed = val.trim();
                                        if (trimmed && trimmed !== session.displayName) renameSession(session.key, trimmed);
                                        setEditingSessionKey(null);
                                      }}
                                      onEditCancel={() => setEditingSessionKey(null)}
                                      onDelete={() => deleteSession(session.key)}
                                      deleteLabel={t("sidebar.sessions.delete")}
                                    />
                                  ))}
                                </ul>
                              </div>
                            </li>
                          )}

                          {/* New session */}
                          <SidebarMenuItem>
                            <SidebarMenuButton
                              onClick={() => {
                                const name = `Session ${normalSessions.length + 1}`;
                                createSession(name).then(() => router.push("/console/chat"));
                              }}
                              className="h-8 gap-2.5 rounded-lg pl-9 pr-2 text-sm font-normal text-sidebar-foreground/35 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground/60"
                            >
                              <PlusIcon className="size-3.5 shrink-0" />
                              <span>{t("sidebar.sessions.new")}</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        </ul>
                      </div>
                    </li>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })()}

        {/* Navigation */}
        {(
          [
            { label: "MAIN",       items: MAIN_NAV,       requiresInstance: true  },
            { label: "AUTOMATION", items: AUTOMATION_NAV, requiresInstance: false },
            { label: "ACCOUNT",    items: ACCOUNT_NAV,    requiresInstance: false },
            { label: "TOOLS",      items: TOOLS_NAV,      requiresInstance: false },
          ] as const
        ).map((section, i) => {
          const primaryStatus = machines[0] ? flyStateToStatus(machines[0].state, gatewayConnected) : null;
          const notReady = primaryStatus === "provisioning" || primaryStatus === "connecting" || primaryStatus === "stopping";

          return (
            <React.Fragment key={section.label}>
            {i > 0 && <div className="h-px w-full bg-sidebar-border my-2" />}
            <SidebarGroup className="px-2 py-1">
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => {
                    const active = pathname === item.href;
                    const isExternal = !!(item as { external?: boolean }).external;
                    const itemRequiresInstance = !!(item as { requiresInstance?: boolean }).requiresInstance;
                    const badge = (item as { badge?: string }).badge;
                    const disabled = (section.requiresInstance || itemRequiresInstance) && (!hasInstances || notReady);
                    const tooltip = section.requiresInstance && !hasInstances
                      ? t("sidebar.tooltip.create-instance")
                      : section.requiresInstance && primaryStatus === "provisioning"
                      ? t("sidebar.tooltip.starting")
                      : section.requiresInstance && primaryStatus === "connecting"
                      ? t("sidebar.tooltip.connecting")
                      : section.requiresInstance && primaryStatus === "stopping"
                      ? t("sidebar.tooltip.stopping")
                      : t((item as any).labelKey);
                    return (
                      <SidebarMenuItem key={item.href}>
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
                          )}
                        >
                          <item.icon className="size-4 shrink-0" />
                          <span className="flex-1">{t((item as any).labelKey)}</span>
                          {badge && (
                            <span className="rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-400">
                              {t(`sidebar.badge.${badge}`)}
                            </span>
                          )}
                          {isExternal && (
                            <ExternalLinkIcon className="size-3 text-sidebar-foreground/25" />
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            </React.Fragment>
          );
        })}

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
                    <span className="text-sm font-semibold text-[var(--text)]">{t("sidebar.roadmap")}</span>
                    <span className="text-xs text-[var(--muted)]">{t("sidebar.roadmap.desc")}</span>
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
