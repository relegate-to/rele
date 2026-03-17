import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SidebarTrigger className="text-[var(--muted)] hover:text-[var(--text)] m-3 hover:bg-[var(--surface-hi)]" />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
