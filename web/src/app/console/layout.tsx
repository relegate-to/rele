"use client";

import { PanelLeftIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "./_components/app-sidebar";
import { MachinesProvider } from "./_context/machines-context";
import { GatewayProvider } from "./_context/gateway-context";
import { ChatProvider } from "./_context/chat-context";

const EASE = "cubic-bezier(0.22,1,0.36,1)";

function ConsoleTrigger() {
  const pathname = usePathname();
  const { state, isMobile, openMobile, toggleSidebar } = useSidebar();
  const isControlUi = pathname === "/console/control-ui";
  const sidebarHidden = isMobile ? !openMobile : state === "collapsed";
  const showPill = isControlUi && sidebarHidden;

  return (
    <>
      {/* Floating pill — slides in on control-ui when sidebar is hidden */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center"
        style={{
          transform: showPill ? "translateY(0)" : "translateY(-56px)",
          transition: `transform 0.35s ${EASE}`,
        }}
      >
        <button
          onClick={toggleSidebar}
          className="pointer-events-auto mt-3 flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)]/80 px-3.5 py-1.5 shadow-sm backdrop-blur-sm transition-colors hover:bg-[var(--surface-hi)]"
        >
          <PanelLeftIcon className="size-3.5 text-[var(--muted)]" />
          <span className="font-[var(--font-dm-mono),monospace] text-[11px] tracking-wide text-[var(--muted)]">
            Open sidebar
          </span>
        </button>
      </div>

      {/* Standard trigger — fades out on control-ui when sidebar is hidden */}
      <SidebarTrigger
        style={{
          opacity: showPill ? 0 : 1,
          pointerEvents: showPill ? "none" : "auto",
          transition: `opacity 0.35s ${EASE}, translate 0.5s ${EASE}, colors 0.5s ${EASE}`,
        }}
        className="fixed top-3 left-3 z-50 size-8 rounded-lg border border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-sm shadow-lg transition-[translate,colors,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hi)] md:group-data-[state=expanded]/sidebar-wrapper:translate-x-[245px] md:group-data-[state=expanded]/sidebar-wrapper:border-transparent md:group-data-[state=expanded]/sidebar-wrapper:bg-sidebar md:group-data-[state=expanded]/sidebar-wrapper:shadow-none md:group-data-[state=expanded]/sidebar-wrapper:text-sidebar-foreground/40 md:group-data-[state=expanded]/sidebar-wrapper:hover:bg-sidebar-accent md:group-data-[state=expanded]/sidebar-wrapper:hover:text-sidebar-foreground"
      />
    </>
  );
}

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <MachinesProvider>
      <GatewayProvider>
        <ChatProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <ConsoleTrigger />
            {children}
          </SidebarInset>
        </SidebarProvider>
        </ChatProvider>
      </GatewayProvider>
    </MachinesProvider>
  );
}
