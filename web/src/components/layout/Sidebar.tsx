import { NavLink } from "react-router-dom";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { Info, ScanSearch, TrendingUp, History, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ShieldMark } from "@/components/brand/ShieldMark";
import { BrandLockup } from "@/components/brand/BrandLockup";
import { useT, type MessageKey } from "@/i18n";
import { useSidebar } from "./SidebarContext";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  labelKey: MessageKey;
  icon: React.ReactNode;
  /** Exact match only, otherwise "/" would light up on every route. */
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/check", labelKey: "nav.check", icon: <ScanSearch size={22} />, end: true },
  { to: "/trends", labelKey: "nav.trends", icon: <TrendingUp size={22} /> },
  { to: "/history", labelKey: "nav.history", icon: <History size={22} /> },
  { to: "/about", labelKey: "nav.about", icon: <Info size={22} /> },
];

/** A single nav row. Layout never changes between rail and drawer; only the
 *  aside's width does, so labels reveal in step with the width transition. */
function SidebarLink({ item, expanded, onNavigate }: { item: NavItem; expanded: boolean; onNavigate?: () => void }) {
  const t = useT();
  const label = t(item.labelKey);
  const link = (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      aria-label={expanded ? undefined : label}
      className={({ isActive }) =>
        cn(
          "relative flex h-12 w-full items-center gap-3 overflow-hidden rounded-lg pr-3 text-base font-medium transition-colors duration-200",
          isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden
            className={cn(
              "absolute left-0 top-1/2 w-1 -translate-y-1/2 rounded-r-full bg-primary transition-all duration-200",
              isActive ? "h-6 opacity-100" : "h-0 opacity-0",
            )}
          />
          <span className="grid size-rail-item shrink-0 place-items-center">{item.icon}</span>
          <span className="flex-1 truncate">{label}</span>
        </>
      )}
    </NavLink>
  );

  if (expanded) return link;

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

/** The drawer body, shared by the desktop column and the mobile sheet. */
function SidebarBody({
  expanded,
  onNavigate,
  collapsible,
}: {
  expanded: boolean;
  onNavigate?: () => void;
  collapsible?: boolean;
}) {
  const t = useT();
  const { toggle } = useSidebar();

  return (
    <div className="app-sidebar flex h-full flex-col">
      <div className="sidebar-brand flex h-topbar shrink-0 items-center overflow-hidden border-b border-border px-4">
        {expanded ? <BrandLockup /> : <span className="grid size-rail-item shrink-0 place-items-center"><ShieldMark size={32} /></span>}
        {onNavigate && <button type="button" onClick={onNavigate} aria-label={t("nav.close")} className="ml-auto grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"><X size={20} aria-hidden /></button>}
      </div>

      <nav aria-label={t("nav.label")} className="hide-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-4 py-4">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <SidebarLink item={item} expanded={expanded} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      </nav>

      {collapsible && (
        <div className="shrink-0 border-t border-border p-4">
          <button
            type="button"
            onClick={toggle}
            aria-label={expanded ? t("nav.collapse") : t("nav.expand")}
            className="flex h-12 w-full items-center gap-3 overflow-hidden rounded-lg pr-3 text-base text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <span className="grid size-rail-item shrink-0 place-items-center">
              {expanded ? <PanelLeftClose size={22} /> : <PanelLeftOpen size={22} />}
            </span>
            <span className="truncate">{t("nav.collapse")}</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const t = useT();
  const { expanded, isMobile, mobileOpen, setMobileOpen } = useSidebar();

  if (isMobile) {
    return (
      <SheetPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetPrimitive.Portal>
          <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <SheetPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 w-sidebar border-r border-border bg-card shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left data-[state=closed]:duration-[195ms] data-[state=open]:duration-[225ms]"
          >
            <SheetPrimitive.Title className="sr-only">{t("nav.label")}</SheetPrimitive.Title>
            <SidebarBody expanded onNavigate={() => setMobileOpen(false)} />
          </SheetPrimitive.Content>
        </SheetPrimitive.Portal>
      </SheetPrimitive.Root>
    );
  }

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden overflow-hidden border-r border-border bg-card md:block"
      style={{
        width: expanded ? "var(--sidebar-w)" : "var(--sidebar-w-mini)",
        transition: `width ${expanded ? "var(--dur-enter)" : "var(--dur-exit)"} var(--ease-emphasized)`,
      }}
    >
      <SidebarBody expanded={expanded} collapsible />
    </aside>
  );
}
