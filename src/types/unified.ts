import type { Json } from "@/types/database";

export type SourceReference = {
  provider: string;
  externalId: string;
  lastSeenAt?: string;
};

export type UnifiedEntityRow = {
  id: string;
  company_id: string;
  entity_type: string;
  payload: Json;
  source_references: Json;
  created_at: string;
  updated_at: string;
  is_deleted?: boolean;
  version?: number;
  department_id?: string | null;
  linked_entity_ids?: string[] | null;
};

/** Canonical camelCase model for UI components */
export type UnifiedEntity = {
  id: string;
  companyId: string;
  entityType: string;
  payload: Json;
  sourceReferences: SourceReference[];
  linkedEntityIds: string[];
  createdAt: string;
  updatedAt: string;
  version: number;
  isDeleted: boolean;
  departmentId?: string | null;
};

export function parseSourceReferencesJson(raw: Json): SourceReference[] {
  if (!Array.isArray(raw)) return [];
  const out: SourceReference[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const provider = typeof o.provider === "string" ? o.provider : "";
    const externalId =
      typeof o.externalId === "string"
        ? o.externalId
        : typeof o.external_id === "string"
          ? o.external_id
          : "";
    if (!provider || !externalId) continue;
    const lastSeenAt =
      typeof o.lastSeenAt === "string"
        ? o.lastSeenAt
        : typeof o.last_seen_at === "string"
          ? o.last_seen_at
          : undefined;
    out.push({ provider, externalId, lastSeenAt });
  }
  return out;
}

export function mapUnifiedEntityRow(row: UnifiedEntityRow): UnifiedEntity {
  const links = Array.isArray(row.linked_entity_ids)
    ? row.linked_entity_ids.filter((x): x is string => typeof x === "string")
    : [];
  return {
    id: row.id,
    companyId: row.company_id,
    entityType: row.entity_type,
    payload: row.payload,
    sourceReferences: parseSourceReferencesJson(row.source_references),
    linkedEntityIds: links,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: typeof row.version === "number" ? row.version : 1,
    isDeleted: Boolean(row.is_deleted),
    departmentId: row.department_id ?? null,
  };
}

export function mapUnifiedEntityRows(rows: UnifiedEntityRow[] | null | undefined): UnifiedEntity[] {
  const list = Array.isArray(rows) ? rows : [];
  return list.map(mapUnifiedEntityRow);
}

export function payloadTitle(payload: Json): string {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const o = payload as Record<string, unknown>;
    const title = o.title ?? o.name ?? o.label ?? o.subject;
    if (typeof title === "string" && title.trim()) return title.trim();
  }
  return "Untitled";
}

export function payloadString(payload: Json, key: string): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const v = (payload as Record<string, unknown>)[key];
  return typeof v === "string" ? v : null;
}

export function activityLogSummary(payload: Json): string {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const o = payload as Record<string, unknown>;
    const s =
      typeof o.summary === "string"
        ? o.summary
        : typeof o.message === "string"
          ? o.message
          : null;
    if (s?.trim()) return s.trim();
  }
  try {
    const t = JSON.stringify(payload);
    return t.length > 160 ? `${t.slice(0, 157)}…` : t;
  } catch {
    return "—";
  }
}

export type DashboardEntityRollup = {
  company_id: string;
  entity_type: string;
  active_count: number;
};

export type DashboardKpiSnapshot = DashboardEntityRollup & {
  last_activity_at: string | null;
};

export type ReportTemplateRow = {
  id: string;
  company_id: string;
  department_id: string | null;
  name: string;
  definition: Json;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ReportScheduleRow = {
  id: string;
  company_id: string;
  report_template_id: string;
  cron_expression: string | null;
  export_format: string;
  next_run_at: string | null;
  created_at: string;
};

export type DepartmentWorkspaceSnapshot = {
  department: {
    id: string;
    company_id: string;
    name: string;
    lead_user_id: string | null;
    settings: Json;
    created_at: string;
    updated_at: string;
  } | null;
  entities: UnifiedEntityRow[];
  tasks: UnifiedEntityRow[];
  documents: UnifiedEntityRow[];
  kpis: UnifiedEntityRow[];
};

export type ActivityLogRow = {
  id: string;
  company_id: string;
  event_type: string;
  actor_user_id: string | null;
  payload: Json;
  created_at: string;
};

export type ActivityFeedItem = {
  id: string;
  title: string;
  detail: string;
  at: string;
};

export function mapActivityLogsToFeed(logs: ActivityLogRow[] | null | undefined): ActivityFeedItem[] {
  const list = Array.isArray(logs) ? logs : [];
  return list.map((log) => ({
    id: log.id,
    title: log.event_type,
    detail: activityLogSummary(log.payload),
    at: log.created_at,
  }));
}

export type AiSummaryResult = {
  summary: string;
  citations: Array<{ type: string; id: string }>;
};
