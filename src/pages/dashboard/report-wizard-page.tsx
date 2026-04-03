import { createReportCenterReport } from "@/api/reports-center";
import { AnimatedPage } from "@/components/animated-page";
import { ReportWizard } from "@/components/reports-center/report-wizard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useKpiMetricsQuery,
  useReportsCenterDataSourcesQuery,
  useReportsCenterDepartmentsQuery,
} from "@/hooks/use-reports-center";
import { Link } from "react-router-dom";

export default function ReportWizardPage() {
  const { data: departments = [], isLoading: d1 } =
    useReportsCenterDepartmentsQuery();
  const { data: dataSources = [], isLoading: d2 } =
    useReportsCenterDataSourcesQuery("");
  const { data: kpis = [], isLoading: d3 } = useKpiMetricsQuery();

  const loading = d1 || d2 || d3;

  return (
    <AnimatedPage className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
            <Link to="/reports">← Back to catalog</Link>
          </Button>
          <h1 className="font-display text-2xl font-bold text-[rgb(247,250,255)] md:text-3xl">
            <span className="text-[rgb(154,208,255)]">Create report</span> wizard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Link unified data sources, KPI metrics, visuals, and default export targets.
          </p>
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-[480px] w-full rounded-xl" />
      ) : (
        <ReportWizard
          departments={departments}
          dataSources={dataSources}
          kpis={kpis}
          onSubmit={async (v) => {
            const exportTargets =
              v.scheduleCadence !== "none"
                ? [
                    {
                      format: v.exportDefaultFormat,
                      cadence: v.scheduleCadence,
                    },
                  ]
                : [{ format: v.exportDefaultFormat, onDemand: true }];
            const row = await createReportCenterReport({
              name: v.name,
              description: v.description,
              departmentId: v.departmentId ?? null,
              status: "draft",
              dataSourceRefs: v.dataSourceIds,
              kpiRefs: v.kpiIds,
              visuals: { preset: v.vizPreset, seriesFrom: "kpis" },
              exportTargets,
            });
            return row ? { id: row.id } : null;
          }}
        />
      )}
    </AnimatedPage>
  );
}
