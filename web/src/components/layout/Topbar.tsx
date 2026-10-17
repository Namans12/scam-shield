import { Menu } from "lucide-react";
import { BrandLockup } from "@/components/brand/BrandLockup";
import { useT } from "@/i18n";
import { LanguageToggle } from "./LanguageToggle";
import { useSidebar } from "./SidebarContext";

export function Topbar() {
  const t = useT();
  const { toggle, isMobile, mobileOpen } = useSidebar();

  return (
    <header className="bar border-b border-border">
      <div className="shell-topbar-inner flex min-h-topbar items-center gap-3 px-4 sm:px-gutter">
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
        <div className="mobile-shell-brand md:hidden"><BrandLockup compact /></div>
        <p className="hidden text-sm font-medium text-muted-foreground md:block">{t("brand.tagline")}</p>

        <div className="flex-1" />

        <LanguageToggle />
      </div>
    </header>
  );
}
