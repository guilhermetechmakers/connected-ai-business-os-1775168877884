import { invokeUnifiedDataApi } from "@/lib/unified-data-api";
import type {
  ActivityLogRow,
  AiSummaryResult,
  DashboardEntityRollup,
  DashboardKpiSnapshot,
  DepartmentWorkspaceSnapshot,
  ReportScheduleRow,
  ReportTemplateRow,
  UnifiedEntityRow,
} from "@/types/unified";

export type { UnifiedEntityRow } from "@/types/unified";

export async function fetchUnifiedEntities(params?: {
  entityType?: string;
  departmentId?: string;
  search?: string;
  limit?: number;
  offset?: number;
  includeDeleted?: boolean;
}): Promise<UnifiedEntityRow[]> {
  const { data, error } = await invokeUnifiedDataApi<UnifiedEntityRow[]>({
    op: "entities.list",
    entityType: params?.entityType,
    departmentId: params?.departmentId,
    search: params?.search,
    limit: params?.limit,
    offset: params?.offset,
    includeDeleted: params?.includeDeleted,
  });
  if (error) return [];
  return Array.isArray(data) ? data : [];
}

export async function fetchDashboardRollups(
  viewName: "rollups" | "kpis" = "rollups",
): Promise<DashboardEntityRollup[] | DashboardKpiSnapshot[]> {
  const { data, error } = await invokeUnifiedDataApi<
    DashboardEntityRollup[] | DashboardKpiSnapshot[]
  >({
    op: "entities.materializedView",
    viewName,
  });
  if (error) return [];
  return Array.isArray(data) ? data : [];
}

export async function fetchRecentActivity(
  limit = 30,
): Promise<ActivityLogRow[]> {
  const { data, error } = await invokeUnifiedDataApi<ActivityLogRow[]>({
    op: "activity.recent",
    limit,
  });
  if (error) return [];
  return Array.isArray(data) ? data : [];
}

export async function fetchDepartmentSnapshot(
  departmentId: string,
): Promise<DepartmentWorkspaceSnapshot | null> {
  const { data, error } = await invokeUnifiedDataApi<DepartmentWorkspaceSnapshot>({
    op: "department.snapshot",
    departmentId,
  });
  if (error || !data) return null;
  const snap = data as DepartmentWorkspaceSnapshot;
  return {
    department: snap.department ?? null,
    entities: Array.isArray(snap.entities) ? snap.entities : [],
    tasks: Array.isArray(snap.tasks) ? snap.tasks : [],
    documents: Array.isArray(snap.documents) ? snap.documents : [],
    kpis: Array.isArray(snap.kpis) ? snap.kpis : [],
    workflows: Array.isArray(snap.workflows) ? snap.workflows : [],
  };
}

export async function fetchSearchResults(params: {
  q: string;
  entityType?: string;
  departmentId?: string;
  limit?: number;
}): Promise<UnifiedEntityRow[]> {
  const { data, error } = await invokeUnifiedDataApi<UnifiedEntityRow[]>({
    op: "search.query",
    q: params.q,
    entityType: params.entityType,
    departmentId: params.departmentId,
    limit: params.limit,
  });
  if (error) return [];
  return Array.isArray(data) ? data : [];
}

export async function fetchReportTemplates(): Promise<ReportTemplateRow[]> {
  const { data, error } = await invokeUnifiedDataApi<ReportTemplateRow[]>({
    op: "reports.templates.list",
  });
  if (error) return [];
  return Array.isArray(data) ? data : [];
}

export async function fetchReportSchedules(): Promise<ReportScheduleRow[]> {
  const { data, error } = await invokeUnifiedDataApi<ReportScheduleRow[]>({
    op: "reports.schedules.list",
  });
  if (error) return [];
  return Array.isArray(data) ? data : [];
}

export async function upsertReportTemplate(input: {
  id?: string;
  name: string;
  definition?: Record<string, unknown>;
  departmentId?: string | null;
}): Promise<ReportTemplateRow | null> {
  const { data, error } = await invokeUnifiedDataApi<ReportTemplateRow>({
    op: "reports.template.upsert",
    id: input.id,
    name: input.name,
    definition: input.definition ?? {},
    departmentId: input.departmentId,
  });
  if (error) return null;
  return data;
}

export async function upsertReportSchedule(input: {
  id?: string;
  reportTemplateId: string;
  cronExpression?: string;
  exportFormat?: "pdf" | "csv" | "json";
  nextRunAt?: string | null;
}): Promise<ReportScheduleRow | null> {
  const { data, error } = await invokeUnifiedDataApi<ReportScheduleRow>({
    op: "reports.schedule.upsert",
    id: input.id,
    reportTemplateId: input.reportTemplateId,
    cronExpression: input.cronExpression,
    exportFormat: input.exportFormat,
    nextRunAt: input.nextRunAt,
  });
  if (error) return null;
  return data;
}

export async function summarizeEntityForSearch(
  entityId: string,
  mode: "brief" | "detailed" = "brief",
): Promise<AiSummaryResult | null> {
  const { data, error } = await invokeUnifiedDataApi<AiSummaryResult>({
    op: "ai.summarizeResult",
    entityId,
    mode,
  });
  if (error || !data) return null;
  return data;
}
