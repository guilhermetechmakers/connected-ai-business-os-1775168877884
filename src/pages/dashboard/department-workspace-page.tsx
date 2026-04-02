import { useParams } from "react-router-dom";

import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function DepartmentWorkspacePage() {
  const { deptId } = useParams();

  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title={`Department · ${deptId}`}
        description="Lead, KPIs, tasks, reports, documents, and scoped AI assistant."
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
        <TabsContent value="overview">
          <Card className="border-border/80 bg-card/90">
            <CardHeader>
              <CardTitle>Priorities</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Department lead, staffing snapshot, and cross-tool blockers surface here
              with links into unified entities.
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="metrics">
          <Card className="border-border/80 bg-card/90">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              KPI widgets bind to <code className="text-primary">kpis</code> table with
              cached rollups.
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="tasks">
          <Card className="border-border/80 bg-card/90">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Task list with TanStack Table + skeleton loaders in production.
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="reports">
          <Card className="border-border/80 bg-card/90">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Scheduled exports and AI summaries route through Reports center.
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="docs">
          <Card className="border-border/80 bg-card/90">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Documents reference <code className="text-primary">documents</code> with
              provider metadata.
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="ai">
          <Card className="border-border/80 bg-card/90">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Scoped assistant reuses AI workspace with department filters enforced
              server-side.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AnimatedPage>
  );
}
