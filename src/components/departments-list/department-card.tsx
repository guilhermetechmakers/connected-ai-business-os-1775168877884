import { formatDistanceToNow } from "date-fns";
import { Building2, ExternalLink, LayoutGrid } from "lucide-react";
import { Link } from "react-router-dom";

import { AccessBadge } from "@/components/departments-list/access-badge";
import { DepartmentAIAccessorButton } from "@/components/departments-list/department-ai-accessor-button";
import { QuickKPIBlock } from "@/components/departments-list/quick-kpi-block";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DepartmentWorkspaceListItem } from "@/types/department-workspace";

export type DepartmentCardProps = {
  department: DepartmentWorkspaceListItem;
  workspaceHref: string;
  onViewDetails: (dept: DepartmentWorkspaceListItem) => void;
  className?: string;
};

function statusStyles(status: DepartmentWorkspaceListItem["status"]) {
  switch (status) {
    case "active":
      return "border-success/35 bg-success/10 text-success";
    case "paused":
      return "border-secondary/50 bg-secondary/15 text-secondary-foreground";
    case "inactive":
      return "border-muted-foreground/30 bg-muted/30 text-muted-foreground";
    default:
      return "border-border text-muted-foreground";
  }
}

export function DepartmentCard({
  department,
  workspaceHref,
  onViewDetails,
  className,
}: DepartmentCardProps) {
  const d = department;
  const name = d?.name ?? "Department";
  const lead = d?.leadName?.trim() || "—";
  const headcount =
    typeof d?.headcount === "number" && d.headcount >= 0 ? d.headcount : 0;
  const metrics = d?.metrics;
  const lastActivityLabel = (() => {
    const raw = metrics?.lastActivity;
    if (typeof raw !== "string" || !raw) return "—";
    const t = Date.parse(raw);
    if (Number.isNaN(t)) return "—";
    try {
      return formatDistanceToNow(new Date(t), { addSuffix: true });
    } catch {
      return "—";
    }
  })();

  return (
    <Card
      className={cn(
        "col-span-12 border-border/80 bg-card/95 shadow-card transition-all duration-200 md:col-span-6 xl:col-span-4",
        "hover:-translate-y-1 hover:border-primary/25 hover:shadow-card-hover motion-reduce:transform-none",
        className,
      )}
    >
      <CardHeader className="space-y-3 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-surface-inner">
              <Building2 className="h-4 w-4 text-accent" aria-hidden />
            </span>
            <div className="min-w-0">
              <h3 className="font-display text-lg font-bold leading-tight text-foreground">
                {name}
              </h3>
              {d?.type ? (
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {d.type}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                statusStyles(d?.status ?? "active"),
              )}
            >
              {d?.status ?? "active"}
            </span>
            <AccessBadge role={d?.userRole ?? "Member"} />
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Lead</dt>
            <dd className="truncate font-medium text-foreground">{lead}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Headcount</dt>
            <dd className="font-medium tabular-nums text-foreground">{headcount}</dd>
          </div>
        </dl>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <QuickKPIBlock
            label="Open tasks"
            value={metrics?.openTasks ?? 0}
            className="sm:col-span-1"
          />
          <QuickKPIBlock
            label="New msgs"
            value={metrics?.newMessages ?? 0}
            className="sm:col-span-1"
          />
          <QuickKPIBlock
            label="Active"
            value={metrics?.activeMembers ?? 0}
            className="sm:col-span-1"
          />
          <QuickKPIBlock
            label="Last activity"
            value={lastActivityLabel}
            className="sm:col-span-1"
          />
        </div>
        <div
          className="flex flex-col gap-2 border-t border-white/[0.05] pt-3 sm:flex-row"
          role="group"
          aria-label={`Actions for ${name}`}
        >
          <DepartmentAIAccessorButton
            departmentName={name}
            aiAvailable={d.aiAvailable === true}
            workspacePath={workspaceHref}
            className="sm:flex-1"
          />
          <Button
            variant="cta"
            size="sm"
            className="min-h-11 flex-1 transition-transform duration-150 hover:scale-[1.02] motion-reduce:transform-none"
            asChild
          >
            <Link to={workspaceHref} aria-label={`Open workspace for ${name}`}>
              <LayoutGrid className="mr-2 h-4 w-4" aria-hidden />
              Workspace
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 flex-1 text-muted-foreground"
            onClick={() => onViewDetails(d)}
            aria-label={`View details for ${name}`}
          >
            <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
            Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
