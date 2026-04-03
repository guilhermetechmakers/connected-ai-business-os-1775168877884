import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Calendar,
  Copy,
  FileBarChart,
  MoreHorizontal,
  Trash2,
  TrendingUp,
} from "lucide-react";

import { upsertReportSchedule as upsertLegacyTemplateSchedule } from "@/api/unified-data";
import { ExportButton } from "@/components/unified-data/export-button";
import { ReportCard } from "@/components/unified-data/report-card";
import { SchedulePane } from "@/components/unified-data/schedule-pane";
import { KpiListView } from "@/components/reports-center/kpi-list-view";
import {
  profileAllowsKpiWrite,
  profileAllowsReportWrite,
  ReportsAccessControlGuard,
} from "@/components/reports-center/reports-access-control-guard";
import { UnifiedDataFilterBar } from "@/components/reports-center/unified-data-filter-bar";
import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import {
  unifiedQueryKeys,
  useReportSchedulesQuery,
  useReportTemplatesQuery,
} from "@/hooks/use-unified-data";
import {
  useCloneReportMutation,
  useCreateKpiMutation,
  useDeleteReportMutation,
  useKpiMetricsQuery,
  useRefreshKpiMutation,
  useReportCenterListQuery,
  useReportsCenterDepartmentsQuery,
} from "@/hooks/use-reports-center";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ensureArray } from "@/lib/reports-center-safe";
import { cn } from "@/lib/utils";
import type { ReportsCenterFilters } from "@/types/reports-center";
import type { ReportCenterReportRow } from "@/types/reports-center";

const defaultFilters: ReportsCenterFilters = {
  departmentId: null,
  status: null,
  tag: null,
  search: "",
  ownerOnly: false,
};

const throughputFallback = [
  { name: "W1", delivered: 24 },
  { name: "W2", delivered: 31 },
  { name: "W3", delivered: 28 },
  { name: "W4", delivered: 36 },
];

export interface ReportsCenterDashboardProps {
  className?: string;
}

export function ReportsCenterDashboard({ className }: ReportsCenterDashboardProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  const userId = user?.id ?? profile?.id ?? null;
  const roles = profile?.roles;

  const [filters, setFilters] = useState<ReportsCenterFilters>(defaultFilters);
  const filtersStable = useMemo(
    () => filters,
    [
      filters.departmentId,
      filters.status,
      filters.tag,
      filters.search,
      filters.ownerOnly,
    ],
  );

  const { data: departments = [], isLoading: deptLoading } =
    useReportsCenterDepartmentsQuery();
  const { data: reports = [], isLoading: reportsLoading } =
    useReportCenterListQuery(filtersStable, { currentUserId: userId });
  const { data: kpis = [], isLoading: kpisLoading } = useKpiMetricsQuery();

  const { data: legacyTemplates = [], isLoading: tplLoading } =
    useReportTemplatesQuery();
  const { data: legacySchedules = [], isLoading: schLoading } =
    useReportSchedulesQuery();

  const safeReports = Array.isArray(reports) ? reports : [];
  const safeLegacyTpl = Array.isArray(legacyTemplates) ? legacyTemplates : [];
  const safeLegacySch = Array.isArray(legacySchedules) ? legacySchedules : [];

  const [deleteTarget, setDeleteTarget] = useState<ReportCenterReportRow | null>(
    null,
  );
  const [kpiNameDraft, setKpiNameDraft] = useState("");
  const [refreshingKpiId, setRefreshingKpiId] = useState<string | null>(null);

  const deleteMutation = useDeleteReportMutation();
  const cloneMutation = useCloneReportMutation();
  const createKpiMutation = useCreateKpiMutation();
  const refreshKpiMutation = useRefreshKpiMutation();

  const legacyScheduleMutation = useMutation({
    mutationFn: upsertLegacyTemplateSchedule,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: unifiedQueryKeys.reportSchedules() });
      toast.success("Legacy schedule saved");
    },
    onError: () => toast.error("Could not save legacy schedule"),
  });

  const canWrite = profileAllowsReportWrite(roles);
  const canKpi = profileAllowsKpiWrite(roles);

  const chartData =
    safeReports.length > 0
      ? safeReports.slice(0, 6).map((r, i) => ({
          name: r.name.slice(0, 12) || `R${i + 1}`,
          delivered: ensureArray(r.kpi_refs).length || 1,
        }))
      : throughputFallback;

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const activeTemplateId = selectedTemplateId ?? safeLegacyTpl[0]?.id ?? null;

  return (
    <AnimatedPage className={cn("space-y-10", className)}>
      <PageHeader
        title="Reports center"
        description="Author tenant-scoped reports, link unified data sources and KPIs, schedule delivery, and export to CSV, PDF, or JSON — with AI-assisted summaries."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/dashboard/executive">Executive view</Link>
            </Button>
            <ReportsAccessControlGuard
              allow={canWrite}
              fallback={
                <span className="text-xs text-muted-foreground">
                  Read-only — create disabled
                </span>
              }
            >
              <Button variant="cta" size="sm" asChild>
                <Link to="/reports/new">Create report</Link>
              </Button>
            </ReportsAccessControlGuard>
          </div>
        }
      />

      <UnifiedDataFilterBar
        departments={deptLoading ? [] : departments}
        value={filters}
        onChange={setFilters}
      />

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="border-[rgb(21,78,120)]/40 bg-[rgb(15,23,32)]/95 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 font-display text-lg text-[rgb(154,208,255)]">
              <TrendingUp className="h-5 w-5" aria-hidden />
              Report activity
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              {safeReports.length} authored
            </span>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" stroke="rgb(143,160,176)" tick={{ fontSize: 11 }} />
                <YAxis stroke="rgb(143,160,176)" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "rgb(15,23,32)",
                    border: "1px solid rgb(21,78,120)",
                  }}
                />
                <Bar dataKey="delivered" fill="rgb(154,208,255)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <SchedulePane schedules={safeLegacySch} isLoading={schLoading} />
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-[rgb(247,250,255)]">
              KPI repository
            </h2>
            <p className="text-sm text-muted-foreground">
              Definitions with cached values and refresh hooks for report visuals.
            </p>
          </div>
          <ReportsAccessControlGuard allow={canKpi}>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <Label htmlFor="new-kpi-name" className="text-xs">
                  New KPI name
                </Label>
                <Input
                  id="new-kpi-name"
                  value={kpiNameDraft}
                  onChange={(e) => setKpiNameDraft(e.target.value)}
                  placeholder="Pipeline velocity"
                  className="mt-1 w-48 bg-[rgb(12,17,22)]"
                />
              </div>
              <Button
                type="button"
                variant="cta"
                size="sm"
                disabled={kpiNameDraft.trim().length < 2 || createKpiMutation.isPending}
                className="transition-transform duration-150 hover:scale-[1.02]"
                onClick={() => {
                  void (async () => {
                    const row = await createKpiMutation.mutateAsync({
                      name: kpiNameDraft.trim(),
                      definition: {
                        aggregation: "sum",
                        timeframe: "30d",
                        query: "unified.layer.placeholder",
                      },
                    });
                    if (row) {
                      setKpiNameDraft("");
                      toast.success("KPI created");
                    } else toast.error("Could not create KPI");
                  })();
                }}
              >
                Add KPI
              </Button>
            </div>
          </ReportsAccessControlGuard>
        </div>
        <KpiListView
          kpis={kpis}
          isLoading={kpisLoading}
          canWrite={canKpi}
          refreshingId={refreshingKpiId}
          onRefresh={(id) => {
            void (async () => {
              setRefreshingKpiId(id);
              try {
                const row = await refreshKpiMutation.mutateAsync(id);
                if (row) toast.success("KPI refreshed");
                else toast.error("Refresh failed");
              } finally {
                setRefreshingKpiId(null);
              }
            })();
          }}
        />
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-[rgb(247,250,255)]">
            Report catalog
          </h2>
          <div className="flex flex-wrap gap-2">
            <ExportButton
              label="Export list (JSON)"
              format="json"
              filenameBase="report-center-reports"
              getPayload={() => safeReports}
            />
          </div>
        </div>
        {reportsLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : safeReports.length === 0 ? (
          <Card className="border-[rgb(21,78,120)]/40 bg-[rgb(15,23,32)]/90">
            <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
              <FileBarChart className="h-10 w-10 text-[rgb(154,208,255)]" />
              <p className="max-w-md text-sm text-muted-foreground">
                No authored reports match your filters. Create a report to link data
                sources, KPIs, visuals, and export targets.
              </p>
              {canWrite ? (
                <Button variant="cta" asChild>
                  <Link to="/reports/new">Start wizard</Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {safeReports.map((r) => (
              <Card
                key={r.id}
                className="group relative overflow-hidden border-[rgb(21,78,120)]/40 bg-[rgb(15,23,32)]/95 transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgb(154,208,255)]/35 hover:shadow-lg"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="line-clamp-2 text-base text-[rgb(247,250,255)]">
                      {r.name}
                    </CardTitle>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          aria-label={`Actions for ${r.name}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem asChild>
                          <Link to={`/reports/${r.id}`}>Open</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!canWrite}
                          onClick={() => navigate(`/reports/${r.id}`)}
                        >
                          Schedule / export
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={!canWrite || cloneMutation.isPending}
                          onClick={() => {
                            void (async () => {
                              const row = await cloneMutation.mutateAsync({
                                id: r.id,
                              });
                              if (row?.id) {
                                toast.success("Cloned");
                                navigate(`/reports/${row.id}`);
                              } else toast.error("Clone failed");
                            })();
                          }}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Clone
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!canWrite}
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteTarget(r)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {r.description || "—"}
                  </p>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5">
                    {r.status}
                  </span>
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5">
                    KPIs: {ensureArray(r.kpi_refs).length}
                  </span>
                  <Button variant="outline" size="sm" className="ml-auto" asChild>
                    <Link to={`/reports/${r.id}`}>View</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4 border-t border-white/[0.06] pt-10">
        <h2 className="font-display text-lg font-semibold text-[rgb(247,250,255)]">
          Legacy unified templates
        </h2>
        <p className="text-sm text-muted-foreground">
          Templates from the unified data layer — use for quick schedules alongside
          authored reports.
        </p>
        <div className="flex flex-wrap gap-2">
          <ExportButton
            label="Templates JSON"
            format="json"
            filenameBase="report-templates"
            getPayload={() => safeLegacyTpl}
          />
          <ExportButton
            label="Schedules CSV"
            format="csv"
            filenameBase="report-schedules"
            getPayload={() => safeLegacySch}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!activeTemplateId || legacyScheduleMutation.isPending}
            onClick={() => {
              if (!activeTemplateId) return;
              legacyScheduleMutation.mutate({
                reportTemplateId: activeTemplateId,
                cronExpression: "0 9 * * 1",
                exportFormat: "pdf",
              });
            }}
          >
            <Calendar className="mr-2 h-4 w-4" />
            Weekly PDF (legacy)
          </Button>
        </div>
        {tplLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        ) : safeLegacyTpl.length === 0 ? (
          <Card className="border-[rgb(21,78,120)]/40 bg-[rgb(15,23,32)]/90">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No legacy templates.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {safeLegacyTpl.map((t) => (
              <ReportCard
                key={t.id}
                template={t}
                onOpen={() => setSelectedTemplateId(t.id)}
              />
            ))}
          </div>
        )}
      </section>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="border-[rgb(21,78,120)]/50 bg-[rgb(15,23,32)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete report?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes “{deleteTarget?.name ?? ""}” from your tenant catalog.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const id = deleteTarget?.id;
                if (!id) return;
                void (async () => {
                  const ok = await deleteMutation.mutateAsync(id);
                  setDeleteTarget(null);
                  if (ok) toast.success("Report deleted");
                  else toast.error("Delete failed");
                })();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AnimatedPage>
  );
}
