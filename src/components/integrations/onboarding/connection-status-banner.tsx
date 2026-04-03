import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function ConnectionStatusBanner({
  variant = "info",
  children,
}: {
  variant?: "info" | "success" | "warning" | "error";
  children: ReactNode;
}) {
  const styles =
    variant === "success"
      ? "border-success/30 bg-success/10 text-foreground"
      : variant === "warning"
        ? "border-primary/30 bg-primary/10 text-foreground"
        : variant === "error"
          ? "border-destructive/40 bg-destructive/10 text-foreground"
          : "border-border/60 bg-surface-inner text-muted-foreground";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("rounded-xl border px-4 py-3 text-sm", styles)}
    >
      {children}
    </div>
  );
}
