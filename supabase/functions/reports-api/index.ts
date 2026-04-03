/**
 * Reports Center API — KPI definitions, reports CRUD, schedules, export jobs.
 * Client: supabase.functions.invoke('reports-api', { body: { op, ... } }).
 * Secrets: SUPABASE_URL, SUPABASE_ANON_KEY (user JWT in Authorization).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";
import { corsHeaders } from "../_shared/cors.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function requireUser(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
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

function canMutate(roles: string[]): boolean {
  const r = roles.map((x) => String(x).toLowerCase());
  return r.some((x) =>
    ["admin", "owner", "manager", "builder", "super_admin", "team_member", "executive", "company_admin"]
      .includes(x)
  );
}

function isReadOnlyOnly(roles: string[]): boolean {
  const r = roles.map((x) => String(x).toLowerCase());
  const read = r.includes("read_only") || r.includes("readonly");
  return read && !canMutate(roles);
}

const listFiltersSchema = z.object({
  departmentId: z.string().uuid().optional(),
  ownerUserId: z.string().uuid().optional(),
  status: z.string().max(80).optional(),
  tag: z.string().max(120).optional(),
  search: z.string().max(200).optional(),
});

const opSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("reports.list"), filters: listFiltersSchema.optional() }),
  z.object({ op: z.literal("reports.get"), id: z.string().uuid() }),
  z.object({
    op: z.literal("reports.create"),
    name: z.string().min(1).max(240),
    description: z.string().max(4000).optional(),
    departmentId: z.string().uuid().nullable().optional(),
    dataSourceRefs: z.array(z.string().max(200)).optional(),
    kpiRefs: z.array(z.string().uuid()).optional(),
    visuals: z.record(z.unknown()).optional(),
    exportTargets: z.unknown().optional(),
    tags: z.array(z.string().max(80)).optional(),
    status: z.string().max(80).optional(),
  }),
  z.object({
    op: z.literal("reports.update"),
    id: z.string().uuid(),
    name: z.string().min(1).max(240).optional(),
    description: z.string().max(4000).optional(),
    departmentId: z.string().uuid().nullable().optional(),
    dataSourceRefs: z.array(z.string().max(200)).optional(),
    kpiRefs: z.array(z.string().uuid()).optional(),
    visuals: z.record(z.unknown()).optional(),
    exportTargets: z.unknown().optional(),
    tags: z.array(z.string().max(80)).optional(),
    status: z.string().max(80).optional(),
  }),
  z.object({ op: z.literal("reports.delete"), id: z.string().uuid() }),
  z.object({
    op: z.literal("reports.schedule"),
    reportId: z.string().uuid(),
    scheduleId: z.string().uuid().optional(),
    cadence: z.enum(["hourly", "daily", "weekly"]).optional(),
    cronExpression: z.string().max(200).optional(),
    recipients: z.array(z.string().email().or(z.string().min(1))).optional(),
    deliveryModes: z.array(z.string().max(80)).optional(),
    exportFormat: z.enum(["csv", "pdf", "json"]).optional(),
    isActive: z.boolean().optional(),
  }),
  z.object({
    op: z.literal("reports.export"),
    reportId: z.string().uuid(),
    format: z.enum(["csv", "pdf", "json"]).optional(),
    destination: z.record(z.unknown()).optional(),
  }),
  z.object({ op: z.literal("reports.schedules.list"), reportId: z.string().uuid() }),
  z.object({ op: z.literal("reports.exports.list"), reportId: z.string().uuid() }),
  z.object({ op: z.literal("kpis.list") }),
  z.object({
    op: z.literal("kpis.create"),
    name: z.string().min(1).max(240),
    definition: z.record(z.unknown()),
    schedule: z.record(z.unknown()).optional(),
  }),
  z.object({ op: z.literal("kpis.get"), id: z.string().uuid() }),
  z.object({ op: z.literal("kpis.refresh"), id: z.string().uuid() }),
]);

type Op = z.infer<typeof opSchema>;

async function handleOp(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
  roles: string[],
  body: Op,
) {
  const readBlocked = isReadOnlyOnly(roles) && body.op !== "reports.list" && body.op !== "reports.get" &&
    body.op !== "kpis.list" && body.op !== "kpis.get" &&
    body.op !== "reports.schedules.list" && body.op !== "reports.exports.list";
  if (readBlocked) {
    return json({ error: "Forbidden" }, 403);
  }

  switch (body.op) {
    case "reports.list": {
      const f = body.filters ?? {};
      let q = supabase
        .from("reports_center_reports")
        .select("*")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      if (f.departmentId) q = q.eq("department_id", f.departmentId);
      if (f.ownerUserId) q = q.eq("owner_user_id", f.ownerUserId);
      if (f.status) q = q.eq("status", f.status);
      if (f.tag) q = q.contains("tags", [f.tag]);
      if (f.search?.trim()) {
        q = q.ilike("name", `%${f.search.trim()}%`);
      }
      const { data, error } = await q;
      if (error) return json({ error: error.message }, 500);
      return json({ data: Array.isArray(data) ? data : [] });
    }
    case "reports.get": {
      const { data, error } = await supabase
        .from("reports_center_reports")
        .select("*")
        .eq("company_id", companyId)
        .eq("id", body.id)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ error: "Not found" }, 404);
      return json({ data });
    }
    case "reports.create": {
      if (!canMutate(roles)) return json({ error: "Forbidden" }, 403);
      const now = new Date().toISOString();
      const row = {
        company_id: companyId,
        owner_user_id: userId,
        name: body.name,
        description: body.description ?? "",
        department_id: body.departmentId ?? null,
        data_source_refs: body.dataSourceRefs ?? [],
        kpi_refs: body.kpiRefs ?? [],
        visuals: body.visuals ?? {},
        export_targets: body.exportTargets ?? [],
        tags: body.tags ?? [],
        status: body.status ?? "draft",
        schedule_ids: [],
        updated_at: now,
      };
      const { data, error } = await supabase
        .from("reports_center_reports")
        .insert(row)
        .select("*")
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ data });
    }
    case "reports.update": {
      if (!canMutate(roles)) return json({ error: "Forbidden" }, 403);
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.name !== undefined) patch.name = body.name;
      if (body.description !== undefined) patch.description = body.description;
      if (body.departmentId !== undefined) patch.department_id = body.departmentId;
      if (body.dataSourceRefs !== undefined) patch.data_source_refs = body.dataSourceRefs;
      if (body.kpiRefs !== undefined) patch.kpi_refs = body.kpiRefs;
      if (body.visuals !== undefined) patch.visuals = body.visuals;
      if (body.exportTargets !== undefined) patch.export_targets = body.exportTargets;
      if (body.tags !== undefined) patch.tags = body.tags;
      if (body.status !== undefined) patch.status = body.status;
      const { data, error } = await supabase
        .from("reports_center_reports")
        .update(patch)
        .eq("company_id", companyId)
        .eq("id", body.id)
        .is("deleted_at", null)
        .select("*")
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ error: "Not found" }, 404);
      return json({ data });
    }
    case "reports.delete": {
      if (!canMutate(roles)) return json({ error: "Forbidden" }, 403);
      const { data, error } = await supabase
        .from("reports_center_reports")
        .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("company_id", companyId)
        .eq("id", body.id)
        .is("deleted_at", null)
        .select("id")
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ error: "Not found" }, 404);
      return json({ data: { ok: true } });
    }
    case "reports.schedule": {
      if (!canMutate(roles)) return json({ error: "Forbidden" }, 403);
      const rep = await supabase
        .from("reports_center_reports")
        .select("id, schedule_ids")
        .eq("company_id", companyId)
        .eq("id", body.reportId)
        .is("deleted_at", null)
        .maybeSingle();
      if (rep.error) return json({ error: rep.error.message }, 500);
      if (!rep.data) return json({ error: "Report not found" }, 404);

      const cadence = body.cadence ?? "daily";
      const exportFormat = body.exportFormat ?? "pdf";
      const recipients = Array.isArray(body.recipients) ? body.recipients : [];
      const deliveryModes = Array.isArray(body.deliveryModes) ? body.deliveryModes : ["email"];
      const isActive = body.isActive ?? false;

      const schedulePayload = {
        company_id: companyId,
        report_id: body.reportId,
        cadence,
        cron_expression: body.cronExpression ?? null,
        recipients,
        delivery_modes: deliveryModes,
        export_format: exportFormat,
        is_active: isActive,
        next_run_at: isActive ? new Date(Date.now() + 3600_000).toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      let scheduleId = body.scheduleId;
      if (scheduleId) {
        const upd = await supabase
          .from("reports_center_schedules")
          .update(schedulePayload)
          .eq("company_id", companyId)
          .eq("id", scheduleId)
          .eq("report_id", body.reportId)
          .select("*")
          .maybeSingle();
        if (upd.error) return json({ error: upd.error.message }, 500);
        if (!upd.data) return json({ error: "Schedule not found" }, 404);
        return json({ data: upd.data });
      }

      const ins = await supabase
        .from("reports_center_schedules")
        .insert({ ...schedulePayload, created_at: new Date().toISOString() })
        .select("*")
        .single();
      if (ins.error) return json({ error: ins.error.message }, 500);
      const newId = ins.data?.id;
      const prev = Array.isArray(rep.data.schedule_ids) ? rep.data.schedule_ids as string[] : [];
      if (newId && !prev.includes(newId)) {
        await supabase
          .from("reports_center_reports")
          .update({
            schedule_ids: [...prev, newId],
            updated_at: new Date().toISOString(),
          })
          .eq("id", body.reportId)
          .eq("company_id", companyId);
      }
      return json({ data: ins.data });
    }
    case "reports.schedules.list": {
      const { data, error } = await supabase
        .from("reports_center_schedules")
        .select("*")
        .eq("company_id", companyId)
        .eq("report_id", body.reportId)
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 500);
      return json({ data: Array.isArray(data) ? data : [] });
    }
    case "reports.exports.list": {
      const { data, error } = await supabase
        .from("reports_center_export_jobs")
        .select("*")
        .eq("company_id", companyId)
        .eq("report_id", body.reportId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return json({ error: error.message }, 500);
      return json({ data: Array.isArray(data) ? data : [] });
    }
    case "reports.export": {
      if (!canMutate(roles)) return json({ error: "Forbidden" }, 403);
      const r = await supabase
        .from("reports_center_reports")
        .select("id")
        .eq("company_id", companyId)
        .eq("id", body.reportId)
        .is("deleted_at", null)
        .maybeSingle();
      if (r.error) return json({ error: r.error.message }, 500);
      if (!r.data) return json({ error: "Report not found" }, 404);
      const dest = body.destination && typeof body.destination === "object" ? body.destination : {};
      const fmt = body.format ?? "csv";
      const { data, error } = await supabase
        .from("reports_center_export_jobs")
        .insert({
          company_id: companyId,
          report_id: body.reportId,
          format: fmt,
          destination: dest,
          status: "queued",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("*")
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ data });
    }
    case "kpis.list": {
      const { data, error } = await supabase
        .from("kpi_metric_definitions")
        .select("*")
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false });
      if (error) return json({ error: error.message }, 500);
      return json({ data: Array.isArray(data) ? data : [] });
    }
    case "kpis.get": {
      const { data, error } = await supabase
        .from("kpi_metric_definitions")
        .select("*")
        .eq("company_id", companyId)
        .eq("id", body.id)
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ error: "Not found" }, 404);
      return json({ data });
    }
    case "kpis.create": {
      if (!canMutate(roles)) return json({ error: "Forbidden" }, 403);
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("kpi_metric_definitions")
        .insert({
          company_id: companyId,
          name: body.name,
          definition: body.definition,
          schedule: body.schedule ?? null,
          updated_at: now,
        })
        .select("*")
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ data });
    }
    case "kpis.refresh": {
      if (!canMutate(roles)) return json({ error: "Forbidden" }, 403);
      const computedAt = new Date().toISOString();
      const { data: existing, error: e1 } = await supabase
        .from("kpi_metric_definitions")
        .select("definition")
        .eq("company_id", companyId)
        .eq("id", body.id)
        .maybeSingle();
      if (e1) return json({ error: e1.message }, 500);
      if (!existing) return json({ error: "Not found" }, 404);
      const cached = {
        value: Math.round(50 + Math.random() * 50),
        unit: "index",
        computedAt,
        source: "reports-api.refresh",
      };
      const { data, error } = await supabase
        .from("kpi_metric_definitions")
        .update({ cached_value: cached, updated_at: computedAt })
        .eq("company_id", companyId)
        .eq("id", body.id)
        .select("*")
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      return json({ data });
    }
    default:
      return json({ error: "Unknown op" }, 400);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabase, userId } = await requireUser(req);
    const { company_id, roles } = await loadProfile(supabase, userId);
    assertCompany(company_id);

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

    return await handleOp(supabase, userId, company_id, roles, parsed.data);
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    return json({ error: msg }, 500);
  }
});
