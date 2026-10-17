import type { LucideIcon } from "lucide-react";
import { useScrollFlow } from "@/hooks/use-scroll-flow";
import { cn } from "@/lib/utils";

export interface FlowItem {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
}

/**
 * An ordered list with a rail that fills as the reader scrolls (horizontal on wide screens, vertical on phones).
 * Each item lights up when the rail reaches it. All text is always fully readable: only the rail, node, number and icon change.
 */
export function ScrollFlow({ items, variant, labelledBy, vertical = false }: { items: readonly FlowItem[]; variant: "steps" | "cards"; labelledBy: string; vertical?: boolean }) {
  const { ref, reached } = useScrollFlow<HTMLOListElement>(items.length);
  return (
    <ol ref={ref} aria-labelledby={labelledBy} className={cn("flow", variant === "steps" ? "flow-steps" : "flow-cards", vertical && "flow-vertical")}>
      {items.map(({ id, icon: Icon, title, description }, index) => (
        <li
          key={id}
          className={cn("flow-item", variant === "cards" && "action-card glow-hover")}
          data-reached={index < reached}
          data-current={index === reached - 1}
        >
          <span className="flow-node" aria-hidden />
          <div className="flow-top">
            <span className="flow-number" aria-hidden>0{index + 1}</span>
            <Icon size={variant === "cards" ? 28 : 26} strokeWidth={1.5} aria-hidden />
          </div>
          <h3>{title}</h3>
          <p>{description}</p>
        </li>
      ))}
    </ol>
  );
}
