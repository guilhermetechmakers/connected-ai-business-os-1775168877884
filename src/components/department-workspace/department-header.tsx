import { GitBranch, ListPlus } from "lucide-react";
import { Link } from "react-router-dom";

import { KPIChip } from "@/components/department-workspace/kpi-chip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UnifiedEntity } from "@/types/unified";
import { payloadString } from "@/types/unified";

export type DepartmentHeaderProps = {
  departmentName: string;
  leadLabel?: string;
  kpis: UnifiedEntity[];
  onNewTask: () => void;
  departmentId: string;
  canCreateTask?: boolean;
  className?: string;
};

export function DepartmentHeader({
  departmentName,
  leadLabel,
  kpis,
  onNewTask,
  departmentId,
  canCreateTask = true,
  className,
}: DepartmentHeaderProps) {
  const kpiList = Array.isArray(kpis) ? kpis : [];
  const chips = kpiList.slice(0, 4).map((k) => {
    const raw = k.payload;
    const payload =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
    const label =
      typeof payload.label === "string"
        ? payload.label
        : typeof payload.name === "string"
          ? payload.name
          : k.entityType;
    const valueRaw = payload.value;
    const value =
      typeof valueRaw === "string" || typeof valueRaw === "number"
        ? String(valueRaw)
        : payloadString(k.payload, "value") ?? "—";
    const delta =
      typeof payload.delta === "string" ? payload.delta : undefined;
    const variant =
      delta?.startsWith("+") || delta?.toLowerCase().includes("up")
        ? "success"
        : "accent";
    return { id: k.id, label, value, variant: variant as "success" | "accent" };
  });

  return (
    <header
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/80 bg-card/95 p-6 shadow-card",
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-2xl before:ring-1 before:ring-[#154E78]/25",
        className,
      )}
    >
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Department workspace
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {departmentName}
          </h1>
          {leadLabel ? (
            <p className="text-sm text-muted-foreground">
              Lead ·{" "}
              <span className="text-foreground/90">{leadLabel}</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Lead · Unassigned</p>
          )}
          <div
            className="flex flex-wrap gap-2 pt-2"
            aria-label="Department KPI chips"
          >
            {chips.length === 0 ? (
              <KPIChip label="Health" value="No KPI entities yet" />
            ) : (
              chips.map((c) => (
                <KPIChip
                  key={c.id}
                  label={c.label}
                  value={c.value}
                  variant={c.variant}
                />
              ))
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col lg:items-end">
          <Button
            type="button"
            variant="cta"
            className="gap-2 transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
            onClick={onNewTask}
            disabled={!canCreateTask}
            aria-label="Create new task for this department"
          >
            <ListPlus className="h-4 w-4" aria-hidden />
            New task
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2 border-primary/25 bg-surface-inner/60 text-foreground transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40"
            asChild
          >
            <Link
              to={`/dashboard/workflows?departmentHint=${encodeURIComponent(departmentId)}`}
              aria-label="Open workflows and automations"
            >
              <GitBranch className="h-4 w-4" aria-hidden />
              Create workflow
            </Link>
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
            <Link to="/departments" aria-label="Back to all departments">
              All departments
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
