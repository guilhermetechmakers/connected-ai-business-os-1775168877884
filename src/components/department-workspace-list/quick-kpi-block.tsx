import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type QuickKPIBlockProps = {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  className?: string;
};

export function QuickKPIBlock({
  label,
  value,
  icon: Icon,
  className,
}: QuickKPIBlockProps) {
  const display =
    typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : String(value ?? "—");

  return (
    <div
      className={cn(
        "rounded-lg border border-[rgb(21_78_120/0.35)] bg-surface-inner/80 px-3 py-2",
        "transition-colors duration-150",
        className,
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 flex items-center gap-1.5">
        {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-[rgb(154_208_255)]" aria-hidden /> : null}
        <span className="font-display text-lg font-bold tabular-nums text-[rgb(154_208_255)]">
          {display}
        </span>
      </div>
    </div>
  );
}
