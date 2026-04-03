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

function normalizeRoles(roles: string[] | null | undefined): string[] {
  const r = Array.isArray(roles) ? roles : [];
  return r.map((x) => String(x).toLowerCase());
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
  const roles = Array.isArray(data?.roles) ? (data!.roles as string[]) : [];
  return { company_id: data?.company_id ?? null, roles };
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
