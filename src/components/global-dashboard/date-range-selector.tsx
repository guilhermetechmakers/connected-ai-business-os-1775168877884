import { endOfDay, startOfDay, subDays } from "date-fns";

import type { DashboardDateRange } from "@/types/dashboard";
import { cn } from "@/lib/utils";

export function buildDateRangePreset(preset: "7d" | "30d" | "90d"): DashboardDateRange {
  const to = endOfDay(new Date());
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  const from = startOfDay(subDays(to, days));
  return { preset, fromIso: from.toISOString(), toIso: to.toISOString() };
}

const PRESETS: { value: "7d" | "30d" | "90d"; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
];

export type DateRangeSelectorProps = {
  value: DashboardDateRange;
  onChange: (next: DashboardDateRange) => void;
  className?: string;
};

export function DateRangeSelector({ value, onChange, className }: DateRangeSelectorProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Range
      </span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Date range presets">
        {PRESETS.map((p) => {
          const active = value.preset === p.value;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => onChange(buildDateRangePreset(p.value))}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                active
                  ? "bg-foreground text-background shadow-sm"
                  : "border border-border/60 bg-surface-inner text-muted-foreground hover:border-primary/30 hover:text-foreground",
              )}
              aria-pressed={active}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
