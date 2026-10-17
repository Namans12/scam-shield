import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex min-h-12 w-full rounded-lg border border-input bg-card shadow-[var(--shadow-sm)] px-4 py-2 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
