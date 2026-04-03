import { useCallback, useState } from "react";

import { cn } from "@/lib/utils";
import type { ExecutiveDepartmentHeatCell } from "@/types/executive-dashboard";

export type CrossDepartmentHeatmapProps = {
  cells: ExecutiveDepartmentHeatCell[];
  onCellActivate?: (cell: ExecutiveDepartmentHeatCell) => void;
  className?: string;
};

function intensityStyles(intensity: number): string {
  const t = Math.min(100, Math.max(0, intensity));
  if (t >= 85) return "bg-success/25 border-success/50 text-foreground";
  if (t >= 70) return "bg-primary/20 border-primary/40 text-foreground";
  if (t >= 50) return "bg-primary/10 border-border/60 text-foreground";
  return "bg-surface-inner border-border/50 text-muted-foreground";
}

export function CrossDepartmentHeatmap({ cells, onCellActivate, className }: CrossDepartmentHeatmapProps) {
  const list = Array.isArray(cells) ? cells : [];
  const [focusIndex, setFocusIndex] = useState(0);

  const moveFocus = useCallback(
    (delta: number) => {
      if (list.length === 0) return;
      setFocusIndex((i) => {
        const next = (i + delta + list.length) % list.length;
        return next;
      });
    },
    [list.length],
  );

  return (
    <div className={cn("space-y-3", className)}>
      <p id="heatmap-help" className="text-xs text-muted-foreground">
        Arrow keys navigate cells; Enter or Space opens department drill-down.
      </p>
      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
        role="grid"
        aria-labelledby="heatmap-help"
      >
        {list.map((cell, index) => {
          const focused = index === focusIndex;
          return (
            <button
              key={cell.departmentId}
              type="button"
              role="gridcell"
              aria-selected={focused}
              className={cn(
                "min-h-[88px] rounded-xl border px-3 py-3 text-left transition-all duration-150",
                "hover:-translate-y-0.5 hover:shadow-card motion-reduce:hover:translate-y-0",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                intensityStyles(cell.intensity),
                focused && "ring-2 ring-primary/40",
              )}
              tabIndex={focused ? 0 : -1}
              onFocus={() => setFocusIndex(index)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                  e.preventDefault();
                  moveFocus(1);
                } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                  e.preventDefault();
                  moveFocus(-1);
                } else if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onCellActivate?.(cell);
                }
              }}
              onClick={() => onCellActivate?.(cell)}
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {cell.name}
              </p>
              <p className="mt-2 font-display text-2xl font-bold tabular-nums">{cell.intensity}</p>
              <p className="text-[10px] text-muted-foreground">intensity · {cell.trend}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
