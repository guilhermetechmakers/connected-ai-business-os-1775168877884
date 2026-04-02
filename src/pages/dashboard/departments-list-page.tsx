import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type DeptRow = { id: string; name: string };

const FALLBACK_DEPARTMENTS: Array<DeptRow & { kpi: string }> = [
  { id: "rev", name: "Revenue", kpi: "$4.2M pipeline" },
  { id: "prod", name: "Product", kpi: "12 active epics" },
  { id: "ops", name: "Operations", kpi: "SLA 99.1%" },
];

export default function DepartmentsListPage() {
  const { data: remote, isLoading } = useQuery({
    queryKey: ["departments", "list"],
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

  const useRemote = Boolean(remote && remote.length > 0);
  const departments = useRemote
    ? (remote ?? []).map((d) => ({ ...d, kpi: "Open workspace for KPIs" }))
    : FALLBACK_DEPARTMENTS;

  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="Department workspaces"
        description="Search, filter, and open scoped workspaces with KPIs and AI context."
        actions={
          <Button variant="cta" type="button">
            New department
          </Button>
        }
      />
      {isLoading && isSupabaseConfigured ? (
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
              className="border-border/80 bg-card/90 shadow-card transition-all duration-150 hover:-translate-y-1 hover:shadow-card-hover"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <CardHeader>
                <CardTitle>{d.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{d.kpi}</p>
                <Button variant="outline" className="w-full" asChild>
                  <Link to={`/department/${d.id}`}>Open workspace</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AnimatedPage>
  );
}
