"use client";

import { PanelLeftIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "./_components/app-sidebar";
import { MachinesProvider } from "./_context/machines-context";
import { GatewayProvider } from "./_context/gateway-context";
import { ChatProvider } from "./_context/chat-context";
import { SessionsProvider } from "./_context/sessions-context";
import { useTranslation } from "./_context/i18n-context";

const EASE = "cubic-bezier(0.22,1,0.36,1)";
const IS_TAURI = typeof window !== "undefined" && !!window.__TAURI__;

// SidebarTrigger styling, split by concern. When the sidebar is expanded the
// trigger slides into the sidebar's header area and adopts the sidebar's
// surface/text colors; when collapsed it floats over the content as a chip.
const TRIGGER_BASE =
  "fixed top-3 left-3 z-50 size-8 rounded-lg shadow-lg transition-[translate,colors,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]";
const TRIGGER_FLOATING =
  "border border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-sm text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hi)]";
// Applied via the parent SidebarProvider's data-state="expanded" group on md+.
const TRIGGER_DOCKED =
  "md:group-data-[state=expanded]/sidebar-wrapper:translate-x-[245px] md:group-data-[state=expanded]/sidebar-wrapper:border-transparent md:group-data-[state=expanded]/sidebar-wrapper:bg-sidebar md:group-data-[state=expanded]/sidebar-wrapper:shadow-none md:group-data-[state=expanded]/sidebar-wrapper:text-sidebar-foreground/40 md:group-data-[state=expanded]/sidebar-wrapper:hover:bg-sidebar-accent md:group-data-[state=expanded]/sidebar-wrapper:hover:text-sidebar-foreground";

function ConsoleTrigger() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { state, isMobile, openMobile, toggleSidebar } = useSidebar();
  const isControlUi = pathname === "/console/control-ui";
  const sidebarHidden = isMobile ? !openMobile : state === "collapsed";
  const showPill = isControlUi && sidebarHidden;

  return (
    <>
      {/* Floating pill — slides in on control-ui when sidebar is hidden */}
      <div
        id="sidebar-pill"
        className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center rouned-md"
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
            {t("sidebar.open-sidebar")}
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
        className={cn(TRIGGER_BASE, TRIGGER_FLOATING, TRIGGER_DOCKED)}
      />
    </>
  );
}

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <MachinesProvider>
      <GatewayProvider>
        <SessionsProvider>
        <ChatProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            {IS_TAURI && (
              <div
                data-tauri-drag-region
                className="fixed inset-x-0 top-0 z-[1] h-16"
              />
            )}
            <ConsoleTrigger />
            {children}
          </SidebarInset>
        </SidebarProvider>
        </ChatProvider>
        </SessionsProvider>
      </GatewayProvider>
    </MachinesProvider>
  );
}
