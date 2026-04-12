/**
 * Dashboard framework — Edge Function `dashboard-api`.
 */
import { invokeDashboardApi } from "@/lib/dashboard-api";
import type {
  CustomDashboardQueryPlanStep,
  CustomDashboardRow,
  CustomDashboardRunRow,
  CustomDashboardVisibilityMode,
  DashboardExportScheduleRow,
  DashboardKind,
  DashboardLayoutJson,
  DashboardLayoutRow,
  DashboardWidgetDefinitionRow,
  DashboardWidgetInstanceRow,
} from "@/types/dashboard";

export async function fetchDashboardDefinitions(): Promise<DashboardWidgetDefinitionRow[]> {
  const { data, error } = await invokeDashboardApi<{ definitions: DashboardWidgetDefinitionRow[] }>({
    op: "definitions.list",
  });
  if (error || !data) return [];
  const list = data?.definitions;
  return Array.isArray(list) ? list : [];
}

export async function fetchAvailableDashboardWidgets(): Promise<DashboardWidgetDefinitionRow[]> {
  const { data, error } = await invokeDashboardApi<{ definitions: DashboardWidgetDefinitionRow[] }>({
    op: "widgets.available",
  });
  if (error || !data) return [];
  const list = data?.definitions;
  return Array.isArray(list) ? list : [];
}

export async function registerDashboardWidgetDefinition(params: {
  name: string;
  type: string;
  defaultConfig?: Record<string, unknown>;
  visibilityRules?: { roles?: string[] };
  dataAdapterKey?: string;
}): Promise<DashboardWidgetDefinitionRow | null> {
  const { data, error } = await invokeDashboardApi<{ definition: DashboardWidgetDefinitionRow }>({
    op: "definitions.register",
    name: params.name,
    type: params.type,
    defaultConfig: params.defaultConfig,
    visibilityRules: params.visibilityRules,
    dataAdapterKey: params.dataAdapterKey,
  });
  if (error || !data?.definition) return null;
  return data.definition;
}

export async function ensureDashboardLayout(
  dashboardKind: DashboardKind,
  name = "Default",
): Promise<{
  layout: DashboardLayoutRow | null;
  instances: DashboardWidgetInstanceRow[];
}> {
  const { data, error } = await invokeDashboardApi<{
    layout: DashboardLayoutRow | null;
    instances: DashboardWidgetInstanceRow[];
  }>({
    op: "layout.ensure",
    dashboardKind,
    name,
  });
  if (error || !data) {
    return { layout: null, instances: [] };
  }
  const instances = Array.isArray(data.instances) ? data.instances : [];
  return { layout: data.layout ?? null, instances };
}

export async function getDashboardLayout(
  dashboardKind: DashboardKind,
  name = "Default",
): Promise<{
  layout: DashboardLayoutRow | null;
  instances: DashboardWidgetInstanceRow[];
}> {
  const { data, error } = await invokeDashboardApi<{
    layout: DashboardLayoutRow | null;
    instances: DashboardWidgetInstanceRow[];
  }>({
    op: "layout.get",
    dashboardKind,
    name,
  });
  if (error || !data) {
    return { layout: null, instances: [] };
  }
  const instances = Array.isArray(data.instances) ? data.instances : [];
  return { layout: data.layout ?? null, instances };
}

export async function saveDashboardLayout(params: {
  dashboardKind: DashboardKind;
  name?: string;
  layoutJson: DashboardLayoutJson;
  instances: {
    id: string;
    widgetDefinitionId?: string | null;
    widgetType: string;
    config?: Record<string, unknown>;
    isVisible?: boolean;
  }[];
}): Promise<{
  layout: DashboardLayoutRow | null;
  instances: DashboardWidgetInstanceRow[];
}> {
  const { data, error } = await invokeDashboardApi<{
    layout: DashboardLayoutRow | null;
    instances: DashboardWidgetInstanceRow[];
  }>({
    op: "layout.save",
    dashboardKind: params.dashboardKind,
    name: params.name ?? "Default",
    layoutJson: params.layoutJson as Record<string, unknown>,
    instances: params.instances,
  });
  if (error || !data) {
    return { layout: null, instances: [] };
  }
  const instances = Array.isArray(data.instances) ? data.instances : [];
  return { layout: data.layout ?? null, instances };
}

export async function createDashboardExportSchedule(params: {
  targetType: "email" | "webhook";
  targetValue: string;
  cronExpression?: string;
  layoutId?: string;
}): Promise<DashboardExportScheduleRow | null> {
  const { data, error } = await invokeDashboardApi<{ schedule: DashboardExportScheduleRow }>({
    op: "export.schedules.create",
    targetType: params.targetType,
    targetValue: params.targetValue,
    cronExpression: params.cronExpression,
    layoutId: params.layoutId,
  });
  if (error || !data?.schedule) return null;
  return data.schedule;
}

export async function listDashboardExportSchedules(): Promise<DashboardExportScheduleRow[]> {
  const { data, error } = await invokeDashboardApi<{ schedules: DashboardExportScheduleRow[] }>({
    op: "export.schedules.list",
  });
  if (error || !data) return [];
  const list = data.schedules;
  return Array.isArray(list) ? list : [];
}

export async function getDashboardExportSchedule(
  scheduleId: string,
): Promise<DashboardExportScheduleRow | null> {
  const { data, error } = await invokeDashboardApi<{ schedule: DashboardExportScheduleRow }>({
    op: "export.schedule.get",
    scheduleId,
  });
  if (error || !data?.schedule) return null;
  return data.schedule;
}

export async function triggerDashboardExportSchedule(
  scheduleId: string,
): Promise<{ ok: boolean; exportPayload?: unknown } | null> {
  const { data, error } = await invokeDashboardApi<{
    ok: boolean;
    exportPayload?: unknown;
  }>({
    op: "export.schedule.trigger",
    scheduleId,
  });
  if (error || !data) return null;
  return data;
}

export async function patchDashboardWidgetInstance(
  instanceId: string,
  patch: { config?: Record<string, unknown>; isVisible?: boolean },
): Promise<DashboardWidgetInstanceRow | null> {
  const { data, error } = await invokeDashboardApi<{ instance: DashboardWidgetInstanceRow }>({
    op: "widget.instance.patch",
    instanceId,
    ...patch,
  });
  if (error || !data?.instance) return null;
  return data.instance;
}

export async function listCustomDashboards(limit?: number): Promise<CustomDashboardRow[]> {
  const { data, error } = await invokeDashboardApi<{ dashboards: CustomDashboardRow[] }>({
    op: "customDashboards.list",
    limit,
  });
  if (error || !data) return [];
  const list = data.dashboards;
  return Array.isArray(list) ? list : [];
}

export async function getCustomDashboard(dashboardId: string): Promise<{
  dashboard: CustomDashboardRow | null;
  runs: CustomDashboardRunRow[];
}> {
  const { data, error } = await invokeDashboardApi<{
    dashboard: CustomDashboardRow | null;
    runs: CustomDashboardRunRow[];
  }>({
    op: "customDashboards.get",
    dashboardId,
  });
  if (error || !data) return { dashboard: null, runs: [] };
  return {
    dashboard: data.dashboard ?? null,
    runs: Array.isArray(data.runs) ? data.runs : [],
  };
}

export async function saveCustomDashboard(params: {
  dashboardId?: string;
  title: string;
  description?: string | null;
  codeTsx: string;
  queryPlan?: CustomDashboardQueryPlanStep[];
  snapshotData?: Record<string, unknown>;
  sources?: string[];
  visibilityMode?: CustomDashboardVisibilityMode;
  sharedRoles?: string[];
}): Promise<CustomDashboardRow | null> {
  const { data, error } = await invokeDashboardApi<{ dashboard: CustomDashboardRow }>({
    op: "customDashboards.save",
    dashboardId: params.dashboardId,
    title: params.title,
    description: params.description ?? null,
    codeTsx: params.codeTsx,
    queryPlan: params.queryPlan ?? [],
    snapshotData: params.snapshotData ?? {},
    sources: params.sources ?? [],
    visibilityMode: params.visibilityMode,
    sharedRoles: params.sharedRoles ?? [],
  });
  if (error || !data?.dashboard) return null;
  return data.dashboard;
}

export async function updateCustomDashboardMeta(params: {
  dashboardId: string;
  title?: string;
  description?: string | null;
  visibilityMode?: CustomDashboardVisibilityMode;
  sharedRoles?: string[];
}): Promise<CustomDashboardRow | null> {
  const { data, error } = await invokeDashboardApi<{ dashboard: CustomDashboardRow }>({
    op: "customDashboards.updateMeta",
    dashboardId: params.dashboardId,
    title: params.title,
    description: params.description,
    visibilityMode: params.visibilityMode,
    sharedRoles: params.sharedRoles,
  });
  if (error || !data?.dashboard) return null;
  return data.dashboard;
}

export async function refreshCustomDashboardData(
  dashboardId: string,
): Promise<{
  dashboard: CustomDashboardRow | null;
  run: CustomDashboardRunRow | null;
  status: "succeeded" | "failed";
  errors: string[];
} | null> {
  const { data, error } = await invokeDashboardApi<{
    dashboard: CustomDashboardRow | null;
    run: CustomDashboardRunRow | null;
    status: "succeeded" | "failed";
    errors: string[];
  }>({
    op: "customDashboards.refreshData",
    dashboardId,
  });
  if (error || !data) return null;
  return {
    dashboard: data.dashboard ?? null,
    run: data.run ?? null,
    status: data.status === "failed" ? "failed" : "succeeded",
    errors: Array.isArray(data.errors) ? data.errors : [],
  };
}

export async function deleteCustomDashboard(dashboardId: string): Promise<boolean> {
  const { data, error } = await invokeDashboardApi<{ ok: boolean }>({
    op: "customDashboards.delete",
    dashboardId,
  });
  if (error || !data) return false;
  return data.ok === true;
}
