import { Outlet } from "react-router-dom";
import { useT } from "@/i18n";
import { Sidebar } from "./Sidebar";
import { SidebarProvider, useSidebar } from "./SidebarContext";
import { Topbar } from "./Topbar";
import { Footer } from "./Footer";

function ShellFrame() {
  const t = useT();
  const { expanded } = useSidebar();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-foreground"
      >
        {t("nav.skip")}
      </a>
      <Sidebar />

      {/* The sidebar is fixed, so the content column is offset by its width and
          animates on the same curve. The offset is applied in CSS (.shell-content)
          because it only applies from the md breakpoint up. */}
      <div
        className="shell-content flex min-h-screen min-w-0 flex-col"
        style={{
          ["--shell-offset" as string]: expanded ? "var(--sidebar-w)" : "var(--sidebar-w-mini)",
          ["--shell-dur" as string]: expanded ? "var(--dur-enter)" : "var(--dur-exit)",
        }}
      >
        <div className="sticky top-0 z-30">
          <Topbar />
        </div>

        <main id="main" className="mx-auto w-full min-w-0 max-w-3xl flex-1 px-4 py-6 sm:px-gutter">
          <Outlet />
        </main>

        <Footer />
      </div>
    </div>
  );
}

export function AppShell() {
  return (
    <SidebarProvider>
      <ShellFrame />
    </SidebarProvider>
  );
}
