"use client";

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./_components/app-sidebar";
import { MachinesProvider } from "./_context/machines-context";

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <MachinesProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <SidebarTrigger className="text-[var(--muted)] hover:text-[var(--text)] m-3 hover:bg-[var(--surface-hi)]" />
          {children}
        </SidebarInset>
      </SidebarProvider>
    </MachinesProvider>
  );
}
