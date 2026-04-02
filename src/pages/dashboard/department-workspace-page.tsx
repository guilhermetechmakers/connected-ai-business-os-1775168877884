import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";

import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import { AIChatWidget } from "@/components/unified-data/ai-chat-widget";
import { DepartmentOverviewCard } from "@/components/unified-data/department-overview-card";
import { TaskBoard } from "@/components/unified-data/task-board";
import { UnifiedEntityCard } from "@/components/unified-data/unified-entity-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDepartmentWorkspace } from "@/hooks/use-unified-data";
import { mapUnifiedEntityRows, payloadTitle } from "@/types/unified";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function DepartmentWorkspacePage() {
  const { deptId } = useParams();
  const isUuid = Boolean(deptId && UUID_RE.test(deptId));

  const { data: snapshot, isLoading: snapLoading } = useDepartmentWorkspace(
    isUuid ? deptId : undefined,
  );

  const departmentName =
    snapshot?.department?.name ??
    (deptId ? deptId.replace(/-/g, " ") : "Department");

  const kpis = useMemo(
    () => mapUnifiedEntityRows(snapshot?.kpis ?? []),
    [snapshot?.kpis],
  );
  const tasks = useMemo(
    () => mapUnifiedEntityRows(snapshot?.tasks ?? []),
    [snapshot?.tasks],
  );
  const docs = useMemo(
    () => mapUnifiedEntityRows(snapshot?.documents ?? []),
    [snapshot?.documents],
  );
  const activities = useMemo(() => {
    const list = snapshot?.entities ?? [];
    return mapUnifiedEntityRows(
      list.filter((e) => e.entity_type === "Activity"),
    );
  }, [snapshot?.entities]);

  const contextSummary = useMemo(() => {
    const chunks = [...kpis, ...tasks, ...docs];
    return chunks
      .slice(0, 12)
      .map(
        (e) =>
          `${e.entityType}: ${payloadTitle(e.payload)} (id:${e.id.slice(0, 8)}…)`,
      )
      .join("\n");
  }, [kpis, tasks, docs]);

  const leadLabel = snapshot?.department?.lead_user_id ?? undefined;

  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title={departmentName}
        description="Lead, KPIs, tasks, reports, documents, and scoped AI assistant — fed by unified entities for this department."
      />

      {!isUuid ? (
        <Card className="border-border/80 border-amber-500/30 bg-card/90">
          <CardContent className="py-4 text-sm text-muted-foreground">
            This workspace URL uses a non-UUID department key. Seed a department in
            Supabase and open{" "}
            <code className="text-primary">/department/&lt;uuid&gt;</code> for live
            unified data.
          </CardContent>
        </Card>
      ) : null}

      <DepartmentOverviewCard
        departmentName={departmentName}
        leadLabel={leadLabel}
        kpis={kpis}
        isLoading={snapLoading}
      />

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="flex flex-wrap bg-surface-inner">
          {[
            "overview",
            "metrics",
            "tasks",
            "reports",
            "docs",
            "ai",
          ].map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">
              {t}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-border/80 bg-card/90">
              <CardHeader>
                <CardTitle>Team activity</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {snapLoading ? (
                  <p>Loading activity…</p>
                ) : activities.length === 0 ? (
                  <p>No department-scoped activity entities yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {activities.map((a) => (
                      <li
                        key={a.id}
                        className="rounded-lg border border-border/60 bg-surface-inner/80 px-3 py-2"
                      >
                        <span className="font-medium text-foreground">
                          {payloadTitle(a.payload)}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {a.entityType} · {new Date(a.updatedAt).toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <AIChatWidget
              departmentId={deptId ?? "unknown"}
              departmentName={departmentName}
              contextEntitiesSummary={contextSummary}
            />
          </div>
        </TabsContent>
        <TabsContent value="metrics">
          <DepartmentOverviewCard
            departmentName={`${departmentName} metrics`}
            kpis={kpis}
            isLoading={snapLoading}
          />
        </TabsContent>
        <TabsContent value="tasks">
          <TaskBoard tasks={tasks} isLoading={snapLoading} />
        </TabsContent>
        <TabsContent value="reports">
          <Card className="border-border/80 bg-card/90">
            <CardHeader>
              <CardTitle>Reports</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Open the{" "}
              <Link className="text-primary underline" to="/reports">
                Reports center
              </Link>{" "}
              to build schedules and exports scoped to this department.
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="docs">
          <Card className="border-border/80 bg-card/90">
            <CardHeader>
              <CardTitle>Documents & resources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {snapLoading ? (
                <p className="text-sm text-muted-foreground">Loading documents…</p>
              ) : docs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No Document entities linked to this department yet.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {docs.map((d) => (
                    <UnifiedEntityCard key={d.id} entity={d} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="ai">
          <AIChatWidget
            departmentId={deptId ?? "unknown"}
            departmentName={departmentName}
            contextEntitiesSummary={contextSummary}
          />
        </TabsContent>
      </Tabs>
    </AnimatedPage>
  );
}
