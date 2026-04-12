/**
 * Dashboard framework API — widget registry, per-user layouts (react-grid-layout JSON),
 * widget instances, export schedules, audit events. Tenant-scoped via RLS + profile checks.
 * Client: supabase.functions.invoke('dashboard-api', { body: { op, ... } }).
 * Secrets: SUPABASE_URL, SUPABASE_ANON_KEY.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";
import { corsHeaders } from "../_shared/cors.ts";
import {
  getRuntimeToolDefinition,
  toolsExecute,
} from "../_shared/integrations-runtime.ts";

const visibilityRulesSchema = z.object({
  roles: z.array(z.string()).optional(),
});

const instanceInputSchema = z.object({
  id: z.string().uuid(),
  widgetDefinitionId: z.string().uuid().nullable().optional(),
  widgetType: z.string().min(1),
  config: z.record(z.unknown()).optional(),
  isVisible: z.boolean().optional(),
});

const customDashboardVisibilityModeSchema = z.enum(["private", "roles", "company"]);

const customDashboardQueryStepSchema = z.object({
  toolId: z.string().min(1).max(200),
  args: z.record(z.unknown()).optional(),
  provider: z.string().min(1).max(80).optional(),
  label: z.string().min(1).max(200).optional(),
});

const opSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("definitions.list") }),
  z.object({
    op: z.literal("definitions.register"),
    name: z.string().min(1).max(200),
    type: z.string().min(1).max(120),
    defaultConfig: z.record(z.unknown()).optional(),
    visibilityRules: visibilityRulesSchema.optional(),
    dataAdapterKey: z.string().max(120).optional(),
  }),
  z.object({ op: z.literal("widgets.available") }),
  z.object({
    op: z.literal("layout.get"),
    dashboardKind: z.enum(["global", "executive"]),
    name: z.string().max(120).optional(),
  }),
  z.object({
    op: z.literal("layout.ensure"),
    dashboardKind: z.enum(["global", "executive"]),
    name: z.string().max(120).optional(),
  }),
  z.object({
    op: z.literal("layout.save"),
    dashboardKind: z.enum(["global", "executive"]),
    name: z.string().max(120).optional(),
    layoutJson: z.record(z.unknown()),
    instances: z.array(instanceInputSchema).optional(),
  }),
  z.object({
    op: z.literal("export.schedules.create"),
    targetType: z.enum(["email", "webhook"]),
    targetValue: z.string().min(1).max(2000),
    cronExpression: z.string().max(200).optional(),
    layoutId: z.string().uuid().optional(),
  }),
  z.object({ op: z.literal("export.schedules.list") }),
  z.object({
    op: z.literal("export.schedule.get"),
    scheduleId: z.string().uuid(),
  }),
  z.object({
    op: z.literal("export.schedule.trigger"),
    scheduleId: z.string().uuid(),
  }),
  z.object({
    op: z.literal("widget.instance.patch"),
    instanceId: z.string().uuid(),
    config: z.record(z.unknown()).optional(),
    isVisible: z.boolean().optional(),
  }),
  z.object({
    op: z.literal("customDashboards.list"),
    limit: z.number().int().positive().max(200).optional(),
  }),
  z.object({
    op: z.literal("customDashboards.get"),
    dashboardId: z.string().uuid(),
  }),
  z.object({
    op: z.literal("customDashboards.save"),
    dashboardId: z.string().uuid().optional(),
    title: z.string().min(1).max(200),
    description: z.string().max(4000).nullable().optional(),
    codeTsx: z.string().min(1).max(300000),
    queryPlan: z.array(customDashboardQueryStepSchema).optional(),
    snapshotData: z.record(z.unknown()).optional(),
    sources: z.array(z.string().min(1).max(80)).optional(),
    visibilityMode: customDashboardVisibilityModeSchema.optional(),
    sharedRoles: z.array(z.string().min(1).max(120)).optional(),
  }),
  z.object({
    op: z.literal("customDashboards.updateMeta"),
    dashboardId: z.string().uuid(),
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(4000).nullable().optional(),
    visibilityMode: customDashboardVisibilityModeSchema.optional(),
    sharedRoles: z.array(z.string().min(1).max(120)).optional(),
  }),
  z.object({
    op: z.literal("customDashboards.refreshData"),
    dashboardId: z.string().uuid(),
  }),
  z.object({
    op: z.literal("customDashboards.delete"),
    dashboardId: z.string().uuid(),
  }),
]);

type ParsedOp = z.infer<typeof opSchema>;

type DefRow = {
  id: string;
  company_id: string | null;
  name: string;
  type: string;
  default_config: Record<string, unknown>;
  visibility_rules: { roles?: string[] } | null;
  data_adapter_key: string | null;
};

type CustomDashboardQueryStep = {
  toolId: string;
  args?: Record<string, unknown>;
  provider?: string;
  label?: string;
};

type CustomDashboardRow = {
  id: string;
  company_id: string;
  creator_user_id: string;
  title: string;
  description: string | null;
  code_tsx: string;
  query_plan: unknown;
  snapshot_data: Record<string, unknown> | null;
  visibility_mode: "private" | "roles" | "company";
  shared_roles: string[] | null;
  integration_sources: string[] | null;
  latest_run_at: string | null;
  created_at: string;
  updated_at: string;
};

type CustomDashboardRunRow = {
  id: string;
  company_id: string;
  dashboard_id: string | null;
  actor_user_id: string;
  trigger_type: "generation" | "refresh";
  status: "succeeded" | "failed";
  query_plan: unknown;
  result_snapshot: Record<string, unknown> | null;
  integration_sources: string[] | null;
  error_message: string | null;
  execution_ms: number | null;
  created_at: string;
  completed_at: string;
};

function normalizeRoles(roles: string[] | null | undefined): string[] {
  const r = Array.isArray(roles) ? roles : [];
  return Array.from(
    new Set(
      r
        .map((x) => String(x).trim().toLowerCase())
        .filter((x) => x.length > 0),
    ),
  );
}

function normalizeRoleNames(roles: string[] | null | undefined): string[] {
  return normalizeRoles(roles);
}

function normalizeIntegrationSources(sources: string[] | null | undefined): string[] {
  const raw = Array.isArray(sources) ? sources : [];
  return Array.from(
    new Set(
      raw
        .map((x) => String(x).trim().toLowerCase())
        .filter((x) => x.length > 0)
        .slice(0, 40),
    ),
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function toIsoNow(): string {
  return new Date().toISOString();
}

function parseCustomQueryPlan(raw: unknown): CustomDashboardQueryStep[] {
  const parsed = z.array(customDashboardQueryStepSchema).safeParse(raw);
  if (!parsed.success) return [];
  return parsed.data.map((step) => ({
    toolId: step.toolId,
    args: step.args ?? {},
    provider: step.provider,
    label: step.label,
  }));
}

function runtimeSupabaseForTools(fallback: SupabaseClient): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (supabaseUrl && serviceRoleKey) {
    return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  }
  return fallback;
}

async function isFeatureEnabled(
  supabase: SupabaseClient,
  companyId: string,
  flagKey: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("feature_flags")
    .select("company_id, enabled, rollout")
    .eq("flag_key", flagKey)
    .or(`company_id.eq.${companyId},company_id.is.null`);
  if (error) throw error;
  const rows = Array.isArray(data)
    ? data
    : [];
  const tenantRow = rows.find((row) => row && row.company_id === companyId);
  const globalRow = rows.find((row) => row && row.company_id === null);
  const selected = tenantRow ?? globalRow;
  if (!selected) return false;
  const enabled = selected.enabled === true;
  const rollout = typeof selected.rollout === "number" ? selected.rollout : 100;
  return enabled && rollout > 0;
}

async function assertCustomDashboardsEnabled(
  supabase: SupabaseClient,
  companyId: string,
): Promise<void> {
  const enabled = await isFeatureEnabled(supabase, companyId, "custom_dashboards_v1");
  if (!enabled) {
    throw new Response(JSON.stringify({ error: "Feature disabled: custom_dashboards_v1" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

function canViewCustomDashboardRow(
  dashboard: CustomDashboardRow,
  userId: string,
  userRoles: string[],
): boolean {
  if (dashboard.creator_user_id === userId) return true;
  if (dashboard.visibility_mode === "company") return true;
  if (dashboard.visibility_mode !== "roles") return false;
  const shared = new Set(normalizeRoleNames(dashboard.shared_roles));
  return userRoles.some((role) => shared.has(role));
}

function sanitizeSnapshotValue(value: unknown, depth = 0): unknown {
  if (value === null) return null;
  if (typeof value === "string") {
    return value.length > 8000 ? `${value.slice(0, 8000)}...(truncated)` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= 4) return "[max-depth]";
  if (Array.isArray(value)) {
    return value.slice(0, 120).map((item) => sanitizeSnapshotValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(record).slice(0, 120)) {
      out[key] = sanitizeSnapshotValue(val, depth + 1);
    }
    return out;
  }
  return String(value);
}

async function insertCustomDashboardRun(
  supabase: SupabaseClient,
  payload: {
    companyId: string;
    dashboardId: string | null;
    userId: string;
    triggerType: "generation" | "refresh";
    status: "succeeded" | "failed";
    queryPlan: CustomDashboardQueryStep[];
    snapshot: Record<string, unknown>;
    integrationSources: string[];
    errorMessage?: string | null;
    executionMs?: number;
  },
): Promise<CustomDashboardRunRow | null> {
  const { data, error } = await supabase
    .from("custom_dashboard_runs")
    .insert({
      company_id: payload.companyId,
      dashboard_id: payload.dashboardId,
      actor_user_id: payload.userId,
      trigger_type: payload.triggerType,
      status: payload.status,
      query_plan: payload.queryPlan,
      result_snapshot: payload.snapshot,
      integration_sources: payload.integrationSources,
      error_message: payload.errorMessage ?? null,
      execution_ms: payload.executionMs ?? null,
      completed_at: toIsoNow(),
    })
    .select("*")
    .maybeSingle();
  if (error) {
    console.warn(`custom_dashboard_runs.insert failed: ${error.message}`);
    return null;
  }
  return (data ?? null) as CustomDashboardRunRow | null;
}

async function executeCustomDashboardQueryPlan(params: {
  runtimeSupabase: SupabaseClient;
  companyId: string;
  userId: string;
  userRoles: string[];
  queryPlan: CustomDashboardQueryStep[];
}): Promise<{
  snapshotData: Record<string, unknown>;
  integrationSources: string[];
  steps: Array<Record<string, unknown>>;
  errors: string[];
}> {
  const masterKey = Deno.env.get("CREDENTIALS_MASTER_KEY");
  if (!masterKey) {
    throw new Error("CREDENTIALS_MASTER_KEY is not configured");
  }

  const stepsOut: Array<Record<string, unknown>> = [];
  const errors: string[] = [];
  const sources = new Set<string>();

  for (let index = 0; index < params.queryPlan.length; index++) {
    const step = params.queryPlan[index];
    const toolId = typeof step.toolId === "string" ? step.toolId : "";
    const toolDef = getRuntimeToolDefinition(toolId);
    if (!toolDef) {
      const msg = `Unknown tool in query plan: ${toolId}`;
      errors.push(msg);
      stepsOut.push({
        step: index + 1,
        toolId,
        args: step.args ?? {},
        status: "failed",
        error: msg,
        executedAt: toIsoNow(),
      });
      continue;
    }
    if (toolDef.accessLevel !== "read") {
      const msg = `Query plan tool must be read-only: ${toolId}`;
      errors.push(msg);
      stepsOut.push({
        step: index + 1,
        toolId,
        args: step.args ?? {},
        status: "failed",
        error: msg,
        executedAt: toIsoNow(),
      });
      continue;
    }

    try {
      const started = Date.now();
      const exec = await toolsExecute(params.runtimeSupabase, {
        companyId: params.companyId,
        userId: params.userId,
        roles: params.userRoles,
        toolId,
        args: asRecord(step.args),
        confirmed: true,
        source: "integrations_api",
        masterKey,
      });
      const elapsed = Date.now() - started;
      if (exec.providerKey) sources.add(exec.providerKey);
      stepsOut.push({
        step: index + 1,
        toolId,
        providerKey: exec.providerKey,
        args: asRecord(step.args),
        status: "succeeded",
        executionMs: elapsed,
        executedAt: toIsoNow(),
        result: sanitizeSnapshotValue(exec.result ?? {}),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Query execution failed";
      errors.push(`${toolId}: ${message}`);
      stepsOut.push({
        step: index + 1,
        toolId,
        args: asRecord(step.args),
        status: "failed",
        error: message,
        executedAt: toIsoNow(),
      });
    }
  }

  return {
    snapshotData: {
      generatedAt: toIsoNow(),
      datasets: stepsOut,
      summary: {
        stepCount: params.queryPlan.length,
        successCount: stepsOut.filter((row) => row.status === "succeeded").length,
        errorCount: errors.length,
      },
    },
    integrationSources: normalizeIntegrationSources(Array.from(sources)),
    steps: stepsOut,
    errors,
  };
}

function roleAllowedForWidget(
  userRoles: string[],
  rules: { roles?: string[] } | null | undefined,
): boolean {
  const allowed = Array.isArray(rules?.roles) ? rules!.roles! : [];
  if (allowed.length === 0) return true;
  const u = new Set(userRoles);
  return allowed.some((ar) => u.has(String(ar).toLowerCase()));
}

function filterDefinitionsForUser(defs: DefRow[], userRoles: string[]): DefRow[] {
  const list = Array.isArray(defs) ? defs : [];
  return list.filter((d) => roleAllowedForWidget(userRoles, d.visibility_rules));
}

async function requireUser(req: Request): Promise<{ supabase: SupabaseClient; userId: string }> {
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
  const companyId = data?.company_id ?? null;
  const profileRoles = Array.isArray(data?.roles) ? (data!.roles as string[]) : [];

  if (!companyId) {
    return { company_id: null, roles: normalizeRoles(profileRoles) };
  }

  const { data: assignedRows, error: assignedError } = await supabase
    .from("profile_role_assignments")
    .select("role_id, roles!inner(name, company_id)")
    .eq("profile_id", userId);
  if (assignedError) throw assignedError;
  const assignedRoleNames = (Array.isArray(assignedRows) ? assignedRows : [])
    .map((row) => {
      const joined = row && typeof row === "object" && "roles" in row
        ? (row as { roles?: { name?: unknown; company_id?: unknown } }).roles
        : undefined;
      if (!joined || joined.company_id !== companyId || typeof joined.name !== "string") return null;
      return joined.name;
    })
    .filter((name): name is string => Boolean(name));

  return {
    company_id: companyId,
    roles: normalizeRoles([...profileRoles, ...assignedRoleNames]),
  };
}

function assertCompany(companyId: string | null): asserts companyId is string {
  if (!companyId) {
    throw new Response(JSON.stringify({ error: "No tenant context" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

function isAdminish(roles: string[]): boolean {
  const r = new Set(normalizeRoles(roles));
  return r.has("admin") || r.has("company admin");
}

async function logDashboardAudit(
  supabase: SupabaseClient,
  companyId: string,
  userId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await supabase.from("dashboard_audit_events").insert({
    company_id: companyId,
    actor_user_id: userId,
    event_type: eventType,
    payload,
  });
  await supabase.from("activity_logs").insert({
    company_id: companyId,
    event_type: `dashboard.${eventType}`,
    actor_user_id: userId,
    payload,
  });
}

async function fetchDefinitionTypeMap(supabase: SupabaseClient): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("dashboard_widget_definitions")
    .select("id, type, company_id")
    .is("company_id", null);
  if (error) throw error;
  const map = new Map<string, string>();
  const rows = Array.isArray(data) ? data : [];
  for (const row of rows) {
    if (row?.type && row?.id) map.set(String(row.type), String(row.id));
  }
  return map;
}

function buildDefaultLayoutPayload(
  kind: "global" | "executive",
  typeToDefId: Map<string, string>,
): {
  layoutJson: Record<string, unknown>;
  instances: z.infer<typeof instanceInputSchema>[];
} {
  const mk = (type: string) => {
    const id = crypto.randomUUID();
    const widgetDefinitionId = typeToDefId.get(type) ?? null;
    return {
      id,
      widgetDefinitionId,
      widgetType: type,
      config: {},
      isVisible: true,
    };
  };

  if (kind === "executive") {
    const brief = mk("exec_ai_brief");
    const risk = mk("risk_pie");
    const heat = mk("dept_heatmap");
    const metrics = mk("exec_metrics");
    return {
      layoutJson: {
        breakpoints: { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 },
        cols: { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 },
        layouts: {
          lg: [
            { i: brief.id, x: 0, y: 0, w: 8, h: 10, minW: 4, minH: 6 },
            { i: risk.id, x: 8, y: 0, w: 4, h: 10, minW: 3, minH: 6 },
            { i: metrics.id, x: 0, y: 10, w: 12, h: 6, minW: 4, minH: 4 },
            { i: heat.id, x: 0, y: 16, w: 12, h: 8, minW: 4, minH: 4 },
          ],
        },
        widgets: Object.fromEntries(
          [brief, risk, metrics, heat].map((w) => [
            w.id,
            { type: w.widgetType, definitionId: w.widgetDefinitionId },
          ]),
        ),
      },
      instances: [brief, risk, metrics, heat],
    };
  }

  const kpi = mk("kpi_strip");
  const chart = mk("throughput_chart");
  const quick = mk("quick_actions");
  const act = mk("activity_stream");
  const alerts = mk("alerts_feed");
  const insight = mk("ai_insight");
  const gov = mk("ai_governance");
  const search = mk("global_search_card");

  return {
    layoutJson: {
      breakpoints: { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 },
      cols: { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 },
      layouts: {
        lg: [
          { i: search.id, x: 0, y: 0, w: 12, h: 5, minW: 4, minH: 3 },
          { i: kpi.id, x: 0, y: 5, w: 12, h: 6, minW: 6, minH: 4 },
          { i: insight.id, x: 0, y: 11, w: 12, h: 5, minW: 4, minH: 3 },
          { i: gov.id, x: 0, y: 16, w: 12, h: 9, minW: 4, minH: 4 },
          { i: chart.id, x: 0, y: 25, w: 8, h: 9, minW: 4, minH: 4 },
          { i: quick.id, x: 8, y: 25, w: 4, h: 9, minW: 2, minH: 4 },
          { i: act.id, x: 0, y: 34, w: 6, h: 10, minW: 3, minH: 4 },
          { i: alerts.id, x: 6, y: 34, w: 6, h: 10, minW: 3, minH: 4 },
        ],
      },
      widgets: Object.fromEntries(
        [search, kpi, insight, gov, chart, quick, act, alerts].map((w) => [
          w.id,
          { type: w.widgetType, definitionId: w.widgetDefinitionId },
        ]),
      ),
    },
    instances: [search, kpi, insight, gov, chart, quick, act, alerts],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let supabase: SupabaseClient;
  let userId: string;

  try {
    const u = await requireUser(req);
    supabase = u.supabase;
    userId = u.userId;
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const parsed = opSchema.safeParse(raw);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid body", issues: parsed.error.flatten() }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const op = parsed.data as ParsedOp;

  try {
    const { company_id, roles } = await loadProfile(supabase, userId);
    assertCompany(company_id);
    const companyId = company_id;
    const userRoles = normalizeRoles(roles);

    switch (op.op) {
      case "definitions.list": {
        const { data, error } = await supabase
          .from("dashboard_widget_definitions")
          .select(
            "id, company_id, name, type, default_config, visibility_rules, data_adapter_key, created_at, updated_at",
          )
          .or(`company_id.is.null,company_id.eq.${companyId}`)
          .order("name", { ascending: true });
        if (error) throw error;
        const list = Array.isArray(data) ? (data as DefRow[]) : [];
        return new Response(JSON.stringify({ data: { definitions: list } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "definitions.register": {
        if (!isAdminish(roles)) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const vis = op.visibilityRules ?? { roles: [] as string[] };
        const { data, error } = await supabase
          .from("dashboard_widget_definitions")
          .insert({
            company_id: companyId,
            name: op.name,
            type: op.type,
            default_config: op.defaultConfig ?? {},
            visibility_rules: vis,
            data_adapter_key: op.dataAdapterKey ?? null,
          })
          .select("id, name, type, default_config, visibility_rules, data_adapter_key, created_at")
          .single();
        if (error) throw error;
        await logDashboardAudit(supabase, companyId, userId, "widget.registered", {
          type: op.type,
        });
        return new Response(JSON.stringify({ data: { definition: data } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "widgets.available": {
        const { data, error } = await supabase
          .from("dashboard_widget_definitions")
          .select(
            "id, company_id, name, type, default_config, visibility_rules, data_adapter_key, created_at, updated_at",
          )
          .or(`company_id.is.null,company_id.eq.${companyId}`)
          .order("name", { ascending: true });
        if (error) throw error;
        const list = Array.isArray(data) ? (data as DefRow[]) : [];
        const filtered = filterDefinitionsForUser(list, userRoles);
        return new Response(JSON.stringify({ data: { definitions: filtered } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "layout.get": {
        const name = op.name ?? "Default";
        const { data, error } = await supabase
          .from("dashboard_layouts")
          .select("id, name, dashboard_kind, layout_json, version, created_at, updated_at")
          .eq("company_id", companyId)
          .eq("user_id", userId)
          .eq("dashboard_kind", op.dashboardKind)
          .eq("name", name)
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          return new Response(
            JSON.stringify({ data: { layout: null, instances: [] as unknown[] } }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        const { data: inst, error: e2 } = await supabase
          .from("dashboard_widget_instances")
          .select(
            "id, layout_id, widget_definition_id, widget_type, config, is_visible, created_at, updated_at",
          )
          .eq("layout_id", data.id);
        if (e2) throw e2;
        return new Response(
          JSON.stringify({
            data: {
              layout: data,
              instances: Array.isArray(inst) ? inst : [],
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      case "layout.ensure": {
        const name = op.name ?? "Default";
        const { data: existing, error: e0 } = await supabase
          .from("dashboard_layouts")
          .select("id")
          .eq("company_id", companyId)
          .eq("user_id", userId)
          .eq("dashboard_kind", op.dashboardKind)
          .eq("name", name)
          .maybeSingle();
        if (e0) throw e0;
        if (existing?.id) {
          const { data: layout, error: e1 } = await supabase
            .from("dashboard_layouts")
            .select("id, name, dashboard_kind, layout_json, version, created_at, updated_at")
            .eq("id", existing.id)
            .single();
          if (e1) throw e1;
          const { data: inst, error: e2 } = await supabase
            .from("dashboard_widget_instances")
            .select(
              "id, layout_id, widget_definition_id, widget_type, config, is_visible, created_at, updated_at",
            )
            .eq("layout_id", existing.id);
          if (e2) throw e2;
          return new Response(
            JSON.stringify({
              data: {
                layout,
                instances: Array.isArray(inst) ? inst : [],
              },
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const typeMap = await fetchDefinitionTypeMap(supabase);
        const { layoutJson, instances } = buildDefaultLayoutPayload(op.dashboardKind, typeMap);

        const { data: layout, error: insErr } = await supabase
          .from("dashboard_layouts")
          .insert({
            company_id: companyId,
            user_id: userId,
            name,
            dashboard_kind: op.dashboardKind,
            layout_json: layoutJson,
            version: 1,
          })
          .select("id, name, dashboard_kind, layout_json, version, created_at, updated_at")
          .single();
        if (insErr) throw insErr;

        const rows = instances.map((i) => ({
          id: i.id,
          layout_id: layout.id,
          widget_definition_id: i.widgetDefinitionId,
          widget_type: i.widgetType,
          config: i.config ?? {},
          is_visible: i.isVisible ?? true,
        }));
        if (rows.length > 0) {
          const { error: batchErr } = await supabase.from("dashboard_widget_instances").insert(rows);
          if (batchErr) throw batchErr;
        }

        await logDashboardAudit(supabase, companyId, userId, "layout.created", {
          dashboardKind: op.dashboardKind,
          layoutId: layout.id,
        });

        return new Response(
          JSON.stringify({
            data: {
              layout,
              instances: rows,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      case "layout.save": {
        const name = op.name ?? "Default";
        const layoutJson = op.layoutJson ?? {};
        const instances = Array.isArray(op.instances) ? op.instances : [];

        const { data: existing, error: findErr } = await supabase
          .from("dashboard_layouts")
          .select("id, version")
          .eq("company_id", companyId)
          .eq("user_id", userId)
          .eq("dashboard_kind", op.dashboardKind)
          .eq("name", name)
          .maybeSingle();
        if (findErr) throw findErr;

        let layoutId: string;
        if (existing?.id) {
          layoutId = existing.id;
          const nextVersion = (typeof existing.version === "number" ? existing.version : 1) + 1;
          const { error: upErr } = await supabase
            .from("dashboard_layouts")
            .update({
              layout_json: layoutJson,
              version: nextVersion,
              updated_at: new Date().toISOString(),
            })
            .eq("id", layoutId);
          if (upErr) throw upErr;

          await supabase.from("dashboard_widget_instances").delete().eq("layout_id", layoutId);
        } else {
          const { data: created, error: cErr } = await supabase
            .from("dashboard_layouts")
            .insert({
              company_id: companyId,
              user_id: userId,
              name,
              dashboard_kind: op.dashboardKind,
              layout_json: layoutJson,
              version: 1,
            })
            .select("id")
            .single();
          if (cErr) throw cErr;
          layoutId = created.id;
        }

        if (instances.length > 0) {
          const rows = instances.map((i) => ({
            id: i.id,
            layout_id: layoutId,
            widget_definition_id: i.widgetDefinitionId ?? null,
            widget_type: i.widgetType,
            config: i.config ?? {},
            is_visible: i.isVisible ?? true,
          }));
          const { error: insErr } = await supabase.from("dashboard_widget_instances").insert(rows);
          if (insErr) throw insErr;
        }

        const { data: layoutOut, error: loErr } = await supabase
          .from("dashboard_layouts")
          .select("id, name, dashboard_kind, layout_json, version, created_at, updated_at")
          .eq("id", layoutId)
          .single();
        if (loErr) throw loErr;

        const { data: instOut, error: ioErr } = await supabase
          .from("dashboard_widget_instances")
          .select(
            "id, layout_id, widget_definition_id, widget_type, config, is_visible, created_at, updated_at",
          )
          .eq("layout_id", layoutId);
        if (ioErr) throw ioErr;

        await logDashboardAudit(supabase, companyId, userId, "layout.saved", {
          dashboardKind: op.dashboardKind,
          layoutId,
        });

        return new Response(
          JSON.stringify({
            data: {
              layout: layoutOut,
              instances: Array.isArray(instOut) ? instOut : [],
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      case "export.schedules.create": {
        const { data, error } = await supabase
          .from("dashboard_export_schedules")
          .insert({
            company_id: companyId,
            user_id: userId,
            layout_id: op.layoutId ?? null,
            target_type: op.targetType,
            target_value: op.targetValue,
            cron_expression: op.cronExpression ?? "0 9 * * 1",
            status: "active",
          })
          .select("*")
          .single();
        if (error) throw error;
        await logDashboardAudit(supabase, companyId, userId, "export.schedule.created", {
          scheduleId: data.id,
        });
        return new Response(JSON.stringify({ data: { schedule: data } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "export.schedules.list": {
        const { data, error } = await supabase
          .from("dashboard_export_schedules")
          .select("*")
          .eq("company_id", companyId)
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return new Response(
          JSON.stringify({ data: { schedules: Array.isArray(data) ? data : [] } }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      case "export.schedule.get": {
        const { data, error } = await supabase
          .from("dashboard_export_schedules")
          .select("*")
          .eq("id", op.scheduleId)
          .eq("company_id", companyId)
          .eq("user_id", userId)
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ data: { schedule: data } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "export.schedule.trigger": {
        const { data: sched, error: sErr } = await supabase
          .from("dashboard_export_schedules")
          .select("*")
          .eq("id", op.scheduleId)
          .eq("company_id", companyId)
          .eq("user_id", userId)
          .maybeSingle();
        if (sErr) throw sErr;
        if (!sched) {
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: layoutRow } = sched.layout_id
          ? await supabase
              .from("dashboard_layouts")
              .select("id, layout_json, dashboard_kind, name")
              .eq("id", sched.layout_id)
              .maybeSingle()
          : { data: null };

        await supabase
          .from("dashboard_export_schedules")
          .update({ last_run_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", op.scheduleId);

        const exportPayload = {
          generatedAt: new Date().toISOString(),
          scheduleId: sched.id,
          targetType: sched.target_type,
          layout: layoutRow ?? null,
        };

        await logDashboardAudit(supabase, companyId, userId, "export.triggered", {
          scheduleId: sched.id,
        });

        return new Response(JSON.stringify({ data: { ok: true, exportPayload } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "widget.instance.patch": {
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (op.config !== undefined) patch.config = op.config;
        if (op.isVisible !== undefined) patch.is_visible = op.isVisible;
        const { data: inst, error: iErr } = await supabase
          .from("dashboard_widget_instances")
          .update(patch)
          .eq("id", op.instanceId)
          .select("id, config, is_visible")
          .single();
        if (iErr) throw iErr;
        await logDashboardAudit(supabase, companyId, userId, "widget.patched", {
          instanceId: op.instanceId,
        });
        return new Response(JSON.stringify({ data: { instance: inst } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "customDashboards.list": {
        await assertCustomDashboardsEnabled(supabase, companyId);
        const limit = typeof op.limit === "number" ? Math.max(1, Math.min(op.limit, 200)) : 80;
        const { data, error } = await supabase
          .from("custom_dashboards")
          .select(
            "id, company_id, creator_user_id, title, description, visibility_mode, shared_roles, integration_sources, latest_run_at, created_at, updated_at",
          )
          .eq("company_id", companyId)
          .order("updated_at", { ascending: false })
          .limit(limit);
        if (error) throw error;
        const dashboards = (Array.isArray(data) ? data : []) as CustomDashboardRow[];
        return new Response(JSON.stringify({ data: { dashboards } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "customDashboards.get": {
        await assertCustomDashboardsEnabled(supabase, companyId);
        const { data, error } = await supabase
          .from("custom_dashboards")
          .select("*")
          .eq("id", op.dashboardId)
          .eq("company_id", companyId)
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const dashboard = data as CustomDashboardRow;
        if (!canViewCustomDashboardRow(dashboard, userId, userRoles)) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: runsData, error: runsError } = await supabase
          .from("custom_dashboard_runs")
          .select("*")
          .eq("company_id", companyId)
          .eq("dashboard_id", op.dashboardId)
          .order("created_at", { ascending: false })
          .limit(25);
        if (runsError) throw runsError;
        const runs = (Array.isArray(runsData) ? runsData : []) as CustomDashboardRunRow[];
        return new Response(JSON.stringify({ data: { dashboard, runs } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "customDashboards.save": {
        await assertCustomDashboardsEnabled(supabase, companyId);
        const now = toIsoNow();
        const queryPlan = parseCustomQueryPlan(op.queryPlan ?? []);
        const snapshotData = sanitizeSnapshotValue(op.snapshotData ?? {}) as Record<string, unknown>;
        const planSources = queryPlan
          .map((step) => (typeof step.provider === "string" ? step.provider : ""))
          .filter((source) => source.length > 0);
        const integrationSources = normalizeIntegrationSources([...(op.sources ?? []), ...planSources]);
        const visibilityMode = op.visibilityMode ?? "roles";
        const sharedRoles = visibilityMode === "roles"
          ? normalizeRoleNames(op.sharedRoles ?? userRoles)
          : normalizeRoleNames(op.sharedRoles ?? []);

        if (op.dashboardId) {
          const { data: existing, error: existingErr } = await supabase
            .from("custom_dashboards")
            .select("id, creator_user_id")
            .eq("id", op.dashboardId)
            .eq("company_id", companyId)
            .maybeSingle();
          if (existingErr) throw existingErr;
          if (!existing) {
            return new Response(JSON.stringify({ error: "Not found" }), {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          if (existing.creator_user_id !== userId) {
            return new Response(JSON.stringify({ error: "Only the creator can overwrite this dashboard." }), {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          const { data: updated, error: updateErr } = await supabase
            .from("custom_dashboards")
            .update({
              title: op.title,
              description: op.description ?? null,
              code_tsx: op.codeTsx,
              query_plan: queryPlan,
              snapshot_data: snapshotData,
              visibility_mode: visibilityMode,
              shared_roles: sharedRoles,
              integration_sources: integrationSources,
              updated_at: now,
            })
            .eq("id", op.dashboardId)
            .eq("company_id", companyId)
            .select("*")
            .single();
          if (updateErr) throw updateErr;
          await logDashboardAudit(supabase, companyId, userId, "custom_dashboard.saved", {
            dashboardId: op.dashboardId,
            updated: true,
            visibilityMode,
            sharedRoles,
          });
          return new Response(JSON.stringify({ data: { dashboard: updated } }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: created, error: createErr } = await supabase
          .from("custom_dashboards")
          .insert({
            company_id: companyId,
            creator_user_id: userId,
            title: op.title,
            description: op.description ?? null,
            code_tsx: op.codeTsx,
            query_plan: queryPlan,
            snapshot_data: snapshotData,
            visibility_mode: visibilityMode,
            shared_roles: sharedRoles,
            integration_sources: integrationSources,
            latest_run_at: null,
            created_at: now,
            updated_at: now,
          })
          .select("*")
          .single();
        if (createErr) throw createErr;
        await logDashboardAudit(supabase, companyId, userId, "custom_dashboard.saved", {
          dashboardId: created.id,
          updated: false,
          visibilityMode,
          sharedRoles,
        });
        return new Response(JSON.stringify({ data: { dashboard: created } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "customDashboards.updateMeta": {
        await assertCustomDashboardsEnabled(supabase, companyId);
        const { data: existing, error: existingErr } = await supabase
          .from("custom_dashboards")
          .select("*")
          .eq("id", op.dashboardId)
          .eq("company_id", companyId)
          .maybeSingle();
        if (existingErr) throw existingErr;
        if (!existing) {
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const row = existing as CustomDashboardRow;
        if (row.creator_user_id !== userId) {
          return new Response(JSON.stringify({ error: "Only the creator can update sharing or metadata." }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const nextVisibility = op.visibilityMode ?? row.visibility_mode;
        const nextSharedRoles = nextVisibility === "roles"
          ? normalizeRoleNames(op.sharedRoles ?? row.shared_roles ?? [])
          : normalizeRoleNames(op.sharedRoles ?? []);

        const patch: Record<string, unknown> = { updated_at: toIsoNow() };
        if (op.title !== undefined) patch.title = op.title;
        if (op.description !== undefined) patch.description = op.description ?? null;
        if (op.visibilityMode !== undefined) patch.visibility_mode = nextVisibility;
        if (op.sharedRoles !== undefined || op.visibilityMode !== undefined) {
          patch.shared_roles = nextSharedRoles;
        }

        const { data: updated, error: updateErr } = await supabase
          .from("custom_dashboards")
          .update(patch)
          .eq("id", op.dashboardId)
          .eq("company_id", companyId)
          .select("*")
          .single();
        if (updateErr) throw updateErr;

        const sharingTouched = op.visibilityMode !== undefined || op.sharedRoles !== undefined;
        await logDashboardAudit(supabase, companyId, userId, sharingTouched ? "custom_dashboard.shared" : "custom_dashboard.meta_updated", {
          dashboardId: op.dashboardId,
          visibilityMode: sharingTouched ? nextVisibility : undefined,
          sharedRoles: sharingTouched ? nextSharedRoles : undefined,
        });

        return new Response(JSON.stringify({ data: { dashboard: updated } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "customDashboards.refreshData": {
        await assertCustomDashboardsEnabled(supabase, companyId);
        const { data: existing, error: existingErr } = await supabase
          .from("custom_dashboards")
          .select("*")
          .eq("id", op.dashboardId)
          .eq("company_id", companyId)
          .maybeSingle();
        if (existingErr) throw existingErr;
        if (!existing) {
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const dashboard = existing as CustomDashboardRow;
        if (!canViewCustomDashboardRow(dashboard, userId, userRoles)) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const queryPlan = parseCustomQueryPlan(dashboard.query_plan);
        if (queryPlan.length === 0) {
          return new Response(JSON.stringify({ error: "No query plan stored for this dashboard." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const started = Date.now();
        const runtimeSupabase = runtimeSupabaseForTools(supabase);
        const execution = await executeCustomDashboardQueryPlan({
          runtimeSupabase,
          companyId,
          userId,
          userRoles,
          queryPlan,
        });
        const now = toIsoNow();
        const status: "succeeded" | "failed" = execution.errors.length > 0 ? "failed" : "succeeded";
        const errorMessage = execution.errors.length > 0 ? execution.errors.slice(0, 8).join(" | ") : null;
        const executionMs = Date.now() - started;
        const snapshotWithStatus = {
          ...execution.snapshotData,
          status,
          errors: execution.errors,
          refreshedAt: now,
        };

        const { data: updated, error: updateErr } = await supabase
          .from("custom_dashboards")
          .update({
            snapshot_data: snapshotWithStatus,
            integration_sources: execution.integrationSources,
            latest_run_at: now,
            updated_at: now,
          })
          .eq("id", op.dashboardId)
          .eq("company_id", companyId)
          .select("*")
          .single();
        if (updateErr) throw updateErr;

        const run = await insertCustomDashboardRun(supabase, {
          companyId,
          dashboardId: op.dashboardId,
          userId,
          triggerType: "refresh",
          status,
          queryPlan,
          snapshot: snapshotWithStatus,
          integrationSources: execution.integrationSources,
          errorMessage,
          executionMs,
        });

        await logDashboardAudit(supabase, companyId, userId, "custom_dashboard.refreshed", {
          dashboardId: op.dashboardId,
          status,
          errorCount: execution.errors.length,
          executionMs,
          runId: run?.id ?? null,
        });

        return new Response(JSON.stringify({
          data: {
            dashboard: updated,
            run,
            status,
            errors: execution.errors,
          },
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "customDashboards.delete": {
        await assertCustomDashboardsEnabled(supabase, companyId);
        const { data: existing, error: existingErr } = await supabase
          .from("custom_dashboards")
          .select("id, creator_user_id")
          .eq("id", op.dashboardId)
          .eq("company_id", companyId)
          .maybeSingle();
        if (existingErr) throw existingErr;
        if (!existing) {
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (existing.creator_user_id !== userId) {
          return new Response(JSON.stringify({ error: "Only the creator can delete this dashboard." }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error: deleteErr } = await supabase
          .from("custom_dashboards")
          .delete()
          .eq("id", op.dashboardId)
          .eq("company_id", companyId);
        if (deleteErr) throw deleteErr;
        await logDashboardAudit(supabase, companyId, userId, "custom_dashboard.deleted", {
          dashboardId: op.dashboardId,
        });
        return new Response(JSON.stringify({ data: { ok: true } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      default: {
        return new Response(JSON.stringify({ error: "Unsupported op" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
