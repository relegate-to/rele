"use client";

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
import { AddInstanceItem, Instance, InstanceItem } from "./instance";
import UserPill from "./user-pill";

const NAV_ITEMS = [
  { label: "Status",    href: "/console",           icon: ActivityIcon },
  { label: "Dashboard", href: "/console/dashboard", icon: LayoutDashboardIcon },
  { label: "Settings",  href: "/console/settings",  icon: SettingsIcon },
] as const;

// Replace with real data fetching
const instance: Instance | null = {
  id: "id-1",
  name: "Atlas",
  status: "error",
  uptime: "01:13:07",
  spend: "$0.49",
  lastActive: "2 hours ago",
};

export function AppSidebar() {
  const pathname = usePathname();

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

        {/* Instance */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs">Instance</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {instance ? (
                <InstanceItem
                  instance={instance}
                  isActive={pathname.startsWith("/console")}
                  onStop={() => {}}
                  onRestart={() => {}}
                />
              ) : (
                <AddInstanceItem onClick={() => {}} />
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
  );
}
