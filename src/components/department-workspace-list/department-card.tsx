import { formatDistanceToNow } from "date-fns";
import { Building2, ExternalLink, LayoutGrid } from "lucide-react";

import { AccessBadge } from "@/components/department-workspace-list/access-badge";
import { DepartmentAIAccessorButton } from "@/components/department-workspace-list/department-ai-accessor-button";
import { QuickKPIBlock } from "@/components/department-workspace-list/quick-kpi-block";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DepartmentWorkspaceListItem } from "@/types/department-workspace-list";

function statusBadgeClass(status: DepartmentWorkspaceListItem["status"]) {
  if (status === "active") {
    return "bg-[rgb(0_210_122/0.12)] text-[rgb(0_210_122)] border-[rgb(0_210_122/0.35)]";
  }
  if (status === "paused") {
    return "bg-amber-500/10 text-amber-400 border-amber-500/30";
  }
  return "bg-muted/40 text-muted-foreground border-border/60";
}

export type DepartmentCardProps = {
  department: DepartmentWorkspaceListItem;
  onOpenWorkspace: () => void;
  onOpenAI: () => void;
  onViewDetails: () => void;
};

export function DepartmentCard({
  department,
  onOpenWorkspace,
  onOpenAI,
  onViewDetails,
}: DepartmentCardProps) {
  const d = department ?? ({} as DepartmentWorkspaceListItem);
  const name = typeof d.name === "string" && d.name.trim() ? d.name : "Department";
  const lead =
    d.leadName === null || d.leadName === undefined
      ? "—"
      : String(d.leadName).trim() || "—";
  const headcount =
    typeof d.headcount === "number" && Number.isFinite(d.headcount)
      ? d.headcount
      : 0;
  const status = d.status ?? "active";
  const typeLabel =
    d.type === null || d.type === undefined
      ? null
      : String(d.type).trim() || null;
  const metrics = d.metrics ?? {
    openTasks: 0,
    newMessages: 0,
    activeMembers: 0,
    lastActivity: "",
    kpis: 0,
    documents: 0,
  };
  const lastActivityLabel =
    typeof metrics.lastActivity === "string" && metrics.lastActivity
      ? (() => {
          try {
            return formatDistanceToNow(new Date(metrics.lastActivity), {
              addSuffix: true,
            });
          } catch {
            return metrics.lastActivity;
          }
        })()
      : "—";

  return (
    <Card
      className={cn(
        "col-span-12 border-border/80 bg-card/95 shadow-card transition-all duration-200",
        "hover:-translate-y-1 hover:shadow-card-hover hover:shadow-[0_0_28px_rgb(154_208_255/0.07)]",
        "motion-reduce:transform-none motion-reduce:hover:shadow-card",
        "sm:col-span-6 xl:col-span-4",
      )}
    >
      <CardHeader className="space-y-3 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Building2
                className="h-4 w-4 shrink-0 text-[rgb(154_208_255)]"
                aria-hidden
              />
              <h3 className="font-display text-lg font-bold tracking-tight text-foreground">
                {name}
              </h3>
            </div>
            {typeLabel ? (
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {typeLabel}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                statusBadgeClass(status),
              )}
            >
              {status}
            </span>
            <AccessBadge role={d.userRole ?? "Member"} />
          </div>
        </div>
        <dl className="grid gap-1 text-sm text-muted-foreground">
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">Lead</dt>
            <dd className="text-right text-foreground">{lead}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">Headcount</dt>
            <dd className="tabular-nums text-foreground">{headcount}</dd>
          </div>
        </dl>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <QuickKPIBlock label="Open tasks" value={metrics.openTasks} />
          <QuickKPIBlock label="New messages" value={metrics.newMessages} />
          <QuickKPIBlock label="Active members" value={metrics.activeMembers} />
          <QuickKPIBlock label="Last activity" value={lastActivityLabel} />
        </div>
        <div
          className="flex flex-col gap-2 border-t border-border/40 pt-4 sm:flex-row sm:flex-wrap"
          role="group"
          aria-label={`Actions for ${name}`}
        >
          <DepartmentAIAccessorButton
            departmentName={name}
            disabled={d.aiAvailable === false}
            onOpen={onOpenAI}
            className="flex-1 sm:flex-none"
          />
          <Button
            type="button"
            variant="cta"
            size="sm"
            className="min-h-11 flex-1 transition-transform duration-150 hover:scale-[1.02] motion-reduce:hover:scale-100 sm:flex-none"
            onClick={onOpenWorkspace}
            aria-label={`Open workspace for ${name}`}
          >
            <LayoutGrid className="mr-1.5 h-4 w-4" aria-hidden />
            Workspace
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 flex-1 text-muted-foreground sm:flex-none"
            onClick={onViewDetails}
            aria-label={`View details for ${name}`}
          >
            <ExternalLink className="mr-1.5 h-4 w-4" aria-hidden />
            Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
