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
          <SidebarTrigger className="fixed top-[22px] left-3 z-50 size-7 transition-[translate,colors] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hi)] md:group-data-[state=expanded]/sidebar-wrapper:translate-x-[208px] md:group-data-[state=expanded]/sidebar-wrapper:text-sidebar-foreground/40 md:group-data-[state=expanded]/sidebar-wrapper:bg-sidebar md:group-data-[state=expanded]/sidebar-wrapper:hover:bg-sidebar-accent md:group-data-[state=expanded]/sidebar-wrapper:hover:text-sidebar-foreground" />
{children}
        </SidebarInset>
      </SidebarProvider>
    </MachinesProvider>
  );
}
