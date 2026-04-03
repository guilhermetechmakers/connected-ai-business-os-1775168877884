import { invokeReportsCenterApi } from "@/lib/reports-center-api";
import type {
  DataSourceEntityRow,
  DepartmentOptionRow,
  KpiMetricRow,
  ReportAiSummaryResult,
  ReportCenterReportRow,
  ReportCenterScheduleRow,
  ReportExportJobRow,
} from "@/types/reports-center";

export async function fetchReportsCenterDepartments(): Promise<DepartmentOptionRow[]> {
  const { data, error } = await invokeReportsCenterApi<DepartmentOptionRow[]>({
    op: "meta.departments",
  });
  if (error) return [];
  return Array.isArray(data) ? data : [];
}

export async function fetchReportsCenterDataSources(params?: {
  search?: string;
  limit?: number;
}): Promise<DataSourceEntityRow[]> {
  const { data, error } = await invokeReportsCenterApi<DataSourceEntityRow[]>({
    op: "dataSources.list",
    search: params?.search,
    limit: params?.limit,
  });
  if (error) return [];
  return Array.isArray(data) ? data : [];
}

export async function fetchKpiMetricsList(): Promise<KpiMetricRow[]> {
  const { data, error } = await invokeReportsCenterApi<KpiMetricRow[]>({
    op: "kpi.list",
  });
  if (error) return [];
  return Array.isArray(data) ? data : [];
}

export async function fetchKpiMetric(id: string): Promise<KpiMetricRow | null> {
  const { data, error } = await invokeReportsCenterApi<KpiMetricRow | null>({
    op: "kpi.get",
    id,
  });
  if (error) return null;
  return data ?? null;
}

export async function createKpiMetric(input: {
  name: string;
  definition?: Record<string, unknown>;
  schedule?: Record<string, unknown>;
}): Promise<KpiMetricRow | null> {
  const { data, error } = await invokeReportsCenterApi<KpiMetricRow>({
    op: "kpi.create",
    name: input.name,
    definition: input.definition ?? {},
    schedule: input.schedule,
  });
  if (error) return null;
  return data ?? null;
}

export async function refreshKpiMetric(id: string): Promise<KpiMetricRow | null> {
  const { data, error } = await invokeReportsCenterApi<KpiMetricRow>({
    op: "kpi.refresh",
    id,
  });
  if (error) return null;
  return data ?? null;
}

export async function fetchReportCenterList(params?: {
  departmentId?: string;
  ownerUserId?: string;
  status?: string;
  tag?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<ReportCenterReportRow[]> {
  const { data, error } = await invokeReportsCenterApi<ReportCenterReportRow[]>({
    op: "reports.list",
    departmentId: params?.departmentId,
    ownerUserId: params?.ownerUserId,
    status: params?.status ?? undefined,
    tag: params?.tag ?? undefined,
    search: params?.search,
    limit: params?.limit,
    offset: params?.offset,
  });
  if (error) return [];
  return Array.isArray(data) ? data : [];
}

export async function fetchReportCenterDetail(
  id: string,
): Promise<ReportCenterReportRow | null> {
  const { data, error } = await invokeReportsCenterApi<ReportCenterReportRow | null>({
    op: "reports.get",
    id,
  });
  if (error) return null;
  return data ?? null;
}

export async function createReportCenterReport(input: {
  name: string;
  description?: string;
  departmentId?: string | null;
  status?: "draft" | "active" | "archived";
  tags?: string[];
  dataSourceRefs?: string[];
  kpiRefs?: string[];
  visuals?: Record<string, unknown>;
  exportTargets?: unknown;
}): Promise<ReportCenterReportRow | null> {
  const { data, error } = await invokeReportsCenterApi<ReportCenterReportRow>({
    op: "reports.create",
    name: input.name,
    description: input.description,
    departmentId: input.departmentId,
    status: input.status,
    tags: input.tags,
    dataSourceRefs: input.dataSourceRefs,
    kpiRefs: input.kpiRefs,
    visuals: input.visuals,
    exportTargets: input.exportTargets,
  });
  if (error) return null;
  return data ?? null;
}

export async function updateReportCenterReport(
  id: string,
  patch: {
    name?: string;
    description?: string;
    departmentId?: string | null;
    status?: "draft" | "active" | "archived";
    tags?: string[];
    dataSourceRefs?: string[];
    kpiRefs?: string[];
    visuals?: Record<string, unknown>;
    scheduleIds?: string[];
    exportTargets?: unknown;
  },
): Promise<ReportCenterReportRow | null> {
  const { data, error } = await invokeReportsCenterApi<ReportCenterReportRow>({
    op: "reports.update",
    id,
    ...patch,
  });
  if (error) return null;
  return data ?? null;
}

export async function deleteReportCenterReport(id: string): Promise<boolean> {
  const { data, error } = await invokeReportsCenterApi<{ ok: boolean }>({
    op: "reports.delete",
    id,
  });
  if (error) return false;
  return Boolean(data && typeof data === "object" && (data as { ok?: boolean }).ok);
}

export async function cloneReportCenterReport(
  id: string,
  name?: string,
): Promise<ReportCenterReportRow | null> {
  const { data, error } = await invokeReportsCenterApi<ReportCenterReportRow>({
    op: "reports.clone",
    id,
    name,
  });
  if (error) return null;
  return data ?? null;
}

export async function fetchReportSchedulesList(
  reportId: string,
): Promise<ReportCenterScheduleRow[]> {
  const { data, error } = await invokeReportsCenterApi<ReportCenterScheduleRow[]>({
    op: "schedules.list",
    reportId,
  });
  if (error) return [];
  return Array.isArray(data) ? data : [];
}

export async function upsertReportSchedule(input: {
  id?: string;
  reportId: string;
  cadence?: "hourly" | "daily" | "weekly";
  cronExpression?: string;
  recipients?: string[];
  deliveryModes?: string[];
  exportFormats?: string[];
  active?: boolean;
}): Promise<ReportCenterScheduleRow | null> {
  const { data, error } = await invokeReportsCenterApi<ReportCenterScheduleRow>({
    op: "schedules.upsert",
    id: input.id,
    reportId: input.reportId,
    cadence: input.cadence,
    cronExpression: input.cronExpression,
    recipients: input.recipients,
    deliveryModes: input.deliveryModes,
    exportFormats: input.exportFormats,
    active: input.active,
  });
  if (error) return null;
  return data ?? null;
}

export async function enqueueReportExport(input: {
  reportId: string;
  format?: "csv" | "pdf" | "json";
  destination?: Record<string, unknown>;
  fileName?: string;
  compress?: boolean;
}): Promise<ReportExportJobRow | null> {
  const { data, error } = await invokeReportsCenterApi<ReportExportJobRow>({
    op: "exports.enqueue",
    reportId: input.reportId,
    format: input.format,
    destination: input.destination,
    fileName: input.fileName,
    compress: input.compress,
  });
  if (error) return null;
  return data ?? null;
}

export async function fetchReportExportJobs(
  reportId: string,
  limit?: number,
): Promise<ReportExportJobRow[]> {
  const { data, error } = await invokeReportsCenterApi<ReportExportJobRow[]>({
    op: "exports.list",
    reportId,
    limit,
  });
  if (error) return [];
  return Array.isArray(data) ? data : [];
}

export async function fetchReportAiSummary(
  reportId: string,
): Promise<ReportAiSummaryResult | null> {
  const { data, error } = await invokeReportsCenterApi<ReportAiSummaryResult>({
    op: "ai.reportSummary",
    reportId,
  });
  if (error) return null;
  return data ?? null;
}

export { invokeReportsAiSummary } from "@/lib/reports-ai-summary";
export type {
  ReportsAiSummaryPayload,
  ReportsAiSummaryResponse,
} from "@/lib/reports-ai-summary";
