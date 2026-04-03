import { AlertTriangle, ListOrdered, ShieldCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { UnifiedEntity } from "@/types/unified";
import { payloadString, payloadTitle } from "@/types/unified";

export type OverviewWidgetPanelProps = {
  tasks: UnifiedEntity[];
  kpis: UnifiedEntity[];
  isLoading?: boolean;
  className?: string;
};

function isBlockerTask(payload: unknown): boolean {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  const o = payload as Record<string, unknown>;
  const p = typeof o.priority === "string" ? o.priority.toLowerCase() : "";
  const s = typeof o.status === "string" ? o.status.toLowerCase() : "";
  const flag = o.blocker === true || o.isBlocker === true;
  return flag || p === "p0" || p === "critical" || s === "blocked";
}

export function OverviewWidgetPanel({
  tasks,
  kpis,
  isLoading = false,
  className,
}: OverviewWidgetPanelProps) {
  const taskList = Array.isArray(tasks) ? tasks : [];
  const kpiList = Array.isArray(kpis) ? kpis : [];

  const priorities = taskList.filter((t) => {
    const p = payloadString(t.payload, "priority")?.toLowerCase() ?? "";
    return p === "high" || p === "p1" || p === "critical";
  });
  const prioritySlice = (priorities.length > 0 ? priorities : taskList).slice(0, 5);

  const blockers = taskList.filter((t) => isBlockerTask(t.payload));

  const done = taskList.filter((t) => {
    const s = payloadString(t.payload, "status")?.toLowerCase() ?? "";
    return s === "done" || s === "completed";
  }).length;
  const healthPct =
    taskList.length > 0 ? Math.round((done / taskList.length) * 100) : 0;

  return (
    <div
      className={cn("grid gap-4 lg:grid-cols-3", className)}
      aria-label="Department overview widgets"
    >
      <Card className="border-border/80 bg-card/90 shadow-card transition-all duration-150 hover:-translate-y-1 hover:shadow-card-hover">
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <ListOrdered className="h-5 w-5 text-primary" aria-hidden />
          <CardTitle className="text-base">Top priorities</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : prioritySlice.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No priority tasks yet. Add tasks from the Tasks tab.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {prioritySlice.map((t) => (
                <li
                  key={t.id}
                  className="rounded-lg border border-border/60 bg-surface-inner/70 px-3 py-2"
                >
                  <span className="font-medium text-foreground">
                    {payloadTitle(t.payload)}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {payloadString(t.payload, "status") ?? "open"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/90 shadow-card transition-all duration-150 hover:-translate-y-1 hover:shadow-card-hover">
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <AlertTriangle className="h-5 w-5 text-amber-400/90" aria-hidden />
          <CardTitle className="text-base">Current blockers</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24 w-full rounded-lg" />
          ) : blockers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No explicit blockers flagged on Task entities.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {blockers.slice(0, 6).map((t) => (
                <li
                  key={t.id}
                  className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2"
                >
                  {payloadTitle(t.payload)}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/90 shadow-card transition-all duration-150 hover:-translate-y-1 hover:shadow-card-hover">
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <ShieldCheck className="h-5 w-5 text-success" aria-hidden />
          <CardTitle className="text-base">Department health</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <Skeleton className="h-16 w-full rounded-lg" />
          ) : (
            <>
              <div>
                <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                  <span>Task completion (unified)</span>
                  <span className="font-mono text-foreground">{healthPct}%</span>
                </div>
                <Progress
                  value={healthPct}
                  className="h-2 bg-surface-inner"
                  aria-label="Completion progress"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                KPI entities tracked:{" "}
                <span className="font-medium text-foreground">{kpiList.length}</span>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
