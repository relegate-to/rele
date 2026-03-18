"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ActivityIcon, LayoutDashboardIcon, SettingsIcon } from "lucide-react";
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
import { useMachines, type Machine } from "@/hooks/use-machines";
import { CreateMachineDialog } from "./create-machine-dialog";

const NAV_ITEMS = [
  { label: "Status",    href: "/console",           icon: ActivityIcon },
  { label: "Dashboard", href: "/console/dashboard", icon: LayoutDashboardIcon },
  { label: "Settings",  href: "/console/settings",  icon: SettingsIcon },
] as const;

function flyStateToStatus(state: string): InstanceStatus {
  switch (state) {
    case "started":
    case "running":
      return "running";
    case "created":
    case "starting":
      return "provisioning";
    case "stopping":
    case "destroying":
      return "stopping";
    case "stopped":
    case "destroyed":
      return "stopped";
    default:
      return "error";
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

export function AppSidebar() {
  const pathname = usePathname();
  const { machines, loading, createMachine, startMachine, stopMachine, deleteMachine } = useMachines();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
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

          {/* Instances */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs">
              {loading ? "Instances" : `Instances (${machines.length})`}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {machines.map((m) => {
                  const instance = machineToInstance(m);
                  return (
                    <InstanceItem
                      key={m.id}
                      instance={instance}
                      isActive={pathname.startsWith("/console")}
                      onStop={() => stopMachine(m.id)}
                      onStart={() => startMachine(m.id)}
                      onDelete={() => deleteMachine(m.id)}
                    />
                  );
                })}
                {machines.length === 0 && (
                  <AddInstanceItem onClick={() => setCreateOpen(true)} />
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Navigation */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs">Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={item.label}
                        render={<Link href={item.href} />}
                      >
                        <item.icon className="size-4 opacity-70" />
                        <span className="text-sm">
                          {item.label}
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border px-2 py-2">
          <UserPill />
        </SidebarFooter>

      </Sidebar>

      <CreateMachineDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={async (config) => {
          await createMachine(config);
          setCreateOpen(false);
        }}
      />
    </>
  );
}
