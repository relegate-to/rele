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
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import UserPill from "@/components/user-pill";

const NAV_ITEMS = [
  { label: "Status", href: "/console", icon: ActivityIcon },
  { label: "Dashboard", href: "/console/dashboard", icon: LayoutDashboardIcon },
  { label: "Settings", href: "/console/settings", icon: SettingsIcon },
] as const;

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar variant="floating">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="font-[var(--font-dm-mono),monospace] text-xs tracking-widest uppercase text-[var(--muted)]">
            Navigation
          </SidebarGroupLabel>
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
                      <item.icon />
                      <span className="font-[var(--font-dm-mono),monospace] text-sm">
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

      <SidebarFooter className="px-3 py-3">
        <UserPill />
      </SidebarFooter>
      </Sidebar>
  );
}
