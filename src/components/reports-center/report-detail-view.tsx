import { ArrowLeft, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { DataVizPanel } from "@/components/reports-center/data-viz-panel";
import { ExportPanel } from "@/components/reports-center/export-panel";
import {
  profileAllowsReportWrite,
  ReportsAccessControlGuard,
} from "@/components/reports-center/reports-access-control-guard";
import { ScheduleManager } from "@/components/reports-center/schedule-manager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchReportAiSummary,
  invokeReportsAiSummary,
} from "@/api/reports-center";
import { ensureArray, readJsonRecord } from "@/lib/reports-center-safe";
import { cn } from "@/lib/utils";
import type { KpiMetricRow, ReportCenterReportRow } from "@/types/reports-center";

export interface ReportDetailViewProps {
  report: ReportCenterReportRow | null | undefined;
  reportLoading: boolean;
  schedules: unknown;
  schedulesLoading: boolean;
  exports: unknown;
  exportsLoading: boolean;
  kpis: KpiMetricRow[];
  userRoles: string[] | undefined;
  onUpsertSchedule: (payload: {
    cadence: "hourly" | "daily" | "weekly";
    cronExpression?: string;
    recipients: string[];
    deliveryModes: string[];
    exportFormats: string[];
    active: boolean;
  }) => Promise<void>;
  scheduleSaving: boolean;
  onEnqueueExport: (payload: {
    format: "csv" | "pdf" | "json";
    destination: Record<string, unknown>;
    fileName?: string;
    compress?: boolean;
  }) => Promise<void>;
  exportEnqueueing: boolean;
  className?: string;
}

function buildPointsFromKpis(
  report: ReportCenterReportRow,
  kpiRows: KpiMetricRow[],
): { name: string; value: number }[] {
  const ids = new Set(ensureArray<string>(report.kpi_refs));
  const rows = Array.isArray(kpiRows) ? kpiRows : [];
  return rows
    .filter((k) => ids.has(k.id))
    .map((k) => {
      const c = readJsonRecord(k.cached_value);
      const v = c.value;
      const num = typeof v === "number" && Number.isFinite(v) ? v : 0;
      return { name: k.name, value: num };
    });
}

export function ReportDetailView({
  report,
  reportLoading,
  schedules,
  schedulesLoading,
  exports,
  exportsLoading,
  kpis,
  userRoles,
  onUpsertSchedule,
  scheduleSaving,
  onEnqueueExport,
  exportEnqueueing,
  className,
}: ReportDetailViewProps) {
  const canWrite = profileAllowsReportWrite(userRoles);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiSource, setAiSource] = useState<string | null>(null);

  const viz = report ? readJsonRecord(report.visuals) : {};
  const presetRaw = viz.preset;
  const preset =
    presetRaw === "chart_line"
      ? "chart_line"
      : presetRaw === "table"
        ? "table"
        : "chart_bar";

  const points = useMemo(() => {
    if (!report) return [];
    return buildPointsFromKpis(report, kpis);
  }, [report, kpis]);

  const loadAi = async () => {
    if (!report) return;
    setAiLoading(true);
    try {
      const base = await fetchReportAiSummary(report.id);
      const kpiNames = (Array.isArray(kpis) ? kpis : [])
        .filter((k) => ensureArray<string>(report.kpi_refs).includes(k.id))
        .map((k) => k.name);
      const rich = await invokeReportsAiSummary({
        reportName: report.name,
        kpiNames,
        highlights: base?.summary ? [base.summary] : [],
      });
      if (rich.data?.summary) {
        setAiText(rich.data.summary);
        setAiSource(rich.data.source ?? "edge");
        toast.success("Summary updated");
      } else if (base?.summary) {
        setAiText(base.summary);
        setAiSource("reports-center-api");
      } else {
        toast.error(rich.error ?? "Could not load summary");
      }
    } finally {
      setAiLoading(false);
    }
  };

  if (reportLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!report) {
    return (
      <Card className="border-[rgb(21,78,120)]/40 bg-[rgb(15,23,32)]/90">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Report not found or not accessible in this tenant.
        </CardContent>
      </Card>
    );
  }

  const tags = ensureArray<string>(report.tags);
  const dsRefs = ensureArray<string>(report.data_source_refs);

  return (
    <div className={cn("space-y-8", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link to="/reports" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Reports center
            </Link>
          </Button>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[rgb(247,250,255)] md:text-4xl">
            <span className="bg-gradient-to-r from-[rgb(154,208,255)] to-[rgb(247,250,255)] bg-clip-text text-transparent">
              {report.name}
            </span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {report.description || "No description provided."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/[0.08] bg-[rgb(12,17,22)] px-3 py-1 text-xs text-muted-foreground">
              Status:{" "}
              <span className="font-medium text-[rgb(247,250,255)]">
                {report.status}
              </span>
            </span>
            {tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-[rgb(154,208,255)]/10 px-3 py-1 text-xs text-[rgb(154,208,255)]"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
        <ReportsAccessControlGuard
          allow={canWrite}
          fallback={
            <p className="text-xs text-muted-foreground">View-only access</p>
          }
        >
          <Button
            type="button"
            variant="cta"
            size="sm"
            className="transition-transform duration-150 hover:scale-[1.02]"
            disabled={aiLoading}
            onClick={() => void loadAi()}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {aiLoading ? "Generating…" : "Refresh AI narrative"}
          </Button>
        </ReportsAccessControlGuard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <DataVizPanel
            title="Linked KPI snapshot"
            caption="Values from cached KPI metrics in your tenant."
            mode={preset}
            points={points}
          />
          <Card className="border-[rgb(21,78,120)]/40 bg-[rgb(15,23,32)]/90">
            <CardHeader>
              <CardTitle className="text-[rgb(154,208,255)]">AI insights</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-invert max-w-none text-sm prose-p:text-muted-foreground">
              {aiText ? (
                <>
                  <p>{aiText}</p>
                  {aiSource ? (
                    <p className="text-xs text-muted-foreground">Source: {aiSource}</p>
                  ) : null}
                </>
              ) : (
                <p>
                  Run <strong>Refresh AI narrative</strong> to combine the template
                  summary with the optional LLM Edge Function when configured.
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="border-[rgb(21,78,120)]/40 bg-[rgb(15,23,32)]/90">
            <CardHeader>
              <CardTitle className="text-[rgb(154,208,255)]">Context</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Data sources
                </p>
                <ul className="mt-1 list-inside list-disc text-muted-foreground">
                  {dsRefs.length ? (
                    dsRefs.slice(0, 12).map((id) => (
                      <li key={id} className="truncate font-mono text-xs">
                        {id}
                      </li>
                    ))
                  ) : (
                    <li>None linked</li>
                  )}
                </ul>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Export targets (JSON)
                </p>
                <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-[rgb(12,17,22)] p-2 text-xs text-muted-foreground">
                  {JSON.stringify(report.export_targets ?? [], null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Tabs defaultValue="schedule" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-[rgb(12,17,22)]">
              <TabsTrigger
                value="schedule"
                className="data-[state=active]:bg-[rgb(154,208,255)]/15 data-[state=active]:text-[rgb(154,208,255)]"
              >
                Schedule
              </TabsTrigger>
              <TabsTrigger
                value="export"
                className="data-[state=active]:bg-[rgb(154,208,255)]/15 data-[state=active]:text-[rgb(154,208,255)]"
              >
                Export
              </TabsTrigger>
            </TabsList>
            <TabsContent value="schedule" className="mt-4">
              <ScheduleManager
                reportId={report.id}
                schedules={schedules}
                isLoading={schedulesLoading}
                canWrite={canWrite}
                isSaving={scheduleSaving}
                onSave={async (payload) => {
                  await onUpsertSchedule(payload);
                }}
              />
            </TabsContent>
            <TabsContent value="export" className="mt-4">
              <ExportPanel
                reportId={report.id}
                jobs={exports}
                isLoading={exportsLoading}
                canWrite={canWrite}
                isEnqueueing={exportEnqueueing}
                onEnqueue={onEnqueueExport}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
