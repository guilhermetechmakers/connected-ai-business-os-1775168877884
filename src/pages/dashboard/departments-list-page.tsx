import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { normalizeDepartmentDirectory } from "@/components/department-workspace";
import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchTenantDepartmentsDirectory } from "@/lib/department-workspace-api";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type DeptRow = { id: string; name: string };

const FALLBACK_DEPARTMENTS: Array<DeptRow & { kpi: string }> = [
  { id: "rev", name: "Revenue", kpi: "$4.2M pipeline" },
  { id: "prod", name: "Product", kpi: "12 active epics" },
  { id: "ops", name: "Operations", kpi: "SLA 99.1%" },
];

export default function DepartmentsListPage() {
  const { data: directory, isLoading: dirLoading } = useQuery({
    queryKey: ["departments", "directory"],
    queryFn: fetchTenantDepartmentsDirectory,
    enabled: isSupabaseConfigured,
  });

  const { data: remote, isLoading: supaLoading } = useQuery({
    queryKey: ["departments", "list-fallback"],
    queryFn: async (): Promise<DeptRow[]> => {
      const { data, error } = await supabase
        .from("departments")
        .select("id,name")
        .order("name", { ascending: true });
      if (error) return [];
      const rows = Array.isArray(data) ? data : [];
      const out: DeptRow[] = [];
      for (const r of rows) {
        const row = r as { id?: unknown; name?: unknown };
        if (typeof row.id === "string" && typeof row.name === "string") {
          out.push({ id: row.id, name: row.name });
        }
      }
      return out;
    },
    enabled: isSupabaseConfigured,
  });

  const normalizedDir = normalizeDepartmentDirectory(directory ?? []);

  const useDirectory = normalizedDir.length > 0;
  const useRemote = Boolean(remote && remote.length > 0);

  const departments = useDirectory
    ? normalizedDir.map((d) => ({
        id: d.id,
        name: d.name,
        kpi: `${d.metrics.openTasks} tasks · ${d.metrics.kpis} KPIs · ${d.metrics.documents} docs`,
        href: `/departments/${d.id}` as const,
      }))
    : useRemote
      ? (remote ?? []).map((d) => ({
          id: d.id,
          name: d.name,
          kpi: "Open workspace for live metrics",
          href: `/departments/${d.id}` as const,
        }))
      : FALLBACK_DEPARTMENTS.map((d) => ({
          ...d,
          href: `/departments/${d.id}` as const,
        }));

  const loading =
    isSupabaseConfigured && (dirLoading || (!useDirectory && supaLoading));

  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="Department workspaces"
        description="Search, filter, and open scoped workspaces with KPIs, workflows, and AI context."
        actions={
          <Button variant="cta" type="button" disabled>
            New department
          </Button>
        }
      />
      {loading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {(departments ?? []).map((d, i) => (
            <Card
              key={d.id}
              className="border-border/80 bg-card/90 shadow-card transition-all duration-150 hover:-translate-y-1 hover:shadow-card-hover motion-reduce:transform-none"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <CardHeader>
                <CardTitle>{d.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{d.kpi}</p>
                <div className="flex flex-col gap-2">
                  <Button variant="outline" className="w-full" asChild>
                    <Link to={d.href} aria-label={`Open workspace for ${d.name}`}>
                      Open workspace
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full text-muted-foreground" asChild>
                    <Link to={`/dashboard/departments/${d.id}`}>Via dashboard route</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AnimatedPage>
  );
}
