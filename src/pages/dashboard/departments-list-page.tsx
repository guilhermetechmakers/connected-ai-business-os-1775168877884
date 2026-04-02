import { Link } from "react-router-dom";

import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const departments = [
  { id: "rev", name: "Revenue", kpi: "$4.2M pipeline" },
  { id: "prod", name: "Product", kpi: "12 active epics" },
  { id: "ops", name: "Operations", kpi: "SLA 99.1%" },
];

export default function DepartmentsListPage() {
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
      <div className="grid gap-4 md:grid-cols-3">
        {departments.map((d, i) => (
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
                <Link to={`/dashboard/departments/${d.id}`}>Open workspace</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </AnimatedPage>
  );
}
