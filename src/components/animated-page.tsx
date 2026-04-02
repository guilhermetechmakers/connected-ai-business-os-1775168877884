import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function AnimatedPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("animate-fade-in-up", className)}>{children}</div>
  );
}
