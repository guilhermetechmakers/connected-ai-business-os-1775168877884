import { invokeActivityLogsApi } from "@/lib/activity-logs-api";
import type {
  ActivityLogEntry,
  ActivityLogsListResult,
  FeatureFlagRow,
  SystemTemplateRow,
} from "@/types/activity-log";

function asActivityEntries(raw: unknown): ActivityLogEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is ActivityLogEntry => !!x && typeof x === "object");
}

type ListEnvelope = {
  data: unknown;
  total?: number;
  canViewFullPayload?: boolean;
};

export async function fetchTenantActivityLogs(params: {
  eventTypes?: string[];
  dateFrom?: string;
  dateTo?: string;
  actorUserId?: string;
  workflowRunId?: string;
  connectorId?: string;
  integrationId?: string;
  aiActionId?: string;
  departmentId?: string;
  search?: string;
  limit?: number;
  offset?: number;
  includeRedactedOnly?: boolean;
}): Promise<ActivityLogsListResult> {
  const { data, error } = await invokeActivityLogsApi<ListEnvelope>({
    op: "activityLog.list",
    eventTypes: params.eventTypes,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    actorUserId: params.actorUserId,
    workflowRunId: params.workflowRunId,
    connectorId: params.connectorId,
    integrationId: params.integrationId,
    aiActionId: params.aiActionId,
    departmentId: params.departmentId,
    search: params.search,
    limit: params.limit,
    offset: params.offset,
    includeRedactedOnly: params.includeRedactedOnly,
  });
  if (error || !data || typeof data !== "object") {
    return { entries: [], total: 0, canViewFullPayload: false };
  }
  const entries = asActivityEntries(data.data);
  const total = typeof data.total === "number" ? data.total : entries.length;
  return {
    entries,
    total,
    canViewFullPayload: Boolean(data.canViewFullPayload),
  };
}

export async function searchTenantActivityLogs(params: {
  query?: string;
  eventTypes?: string[];
  dateFrom?: string;
  dateTo?: string;
  actorUserId?: string;
  workflowRunId?: string;
  connectorId?: string;
  integrationId?: string;
  aiActionId?: string;
  departmentId?: string;
  limit?: number;
  offset?: number;
}): Promise<ActivityLogsListResult> {
  const { data, error } = await invokeActivityLogsApi<ListEnvelope>({
    op: "activityLog.search",
    query: params.query,
    eventTypes: params.eventTypes,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    actorUserId: params.actorUserId,
    workflowRunId: params.workflowRunId,
    connectorId: params.connectorId,
    integrationId: params.integrationId,
    aiActionId: params.aiActionId,
    departmentId: params.departmentId,
    limit: params.limit,
    offset: params.offset,
  });
  if (error || !data || typeof data !== "object") {
    return { entries: [], total: 0, canViewFullPayload: false };
  }
  const entries = asActivityEntries(data.data);
  const total = typeof data.total === "number" ? data.total : entries.length;
  return {
    entries,
    total,
    canViewFullPayload: Boolean(data.canViewFullPayload),
  };
}

type ExportEnvelope = {
  format: string;
  filename: string;
  content: string;
};

export async function exportTenantActivityLogs(params: {
  format: "csv" | "json";
  eventTypes?: string[];
  dateFrom?: string;
  dateTo?: string;
  actorUserId?: string;
  workflowRunId?: string;
  connectorId?: string;
  integrationId?: string;
  aiActionId?: string;
  departmentId?: string;
  search?: string;
  limit?: number;
}): Promise<{ content: string; filename: string; format: string } | null> {
  const { data, error } = await invokeActivityLogsApi<ExportEnvelope>({
    op: "activityLog.export",
    format: params.format,
    eventTypes: params.eventTypes,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    actorUserId: params.actorUserId,
    workflowRunId: params.workflowRunId,
    connectorId: params.connectorId,
    integrationId: params.integrationId,
    aiActionId: params.aiActionId,
    departmentId: params.departmentId,
    search: params.search,
    limit: params.limit,
  });
  if (error || !data || typeof data !== "object") return null;
  const content = typeof data.content === "string" ? data.content : "";
  const filename =
    typeof data.filename === "string"
      ? data.filename
      : `activity-export.${params.format}`;
  const format = typeof data.format === "string" ? data.format : params.format;
  return { content, filename, format };
}

export async function createActivityLogEntry(payload: {
  eventType: string;
  payload?: Record<string, unknown>;
  workflowRunId?: string;
  connectorId?: string;
  integrationId?: string;
  aiActionId?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}): Promise<ActivityLogEntry | null> {
  const { data, error } = await invokeActivityLogsApi<ActivityLogEntry>({
    op: "activityLog.create",
    eventType: payload.eventType,
    payload: payload.payload ?? {},
    workflowRunId: payload.workflowRunId,
    connectorId: payload.connectorId,
    integrationId: payload.integrationId,
    aiActionId: payload.aiActionId,
    metadata: payload.metadata,
    idempotencyKey: payload.idempotencyKey,
  });
  if (error || !data) return null;
  return data;
}

export async function fetchAdminSystemTemplates(): Promise<SystemTemplateRow[]> {
  const { data, error } = await invokeActivityLogsApi<{ data: unknown }>({
    op: "admin.templates.list",
  });
  if (error || !data || typeof data !== "object") return [];
  const o = data as { data?: unknown };
  return Array.isArray(o.data) ? (o.data as SystemTemplateRow[]) : [];
}

export async function upsertAdminSystemTemplate(payload: {
  templateKey: string;
  name: string;
  category?: string;
  definition: Record<string, unknown>;
  version?: string;
}): Promise<SystemTemplateRow | null> {
  const { data, error } = await invokeActivityLogsApi<{ data?: unknown }>({
    op: "admin.templates.upsert",
    templateKey: payload.templateKey,
    name: payload.name,
    category: payload.category,
    definition: payload.definition,
    version: payload.version,
  });
  if (error || !data || typeof data !== "object") return null;
  const o = data as { data?: unknown };
  const row = o.data;
  if (!row || typeof row !== "object") return null;
  return row as SystemTemplateRow;
}

export async function deleteAdminSystemTemplate(id: string): Promise<boolean> {
  const { data, error } = await invokeActivityLogsApi<unknown>({
    op: "admin.templates.delete",
    id,
  });
  return !error && data !== null;
}

export async function fetchAdminFeatureFlags(params?: {
  companyId?: string | null;
}): Promise<FeatureFlagRow[]> {
  const { data, error } = await invokeActivityLogsApi<{ data: unknown }>({
    op: "admin.flags.list",
    companyId:
      params?.companyId === undefined ? undefined : params.companyId,
  });
  if (error || !data || typeof data !== "object") return [];
  const o = data as { data?: unknown };
  return Array.isArray(o.data) ? (o.data as FeatureFlagRow[]) : [];
}

export async function upsertAdminFeatureFlag(payload: {
  flagKey: string;
  companyId?: string | null;
  enabled: boolean;
  rollout?: number;
  payload?: Record<string, unknown>;
}): Promise<FeatureFlagRow | null> {
  const { data, error } = await invokeActivityLogsApi<{ data?: unknown }>({
    op: "admin.flags.upsert",
    flagKey: payload.flagKey,
    companyId: payload.companyId ?? null,
    enabled: payload.enabled,
    rollout: payload.rollout,
    payload: payload.payload,
  });
  if (error || !data || typeof data !== "object") return null;
  const o = data as { data?: unknown };
  const row = o.data;
  if (!row || typeof row !== "object") return null;
  return row as FeatureFlagRow;
}

export async function createAdminTenant(payload: {
  name: string;
  timezone?: string;
  currency?: string;
  domain?: string;
}): Promise<{ id: string; name: string } | null> {
  const { data, error } = await invokeActivityLogsApi<{ data?: unknown }>({
    op: "admin.tenant.create",
    name: payload.name,
    timezone: payload.timezone,
    currency: payload.currency,
    domain: payload.domain,
  });
  if (error || !data || typeof data !== "object") return null;
  const o = data as { data?: unknown };
  const row = o.data;
  if (!row || typeof row !== "object") return null;
  const typed = row as { id: string; name: string };
  return typed.id ? typed : null;
}

export async function fetchAdminActivityTail(
  limit?: number,
): Promise<ActivityLogEntry[]> {
  const { data, error } = await invokeActivityLogsApi<{ data: unknown }>({
    op: "admin.activity.tail",
    limit,
  });
  if (error || !data || typeof data !== "object") return [];
  const o = data as { data?: unknown };
  return asActivityEntries(o.data);
}

export async function runAdminPruneRetention(): Promise<{
  ok: boolean;
  tenantsProcessed: number;
  rowsDeleted: number;
} | null> {
  const { data, error } = await invokeActivityLogsApi<{
    data?: { ok?: boolean; tenantsProcessed?: number; rowsDeleted?: number };
  }>({
    op: "admin.pruneRetention",
  });
  if (error || !data || typeof data !== "object") return null;
  const o = data as { data?: unknown };
  const inner = o.data;
  if (!inner || typeof inner !== "object") return null;
  const d = inner as {
    ok?: boolean;
    tenantsProcessed?: number;
    rowsDeleted?: number;
  };
  return {
    ok: Boolean(d.ok),
    tenantsProcessed:
      typeof d.tenantsProcessed === "number" ? d.tenantsProcessed : 0,
    rowsDeleted: typeof d.rowsDeleted === "number" ? d.rowsDeleted : 0,
  };
}

export type AdminPruneRetentionResult = Awaited<
  ReturnType<typeof runAdminPruneRetention>
>;
