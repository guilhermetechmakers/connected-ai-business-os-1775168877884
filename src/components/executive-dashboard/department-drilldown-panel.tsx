import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

import { mapUnifiedEntityRows, payloadTitle } from "@/types/unified";
import { fetchDepartmentSnapshot } from "@/api/unified-data";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { Json } from "@/types/database";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export type DepartmentDrilldownPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId: string | null;
  departmentName: string | null;
};

export function DepartmentDrilldownPanel({
  open,
  onOpenChange,
  departmentId,
  departmentName,
}: DepartmentDrilldownPanelProps) {
  const validId = departmentId && isUuid(departmentId) ? departmentId : null;

  const snapQ = useQuery({
    queryKey: ["executive-dashboard", "department-drilldown", validId],
    queryFn: () => fetchDepartmentSnapshot(validId!),
    enabled: open && Boolean(validId) && isSupabaseConfigured,
  });

  const snap = snapQ.data;
  const kpis = Array.isArray(snap?.kpis) ? mapUnifiedEntityRows(snap.kpis) : [];
  const tasks = Array.isArray(snap?.tasks) ? mapUnifiedEntityRows(snap.tasks) : [];
  const workflows = Array.isArray(snap?.workflows) ? mapUnifiedEntityRows(snap.workflows) : [];
  const documents = Array.isArray(snap?.documents) ? mapUnifiedEntityRows(snap.documents) : [];

  const recentKpiTitles = kpis.slice(0, 5).map((e) => payloadTitle(e.payload as Json));
  const recentTasks = tasks.slice(0, 5).map((e) => payloadTitle(e.payload as Json));
  const recentWorkflows = workflows.slice(0, 4).map((e) => payloadTitle(e.payload as Json));
  const recentDocs = documents.slice(0, 4).map((e) => payloadTitle(e.payload as Json));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="border-border/80 bg-card sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{departmentName ?? "Department"}</SheetTitle>
          <SheetDescription>
            Scoped KPI and task snapshot for this department. Data respects tenant isolation.
          </SheetDescription>
        </SheetHeader>

        {!validId ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Connect live departments in Supabase to load a full drill-down. This workspace uses sample grid
            cells offline.
          </p>
        ) : null}

        {validId && snapQ.isLoading ? (
          <div className="mt-6 space-y-3" aria-busy="true">
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        ) : null}

        {validId && snapQ.isError ? (
          <p className="mt-6 text-sm text-destructive">Could not load department snapshot.</p>
        ) : null}

        {validId && snap && !snapQ.isLoading ? (
          <ScrollArea className="mt-6 h-[calc(100vh-12rem)] pr-3">
            <div className="space-y-6">
              <section aria-labelledby="dept-kpis-heading">
                <h3 id="dept-kpis-heading" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  KPIs
                </h3>
                <ul className="mt-2 space-y-1 text-sm text-foreground">
                  {recentKpiTitles.length > 0 ? (
                    recentKpiTitles.map((t, i) => (
                      <li key={i} className="rounded-md border border-border/40 px-2 py-1">
                        {t}
                      </li>
                    ))
                  ) : (
                    <li className="text-muted-foreground">No KPI rows in snapshot.</li>
                  )}
                </ul>
              </section>
              <section aria-labelledby="dept-tasks-heading">
                <h3 id="dept-tasks-heading" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Tasks
                </h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {recentTasks.length > 0 ? (
                    recentTasks.map((t, i) => (
                      <li key={i} className="text-foreground/90">
                        {t}
                      </li>
                    ))
                  ) : (
                    <li className="text-muted-foreground">No tasks in snapshot.</li>
                  )}
                </ul>
              </section>
              {(recentWorkflows.length > 0 || recentDocs.length > 0) ? (
                <section aria-labelledby="dept-more-heading">
                  <h3
                    id="dept-more-heading"
                    className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
                  >
                    Workflows & documents
                  </h3>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {recentWorkflows.map((t, i) => (
                      <li key={`w-${i}`}>{t}</li>
                    ))}
                    {recentDocs.map((t, i) => (
                      <li key={`d-${i}`}>{t}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          </ScrollArea>
        ) : null}

        {validId ? (
          <Button variant="outline" className="mt-6 w-full gap-2" asChild>
            <Link to={`/departments/${validId}`}>
              Open workspace
              <ExternalLink className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
