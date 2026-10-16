import { cn } from "@/lib/utils";

/**
 * Scam Shield mark: a shield with a magnifying lens in it ("look closely"),
 * deliberately not a tick: nothing in this app is ever called safe.
 */
export function ShieldMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role="img"
      aria-label="Scam Shield"
      className={cn("shrink-0", className)}
    >
      <path
        d="M16 2.5 27.5 6.8v8.4c0 7.1-4.8 12.4-11.5 14.3C9.3 27.6 4.5 22.3 4.5 15.2V6.8L16 2.5Z"
        fill="var(--primary)"
      />
      <circle cx="15" cy="14" r="5.2" fill="none" stroke="var(--primary-foreground)" strokeWidth="2.4" />
      <path d="m19 18 4.4 4.4" stroke="var(--primary-foreground)" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
