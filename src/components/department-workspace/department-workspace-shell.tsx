import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type DepartmentWorkspaceShellProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Page chrome: radial glow and grid texture aligned with Connected AI Business OS tokens.
 */
export function DepartmentWorkspaceShell({
  children,
  className,
}: DepartmentWorkspaceShellProps) {
  return (
    <div
      className={cn(
        "relative space-y-8",
        "before:pointer-events-none before:absolute before:inset-x-0 before:-top-24 before:h-64 before:rounded-full before:bg-[radial-gradient(ellipse_at_center,rgb(7_18_40)_0%,rgb(11_26_42)_45%,transparent_70%)] before:opacity-90 before:content-['']",
        className,
      )}
    >
      <div className="relative">{children}</div>
    </div>
  );
}
