import { Menu } from "lucide-react";
import { ShieldMark } from "@/components/brand/ShieldMark";
import { useT } from "@/i18n";
import { LanguageToggle } from "./LanguageToggle";
import { useSidebar } from "./SidebarContext";

export function Topbar() {
  const t = useT();
  const { toggle, isMobile, mobileOpen } = useSidebar();

  return (
    <header className="bar border-b border-border">
      <div className="flex h-topbar items-center gap-3 px-4 sm:px-gutter">
        {/* The wordmark lives in the sidebar on desktop; on mobile the drawer
            is hidden, so the topbar carries the menu button and the wordmark. */}
        {isMobile && (
          <button
            type="button"
            onClick={toggle}
            aria-label={mobileOpen ? t("nav.close") : t("nav.open")}
            aria-expanded={mobileOpen}
            className="grid size-11 shrink-0 place-items-center rounded-lg text-foreground hover:bg-secondary"
          >
            <Menu size={24} />
          </button>
        )}
        <div className="flex min-w-0 items-center gap-2 md:hidden">
          <ShieldMark size={28} />
          <span className="truncate text-lg font-bold tracking-tight">{t("app.name")}</span>
        </div>

        <div className="flex-1" />

        <LanguageToggle />
      </div>
    </header>
  );
}
