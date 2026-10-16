import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

const STORAGE_KEY = "scamshield:sidebar-expanded";

interface SidebarState {
  /** Desktop: the drawer shows labels (240px) rather than the icon rail (72px). */
  expanded: boolean;
  toggleExpanded: () => void;
  /** Mobile: the drawer is an overlay sheet instead of an inline column. */
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  isMobile: boolean;
  /** One handler for the menu button: collapses on desktop, opens the sheet on mobile. */
  toggle: () => void;
}

const SidebarContext = createContext<SidebarState | null>(null);

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(readStored);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(expanded));
    } catch {
      // Storage may be blocked; the preference then lasts for this visit only.
    }
  }, [expanded]);

  const toggleExpanded = useCallback(() => setExpanded((v) => !v), []);
  const toggle = useCallback(() => {
    if (isMobile) setMobileOpen((v) => !v);
    else setExpanded((v) => !v);
  }, [isMobile]);

  const value = useMemo(
    () => ({ expanded, toggleExpanded, mobileOpen, setMobileOpen, isMobile, toggle }),
    [expanded, toggleExpanded, mobileOpen, isMobile, toggle],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar(): SidebarState {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used inside <SidebarProvider>");
  return ctx;
}
