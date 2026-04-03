/**
 * Activity logs & audit trail API — list, search, export, append, admin templates/flags/tenants.
 * Client: supabase.functions.invoke('activity-logs-api', { body: { op, ... } }).
 * Secrets: SUPABASE_URL, SUPABASE_ANON_KEY; SUPABASE_SERVICE_ROLE_KEY for super_admin ops.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";
import { corsHeaders } from "../_shared/cors.ts";
import { redactPayloadJson } from "../_shared/activity-log-redact.ts";

const EVENT_TYPES = z.enum([
  "user_action",
  "workflow_event",
  "workflow_run",
  "integration_sync",
  "connector.sync",
  "ai_action",
  "system_change",
  "system_alert",
  "admin_action",
  "search_event",
  "module_event",
]);

const opSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("activityLog.create"),
    eventType: EVENT_TYPES,
    payload: z.record(z.unknown()).default({}),
    actorUserId: z.string().uuid().optional(),
    workflowRunId: z.string().uuid().optional(),
    connectorId: z.string().uuid().optional(),
    integrationId: z.string().uuid().optional(),
    aiActionId: z.string().uuid().optional(),
    metadata: z.record(z.unknown()).optional(),
    relatedEntity: z.string().max(120).optional(),
    relatedId: z.string().uuid().optional(),
    departmentId: z.string().uuid().optional(),
    idempotencyKey: z.string().min(4).max(200).optional(),
  }),
  z.object({
    op: z.literal("activityLog.list"),
    eventTypes: z.array(z.string()).optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    actorUserId: z.string().uuid().optional(),
    workflowRunId: z.string().uuid().optional(),
    connectorId: z.string().uuid().optional(),
    integrationId: z.string().uuid().optional(),
    aiActionId: z.string().uuid().optional(),
    departmentId: z.string().uuid().optional(),
    search: z.string().max(500).optional(),
    limit: z.number().int().positive().max(200).optional(),
    offset: z.number().int().min(0).optional(),
    includeRedactedOnly: z.boolean().optional(),
  }),
  z.object({
    op: z.literal("activityLog.search"),
    query: z.string().max(500).optional(),
    eventTypes: z.array(z.string()).optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    actorUserId: z.string().uuid().optional(),
    workflowRunId: z.string().uuid().optional(),
    connectorId: z.string().uuid().optional(),
    integrationId: z.string().uuid().optional(),
    aiActionId: z.string().uuid().optional(),
    departmentId: z.string().uuid().optional(),
    limit: z.number().int().positive().max(200).optional(),
    offset: z.number().int().min(0).optional(),
  }),
  z.object({
    op: z.literal("activityLog.export"),
    format: z.enum(["csv", "json"]),
    eventTypes: z.array(z.string()).optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    actorUserId: z.string().uuid().optional(),
    workflowRunId: z.string().uuid().optional(),
    connectorId: z.string().uuid().optional(),
    integrationId: z.string().uuid().optional(),
    aiActionId: z.string().uuid().optional(),
    departmentId: z.string().uuid().optional(),
    search: z.string().max(500).optional(),
    limit: z.number().int().positive().max(5000).optional(),
  }),
  z.object({ op: z.literal("admin.templates.list") }),
  z.object({
    op: z.literal("admin.templates.upsert"),
    templateKey: z.string().min(1).max(120),
    name: z.string().min(1).max(200),
    category: z.string().max(80).optional(),
    definition: z.record(z.unknown()).default({}),
    version: z.string().max(40).optional(),
  }),
  z.object({ op: z.literal("admin.templates.delete"), id: z.string().uuid() }),
  z.object({
    op: z.literal("admin.flags.list"),
    companyId: z.string().uuid().nullable().optional(),
  }),
  z.object({
    op: z.literal("admin.flags.upsert"),
    flagKey: z.string().min(1).max(120),
    companyId: z.string().uuid().nullable().optional(),
    enabled: z.boolean(),
    payload: z.record(z.unknown()).optional(),
  }),
  z.object({
    op: z.literal("admin.tenant.create"),
    name: z.string().min(1).max(200),
    timezone: z.string().max(80).optional(),
    currency: z.string().max(8).optional(),
    domain: z.string().max(200).optional(),
  }),
  z.object({
    op: z.literal("admin.activity.tail"),
    limit: z.number().int().positive().max(200).optional(),
  }),
  z.object({ op: z.literal("admin.pruneRetention") }),
]);

type ParsedOp = z.infer<typeof opSchema>;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function requireUser(
  req: Request,
): Promise<{ supabase: SupabaseClient; userId: string }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return { supabase, userId: user.id };
}

async function loadProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ company_id: string | null; roles: string[] }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("company_id, roles")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  const roles = Array.isArray(data?.roles) ? data!.roles as string[] : [];
  return { company_id: data?.company_id ?? null, roles };
}

function assertCompany(companyId: string | null): asserts companyId is string {
  if (!companyId) {
    throw new Response(JSON.stringify({ error: "Profile missing company" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

function normalizeRoles(roles: string[]): string[] {
  return roles.map((r) => String(r).toLowerCase());
}

function isSuperAdmin(roles: string[]): boolean {
  return normalizeRoles(roles).includes("super_admin");
}

function canViewFullPayload(roles: string[]): boolean {
  const r = normalizeRoles(roles);
  return r.some((x) =>
    ["admin", "owner", "super_admin", "compliance_auditor", "auditor"].includes(x)
  );
}

function canAppendLog(roles: string[]): boolean {
  const r = normalizeRoles(roles);
  return r.some((x) =>
    ["admin", "owner", "super_admin", "manager", "builder", "member"].includes(x)
  );
}

function mapRowForViewer(
  row: Record<string, unknown>,
  fullPayload: boolean,
): Record<string, unknown> {
  const payload = row.payload;
  const redacted = row.redacted_payload ?? redactPayloadJson(payload);
  return {
    ...row,
    payload: fullPayload ? payload : (redacted ?? {}),
    redacted_payload: redacted,
  };
}

function buildListQuery(
  supabase: SupabaseClient,
  companyId: string,
  body: {
    eventTypes?: string[];
    dateFrom?: string;
    dateTo?: string;
    actorUserId?: string;
    workflowRunId?: string;
    connectorId?: string;
    integrationId?: string;
    aiActionId?: string;
    departmentId?: string;
  },
) {
  let q = supabase
    .from("activity_logs")
    .select("*", { count: "exact" })
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  const types = Array.isArray(body.eventTypes) ? body.eventTypes : [];
  if (types.length === 1) q = q.eq("event_type", types[0]!);
  else if (types.length > 1) q = q.in("event_type", types);
  if (body.actorUserId) q = q.eq("actor_user_id", body.actorUserId);
  if (body.workflowRunId) q = q.eq("workflow_run_id", body.workflowRunId);
  if (body.connectorId) q = q.eq("connector_id", body.connectorId);
  if (body.integrationId) q = q.eq("integration_id", body.integrationId);
  if (body.aiActionId) q = q.eq("ai_action_id", body.aiActionId);
  if (body.departmentId) q = q.eq("department_id", body.departmentId);
  if (body.dateFrom) q = q.gte("created_at", body.dateFrom);
  if (body.dateTo) q = q.lte("created_at", body.dateTo);
  return q;
}

function buildExportQuery(
  supabase: SupabaseClient,
  companyId: string,
  body: {
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
  },
) {
  let q = supabase
    .from("activity_logs")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  const types = Array.isArray(body.eventTypes) ? body.eventTypes : [];
  if (types.length === 1) q = q.eq("event_type", types[0]!);
  else if (types.length > 1) q = q.in("event_type", types);
  if (body.actorUserId) q = q.eq("actor_user_id", body.actorUserId);
  if (body.workflowRunId) q = q.eq("workflow_run_id", body.workflowRunId);
  if (body.connectorId) q = q.eq("connector_id", body.connectorId);
  if (body.integrationId) q = q.eq("integration_id", body.integrationId);
  if (body.aiActionId) q = q.eq("ai_action_id", body.aiActionId);
  if (body.departmentId) q = q.eq("department_id", body.departmentId);
  if (body.dateFrom) q = q.gte("created_at", body.dateFrom);
  if (body.dateTo) q = q.lte("created_at", body.dateTo);
  if (body.search?.trim()) {
    const term = body.search.trim().replace(/%/g, "\\%").replace(/_/g, "\\_");
    q = q.or(`event_type.ilike.%${term}%`);
  }
  return q;
}

function toCsv(rows: Record<string, unknown>[]): string {
  const list = Array.isArray(rows) ? rows : [];
  const headers = [
    "id",
    "company_id",
    "created_at",
    "event_type",
    "actor_user_id",
    "workflow_run_id",
    "connector_id",
    "integration_id",
    "ai_action_id",
    "related_entity",
    "related_id",
    "department_id",
    "payload",
  ];
  const lines = [
    headers.join(","),
    ...list.map((r) =>
      headers
        .map((h) => {
          const v = h === "payload"
            ? JSON.stringify(r[h] ?? {})
            : String(r[h] ?? "");
          return `"${String(v).replace(/"/g, '""')}"`;
        })
        .join(",")
    ),
  ];
  return lines.join("\n");
}

async function handleOp(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
  roles: string[],
  body: ParsedOp,
): Promise<Response> {
  const fullPayload = canViewFullPayload(roles);

  switch (body.op) {
    case "activityLog.create": {
      if (!canAppendLog(roles)) {
        return json({ error: "Forbidden" }, 403);
      }
      const payload = body.payload ?? {};
      const redacted = redactPayloadJson(payload) as Record<string, unknown>;
      const row: Record<string, unknown> = {
        company_id: companyId,
        event_type: body.eventType,
        actor_user_id: body.actorUserId ?? userId,
        payload,
        redacted_payload: redacted,
        metadata: body.metadata ?? {},
      };
      if (body.workflowRunId) row.workflow_run_id = body.workflowRunId;
      if (body.connectorId) row.connector_id = body.connectorId;
      if (body.integrationId) row.integration_id = body.integrationId;
      if (body.aiActionId) row.ai_action_id = body.aiActionId;
      if (body.relatedEntity) row.related_entity = body.relatedEntity;
      if (body.relatedId) row.related_id = body.relatedId;
      if (body.departmentId) row.department_id = body.departmentId;
      if (body.idempotencyKey) row.idempotency_key = body.idempotencyKey;

      const { data, error } = await supabase
        .from("activity_logs")
        .insert(row)
        .select("*")
        .single();
      if (error) {
        const msg = error.message ?? "insert failed";
        if (msg.includes("duplicate") || msg.includes("unique")) {
          return json({ error: "Duplicate idempotency key", code: "idempotent_conflict" }, 409);
        }
        return json({ error: msg }, 400);
      }
      return json({ data: mapRowForViewer(data as Record<string, unknown>, fullPayload) });
    }

    case "activityLog.list": {
      const limit = body.limit ?? 50;
      const offset = body.offset ?? 0;

      let rows: Record<string, unknown>[] = [];
      let count: number | null = null;

      if (body.search?.trim()) {
        const types = Array.isArray(body.eventTypes) && body.eventTypes.length > 0
          ? body.eventTypes
          : null;
        const { data, error } = await supabase.rpc("match_activity_logs", {
          p_company_id: companyId,
          p_query: body.search.trim(),
          p_event_types: types,
          p_actor_user_id: body.actorUserId ?? null,
          p_workflow_run_id: body.workflowRunId ?? null,
          p_connector_id: body.connectorId ?? null,
          p_integration_id: body.integrationId ?? null,
          p_ai_action_id: body.aiActionId ?? null,
          p_department_id: body.departmentId ?? null,
          p_date_from: body.dateFrom ?? null,
          p_date_to: body.dateTo ?? null,
          p_limit: limit,
          p_offset: offset,
        });
        if (error) return json({ error: error.message }, 400);
        rows = Array.isArray(data) ? data as Record<string, unknown>[] : [];
        const { data: cnt, error: cErr } = await supabase.rpc(
          "match_activity_logs_count",
          {
            p_company_id: companyId,
            p_query: body.search.trim(),
            p_event_types: types,
            p_actor_user_id: body.actorUserId ?? null,
            p_workflow_run_id: body.workflowRunId ?? null,
            p_connector_id: body.connectorId ?? null,
            p_integration_id: body.integrationId ?? null,
            p_ai_action_id: body.aiActionId ?? null,
            p_department_id: body.departmentId ?? null,
            p_date_from: body.dateFrom ?? null,
            p_date_to: body.dateTo ?? null,
          },
        );
        if (cErr) return json({ error: cErr.message }, 400);
        count = typeof cnt === "number" ? cnt : Number(cnt ?? 0);
      } else {
        let q = buildListQuery(supabase, companyId, {
          eventTypes: body.eventTypes,
          dateFrom: body.dateFrom,
          dateTo: body.dateTo,
          actorUserId: body.actorUserId,
          workflowRunId: body.workflowRunId,
          connectorId: body.connectorId,
          integrationId: body.integrationId,
          aiActionId: body.aiActionId,
          departmentId: body.departmentId,
        });
        q = q.range(offset, offset + limit - 1);
        const { data, error, count: ct } = await q;
        if (error) return json({ error: error.message }, 400);
        rows = Array.isArray(data) ? data as Record<string, unknown>[] : [];
        count = ct;
      }

      if (body.includeRedactedOnly) {
        rows = rows.map((r) => ({
          ...r,
          payload: r.redacted_payload ?? redactPayloadJson(r.payload),
        }));
      } else {
        rows = rows.map((r) => mapRowForViewer(r, fullPayload));
      }

      return json({
        data: rows,
        total: count ?? rows.length,
        canViewFullPayload: canViewFullPayload(roles),
      });
    }

    case "activityLog.search": {
      const types = Array.isArray(body.eventTypes) && body.eventTypes.length > 0
        ? body.eventTypes
        : null;
      const limit = body.limit ?? 50;
      const offset = body.offset ?? 0;
      const { data, error } = await supabase.rpc("match_activity_logs", {
        p_company_id: companyId,
        p_query: body.query?.trim() ?? "",
        p_event_types: types,
        p_actor_user_id: body.actorUserId ?? null,
        p_workflow_run_id: body.workflowRunId ?? null,
        p_connector_id: body.connectorId ?? null,
        p_integration_id: body.integrationId ?? null,
        p_ai_action_id: body.aiActionId ?? null,
        p_department_id: body.departmentId ?? null,
        p_date_from: body.dateFrom ?? null,
        p_date_to: body.dateTo ?? null,
        p_limit: limit,
        p_offset: offset,
      });
      if (error) return json({ error: error.message }, 400);
      const raw = Array.isArray(data) ? data as Record<string, unknown>[] : [];
      const mapped = raw.map((r) => mapRowForViewer(r, fullPayload));
      return json({
        data: mapped,
        total: mapped.length,
        canViewFullPayload: canViewFullPayload(roles),
      });
    }

    case "activityLog.export": {
      const exportLimit = Math.min(body.limit ?? 2000, 5000);
      let raw: Record<string, unknown>[] = [];
      if (body.search?.trim()) {
        const types = Array.isArray(body.eventTypes) && body.eventTypes.length > 0
          ? body.eventTypes
          : null;
        const { data, error } = await supabase.rpc("match_activity_logs", {
          p_company_id: companyId,
          p_query: body.search.trim(),
          p_event_types: types,
          p_actor_user_id: body.actorUserId ?? null,
          p_workflow_run_id: body.workflowRunId ?? null,
          p_connector_id: body.connectorId ?? null,
          p_integration_id: body.integrationId ?? null,
          p_ai_action_id: body.aiActionId ?? null,
          p_department_id: body.departmentId ?? null,
          p_date_from: body.dateFrom ?? null,
          p_date_to: body.dateTo ?? null,
          p_limit: exportLimit,
          p_offset: 0,
        });
        if (error) return json({ error: error.message }, 400);
        raw = Array.isArray(data) ? data as Record<string, unknown>[] : [];
      } else {
        let q = buildExportQuery(supabase, companyId, {
          eventTypes: body.eventTypes,
          dateFrom: body.dateFrom,
          dateTo: body.dateTo,
          actorUserId: body.actorUserId,
          workflowRunId: body.workflowRunId,
          connectorId: body.connectorId,
          integrationId: body.integrationId,
          aiActionId: body.aiActionId,
          departmentId: body.departmentId,
          search: undefined,
        });
        q = q.limit(exportLimit);
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 400);
        raw = Array.isArray(data) ? data as Record<string, unknown>[] : [];
      }
      const forExport = fullPayload
        ? raw
        : raw.map((r) => ({
          ...r,
          payload: r.redacted_payload ?? redactPayloadJson(r.payload),
        }));
      if (body.format === "csv") {
        return json({
          format: "csv",
          filename: `activity-export-${new Date().toISOString().slice(0, 10)}.csv`,
          content: toCsv(forExport),
        });
      }
      return json({
        format: "json",
        filename: `activity-export-${new Date().toISOString().slice(0, 10)}.json`,
        content: JSON.stringify(forExport, null, 2),
      });
    }

    default:
      return json({ error: "Unknown op" }, 400);
  }
}

async function handleAdminOp(
  userId: string,
  roles: string[],
  body: ParsedOp,
): Promise<Response> {
  if (!isSuperAdmin(roles)) {
    return json({ error: "Forbidden" }, 403);
  }
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  if (!serviceKey) return json({ error: "Server missing service role" }, 500);
  const admin = createClient(url, serviceKey);

  switch (body.op) {
    case "admin.templates.list": {
      const { data, error } = await admin
        .from("system_templates")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) return json({ error: error.message }, 500);
      return json({ data: Array.isArray(data) ? data : [] });
    }
    case "admin.templates.upsert": {
      const now = new Date().toISOString();
      const { data, error } = await admin
        .from("system_templates")
        .upsert(
          {
            template_key: body.templateKey,
            name: body.name,
            category: body.category ?? "module",
            definition: body.definition,
            version: body.version ?? "1.0.0",
            updated_at: now,
          },
          { onConflict: "template_key" },
        )
        .select("*")
        .single();
      if (error) return json({ error: error.message }, 400);
      const { data: prof } = await admin
        .from("profiles")
        .select("company_id")
        .eq("id", userId)
        .maybeSingle();
      const logCompany = prof?.company_id;
      if (logCompany) {
        const auditPayload = {
          action: "system_templates.upsert",
          templateKey: body.templateKey,
        };
        await admin.from("activity_logs").insert({
          company_id: logCompany,
          event_type: "admin_action",
          actor_user_id: userId,
          payload: auditPayload,
          redacted_payload: redactPayloadJson(auditPayload) as Record<string, unknown>,
          metadata: { source: "activity-logs-api" },
        });
      }
      return json({ data });
    }
    case "admin.templates.delete": {
      const { error } = await admin.from("system_templates").delete().eq("id", body.id);
      if (error) return json({ error: error.message }, 400);
      return json({ data: { ok: true } });
    }
    case "admin.flags.list": {
      let q = admin.from("feature_flags").select("*").order("flag_key", { ascending: true });
      if (body.companyId === null) {
        q = q.is("company_id", null);
      } else if (body.companyId) {
        q = q.eq("company_id", body.companyId);
      }
      const { data, error } = await q;
      if (error) return json({ error: error.message }, 500);
      return json({ data: Array.isArray(data) ? data : [] });
    }
    case "admin.flags.upsert": {
      const now = new Date().toISOString();
      const companyId = body.companyId ?? null;
      let q = admin.from("feature_flags").select("id").eq("flag_key", body.flagKey);
      q = companyId === null ? q.is("company_id", null) : q.eq("company_id", companyId);
      const { data: existing, error: findErr } = await q.maybeSingle();
      if (findErr) return json({ error: findErr.message }, 400);

      const row = {
        flag_key: body.flagKey,
        company_id: companyId,
        enabled: body.enabled,
        payload: body.payload ?? {},
        updated_at: now,
      };

      if (existing?.id) {
        const { data, error } = await admin
          .from("feature_flags")
          .update(row)
          .eq("id", existing.id)
          .select("*")
          .single();
        if (error) return json({ error: error.message }, 400);
        return json({ data });
      }

      const { data, error } = await admin
        .from("feature_flags")
        .insert(row)
        .select("*")
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }
    case "admin.tenant.create": {
      const { data, error } = await admin
        .from("companies")
        .insert({
          name: body.name,
          timezone: body.timezone ?? "UTC",
          currency: body.currency ?? "USD",
          domain: body.domain ?? null,
        })
        .select("*")
        .single();
      if (error) return json({ error: error.message }, 400);
      const tenantAuditPayload = {
        action: "tenant.create",
        companyId: data.id,
        name: body.name,
      };
      await admin.from("activity_logs").insert({
        company_id: data.id,
        event_type: "admin_action",
        actor_user_id: userId,
        payload: tenantAuditPayload,
        redacted_payload: redactPayloadJson(tenantAuditPayload) as Record<string, unknown>,
        metadata: { source: "activity-logs-api" },
      });
      return json({ data });
    }
    case "admin.activity.tail": {
      const lim = body.limit ?? 80;
      const { data, error } = await admin
        .from("activity_logs")
        .select("*")
        .eq("event_type", "admin_action")
        .order("created_at", { ascending: false })
        .limit(lim);
      if (error) return json({ error: error.message }, 500);
      const list = Array.isArray(data) ? data : [];
      return json({ data: list, total: list.length });
    }
    case "admin.pruneRetention": {
      const { data: companies, error: cErr } = await admin
        .from("companies")
        .select("id, activity_log_retention_days");
      if (cErr) return json({ error: cErr.message }, 500);
      const list = Array.isArray(companies) ? companies : [];
      let deletedTotal = 0;
      for (const row of list) {
        const companyId = row.id as string;
        const daysRaw = row.activity_log_retention_days;
        const days = typeof daysRaw === "number" && daysRaw > 0 ? daysRaw : 365;
        const cutoff = new Date();
        cutoff.setUTCDate(cutoff.getUTCDate() - days);
        const cutoffIso = cutoff.toISOString();
        const { error: delErr, count } = await admin
          .from("activity_logs")
          .delete({ count: "exact" })
          .eq("company_id", companyId)
          .lt("created_at", cutoffIso);
        if (delErr) {
          return json({ error: delErr.message, companyId }, 500);
        }
        deletedTotal += count ?? 0;
      }
      return json({
        data: {
          ok: true,
          tenantsProcessed: list.length,
          rowsDeleted: deletedTotal,
        },
      });
    }
    default:
      return json({ error: "Unknown admin op" }, 400);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabase, userId } = await requireUser(req);
    const { company_id, roles } = await loadProfile(supabase, userId);

    let bodyJson: unknown;
    try {
      bodyJson = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const parsed = opSchema.safeParse(bodyJson);
    if (!parsed.success) {
      return json({ error: parsed.error.flatten() }, 422);
    }

    const op = parsed.data.op;
    const adminOps = [
      "admin.templates.list",
      "admin.templates.upsert",
      "admin.templates.delete",
      "admin.flags.list",
      "admin.flags.upsert",
      "admin.tenant.create",
      "admin.activity.tail",
      "admin.pruneRetention",
    ].includes(op);

    if (adminOps) {
      return await handleAdminOp(userId, roles, parsed.data);
    }

    assertCompany(company_id);
    return await handleOp(supabase, userId, company_id, roles, parsed.data);
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    return json({ error: msg }, 500);
  }
});
