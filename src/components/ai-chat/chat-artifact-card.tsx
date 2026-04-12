import { useMemo, useState } from "react";
import { FileBarChart2, FileText, LayoutDashboard, LayoutTemplate, Save } from "lucide-react";
import { Link } from "react-router-dom";

import { useAuth } from "@/contexts/auth-context";
import { toChatDashboardRenderModel } from "@/lib/chat-dashboard-artifact";
import { CustomDashboardRuntime } from "@/components/custom-dashboards/custom-dashboard-runtime";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardWidgetBody } from "@/components/dashboard/dashboard-widget-body";
import { DashboardWidgetCard } from "@/components/dashboard/widget-card";
import { hasWidgetAccess } from "@/dashboard/widget-access";
import { definitionByType, useDashboardDefinitions } from "@/hooks/use-dashboard-framework";
import type { AiChatArtifact } from "@/types/ai";
import type { CustomDashboardQueryPlanStep, DashboardWidgetDefinitionRow } from "@/types/dashboard";

function artifactIcon(artifact: AiChatArtifact) {
  if (artifact.type === "dashboard") return LayoutDashboard;
  if (artifact.type === "custom_dashboard") return LayoutTemplate;
  if (artifact.type === "report") return FileBarChart2;
  return FileText;
}

function artifactRoute(artifact: AiChatArtifact): string | null {
  if (typeof artifact.route === "string" && artifact.route.startsWith("/")) {
    return artifact.route;
  }
  if (artifact.type === "report" && artifact.reportId) {
    return `/reports/${artifact.reportId}`;
  }
  if (artifact.type === "dashboard") {
    if (artifact.dashboardKind === "executive") return "/dashboard/executive";
    return "/dashboard/global";
  }
  if (artifact.type === "custom_dashboard") {
    if (artifact.customDashboardId) {
      return `/dashboard/custom-dashboards/${artifact.customDashboardId}`;
    }
    return "/dashboard/custom-dashboards";
  }
  return null;
}

function extractDashboardFocus(payload: Record<string, unknown> | null): string | null {
  return payload && typeof payload.focus === "string" ? payload.focus : null;
}

function extractDashboardWidgetLabels(payload: Record<string, unknown> | null): string[] {
  if (!payload || !Array.isArray(payload.widgetTypes)) return [];
  return payload.widgetTypes
    .map((x) => (typeof x === "string" ? x.replace(/_/g, " ") : null))
    .filter((x): x is string => Boolean(x));
}

function extractCustomDashboardSources(payload: Record<string, unknown> | null): string[] {
  if (!payload) return [];
  const fromSources = Array.isArray(payload.sources)
    ? payload.sources
    : Array.isArray(payload.integrationSources)
      ? payload.integrationSources
      : [];
  return fromSources
    .map((x) => (typeof x === "string" ? x : null))
    .filter((x): x is string => Boolean(x));
}

function extractCustomDashboardCode(payload: Record<string, unknown> | null): string {
  if (!payload) return "";
  return typeof payload.codeTsx === "string" ? payload.codeTsx : "";
}

function extractCustomDashboardQueryPlan(payload: Record<string, unknown> | null): CustomDashboardQueryPlanStep[] {
  const raw = payload && Array.isArray(payload.queryPlan) ? payload.queryPlan : [];
  const out: CustomDashboardQueryPlanStep[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.toolId !== "string" || row.toolId.length === 0) continue;
    const next: CustomDashboardQueryPlanStep = {
      toolId: row.toolId,
      args: row.args && typeof row.args === "object" ? (row.args as Record<string, unknown>) : {},
    };
    if (typeof row.provider === "string" && row.provider.length > 0) {
      next.provider = row.provider;
    }
    if (typeof row.label === "string" && row.label.length > 0) {
      next.label = row.label;
    }
    out.push(next);
  }
  return out;
}

function extractCustomDashboardSnapshot(payload: Record<string, unknown> | null): Record<string, unknown> {
  if (!payload) return {};
  const value = payload.snapshotData;
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function widgetSpanClass(width: number | undefined): string {
  if (typeof width !== "number") return "col-span-1 md:col-span-1";
  if (width >= 10) return "col-span-1 md:col-span-2";
  if (width >= 8) return "col-span-1 md:col-span-2";
  if (width >= 6) return "col-span-1 md:col-span-1";
  return "col-span-1 md:col-span-1";
}

const WIDGET_TITLES: Record<string, string> = {
  global_search_card: "Global search",
  kpi_strip: "KPI overview",
  ai_insight: "AI-assisted insight",
  ai_governance: "AI governance & telemetry",
  throughput_chart: "Cross-system throughput",
  quick_actions: "Quick actions",
  activity_stream: "Recent activity",
  alerts_feed: "Alerts",
  exec_ai_brief: "AI executive brief",
  risk_pie: "Risk scoreboard",
  exec_metrics: "Top-line metrics",
  dept_heatmap: "Cross-department heatmap",
};

function fallbackDefinition(widgetType: string, widgetConfig: Record<string, unknown>): DashboardWidgetDefinitionRow {
  return {
    id: `chat-${widgetType}`,
    company_id: null,
    name: WIDGET_TITLES[widgetType] ?? widgetType.replace(/_/g, " "),
    type: widgetType,
    default_config: widgetConfig,
    visibility_rules: null,
    data_adapter_key: null,
    created_at: "",
    updated_at: "",
  };
}

function DashboardArtifactPreview({ payload }: { payload: Record<string, unknown> | null }) {
  const { tenant, user, profile } = useAuth();
  const defsQ = useDashboardDefinitions();
  const definitions = Array.isArray(defsQ.data) ? defsQ.data : [];
  const roles = Array.isArray(profile?.roles) ? profile.roles : [];
  const [dashSearch, setDashSearch] = useState("");

  const renderModel = useMemo(() => toChatDashboardRenderModel(payload), [payload]);

  const dataContext = useMemo(
    () => ({
      companyId: tenant?.id ?? null,
      userId: user?.id ?? null,
      roles,
      departmentId: null,
      dateRange: null,
    }),
    [tenant?.id, user?.id, roles],
  );

  if (!renderModel) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-background/30 px-3 py-2 text-[11px] text-muted-foreground">
        Layout preview unavailable for this artifact payload. Open the dashboard for full rendering.
      </div>
    );
  }

  const visibleWidgets = renderModel.widgets.filter((widget) => widget.isVisible !== false);

  if (defsQ.isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {Array.from({ length: Math.min(visibleWidgets.length || 2, 4) }).map((_, idx) => (
          <Skeleton key={idx} className="h-40 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground">
        Live layout preview: <span className="text-foreground">{renderModel.layoutName}</span> ({renderModel.dashboardKind})
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {visibleWidgets.map((widget) => {
          const baseDef = definitionByType(definitions, widget.widgetType);
          const mergedConfig = {
            ...(baseDef?.default_config && typeof baseDef.default_config === "object" ? baseDef.default_config : {}),
            ...(widget.config ?? {}),
          };
          const effectiveDef = baseDef
            ? { ...baseDef, default_config: mergedConfig }
            : fallbackDefinition(widget.widgetType, mergedConfig);
          const allowed = baseDef ? hasWidgetAccess(roles, baseDef.visibility_rules) : true;
          const title = effectiveDef.name || WIDGET_TITLES[widget.widgetType] || widget.widgetType.replace(/_/g, " ");

          return (
            <div key={widget.id} className={widgetSpanClass(widget.layout?.w)}>
              <DashboardWidgetCard title={title} className="min-h-[220px] max-h-[360px]">
                {allowed ? (
                  <DashboardWidgetBody
                    widgetType={widget.widgetType}
                    definition={effectiveDef}
                    dataContext={dataContext}
                    dashSearch={dashSearch}
                    onDashSearchChange={setDashSearch}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">This widget is not available for your role.</p>
                )}
              </DashboardWidgetCard>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ChatArtifactCard({
  artifact,
  onRefresh,
  onRegenerate,
  onSave,
  busy = false,
}: {
  artifact: AiChatArtifact;
  onRefresh?: (artifact: AiChatArtifact) => void;
  onRegenerate?: (artifact: AiChatArtifact) => void;
  onSave?: (artifact: AiChatArtifact) => void;
  busy?: boolean;
}) {
  const Icon = artifactIcon(artifact);
  const route = artifactRoute(artifact);
  const payload =
    artifact.payload && typeof artifact.payload === "object"
      ? (artifact.payload as Record<string, unknown>)
      : null;
  const artifactFocus = artifact.type === "dashboard" ? extractDashboardFocus(payload) : null;
  const dashboardWidgets = artifact.type === "dashboard" ? extractDashboardWidgetLabels(payload) : [];
  const isReused =
    artifact.type === "dashboard" && payload && payload.reused === true;
  const customSources = artifact.type === "custom_dashboard" ? extractCustomDashboardSources(payload) : [];
  const customCodeTsx = artifact.type === "custom_dashboard" ? extractCustomDashboardCode(payload) : "";
  const customQueryPlan = artifact.type === "custom_dashboard" ? extractCustomDashboardQueryPlan(payload) : [];
  const customSnapshotData = artifact.type === "custom_dashboard" ? extractCustomDashboardSnapshot(payload) : {};
  const canRenderCustomPreview = artifact.type === "custom_dashboard" && customCodeTsx.trim().length > 0;
  const customCodeLineCount = artifact.type === "custom_dashboard" && typeof payload?.codeTsx === "string"
    ? payload.codeTsx.split("\n").length
    : 0;
  const customDescription = artifact.type === "custom_dashboard"
    ? (typeof artifact.description === "string" && artifact.description.length > 0
      ? artifact.description
      : typeof payload?.description === "string"
        ? payload.description
        : "")
    : "";
  const isUnsavedCustom = artifact.type === "custom_dashboard" &&
    (artifact.unsaved !== false || payload?.unsaved === true);
  const canRefresh = artifact.type === "dashboard" || artifact.type === "report";
  const canRegenerate = artifact.type === "pdf" && Boolean(artifact.reportId);
  const canSaveCustom = artifact.type === "custom_dashboard" && isUnsavedCustom && Boolean(onSave);

  return (
    <Card className="border-border/70 bg-surface-inner/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="h-4 w-4 text-primary" aria-hidden />
          {artifact.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs text-muted-foreground">
        <p className="font-mono uppercase tracking-wider text-foreground/80">{artifact.type}</p>
        {artifact.type === "dashboard" ? (
          <DashboardArtifactPreview payload={payload} />
        ) : null}
        {artifact.type === "dashboard" && artifactFocus ? (
          <p className="rounded-md border border-border/50 bg-background/40 px-2 py-1 text-[11px] leading-relaxed text-foreground/90">
            Focus: {artifactFocus}
          </p>
        ) : null}
        {artifact.type === "dashboard" && dashboardWidgets.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {dashboardWidgets.slice(0, 10).map((label) => (
              <span
                key={label}
                className="rounded-full border border-border/50 bg-background/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-foreground/80"
              >
                {label}
              </span>
            ))}
          </div>
        ) : null}
        {artifact.type === "dashboard" && isReused ? (
          <p className="text-[11px] text-amber-500">Existing layout reused.</p>
        ) : null}
        {artifact.type === "custom_dashboard" ? (
          <div className="space-y-3 rounded-lg border border-border/60 bg-background/40 p-3 text-[11px] text-foreground/85">
            {canRenderCustomPreview ? (
              <CustomDashboardRuntime
                embedded
                codeTsx={customCodeTsx}
                snapshotData={customSnapshotData}
                queryPlan={customQueryPlan}
                sources={customSources}
                titleHint={artifact.title}
                iframeClassName="h-[320px]"
              />
            ) : null}
            {customDescription ? <p>{customDescription}</p> : null}
            <p className="text-muted-foreground">
              Code lines: <span className="text-foreground">{customCodeLineCount || "n/a"}</span>
            </p>
            {customSources.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {customSources.slice(0, 12).map((source) => (
                  <span
                    key={source}
                    className="rounded-full border border-border/50 bg-background/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-foreground/80"
                  >
                    {source}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No source metadata attached yet.</p>
            )}
          </div>
        ) : null}
        {artifact.type === "custom_dashboard" && isUnsavedCustom ? (
          <p className="text-[11px] text-amber-500">Unsaved preview | save explicitly to keep it.</p>
        ) : null}
        {route ? (
          <Button size="sm" variant="outline" asChild>
            <Link to={route}>Open</Link>
          </Button>
        ) : null}
        {canSaveCustom && onSave ? (
          <Button
            size="sm"
            variant="cta"
            onClick={() => onSave(artifact)}
            disabled={busy}
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Save
          </Button>
        ) : null}
        {artifact.type === "pdf" && artifact.downloadUrl ? (
          <Button size="sm" variant="cta" asChild>
            <a href={artifact.downloadUrl} target="_blank" rel="noreferrer">
              Download PDF
            </a>
          </Button>
        ) : null}
        {canRefresh && onRefresh ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onRefresh(artifact)}
            disabled={busy}
          >
            Refresh
          </Button>
        ) : null}
        {canRegenerate && onRegenerate ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRegenerate(artifact)}
            disabled={busy}
          >
            Regenerate
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
