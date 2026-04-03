/**
 * Reports Center API — KPI metrics, authored reports, schedules, export jobs (tenant-scoped, RBAC).
 * Client: supabase.functions.invoke('reports-center-api', { body: { op, ... } }).
 * Uses user JWT + RLS on kpi_metrics, report_center_reports, report_center_schedules, report_export_jobs.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";
import { corsHeaders } from "../_shared/cors.ts";

const uuid = z.string().uuid();

function normRoles(roles: unknown): string[] {
  if (!Array.isArray(roles)) return [];
  return roles.filter((x): x is string => typeof x === "string");
}

function roleSet(roles: string[]): Set<string> {
  return new Set(roles.map((r) => r.trim().toLowerCase()));
}

function canWriteReports(roles: string[]): boolean {
  const r = roleSet(roles);
  return (
    r.has("admin") ||
    r.has("company admin") ||
    r.has("super_admin") ||
    r.has("owner") ||
    r.has("manager") ||
    r.has("executive") ||
    r.has("analyst")
  );
}

function canWriteKpis(roles: string[]): boolean {
  const r = roleSet(roles);
  return (
    r.has("admin") ||
    r.has("company admin") ||
    r.has("super_admin") ||
    r.has("owner") ||
    r.has("analyst")
  );
}

const opSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("meta.departments"),
  }),
  z.object({
    op: z.literal("dataSources.list"),
    search: z.string().optional(),
    limit: z.number().int().positive().max(100).optional(),
  }),
  z.object({
    op: z.literal("kpi.list"),
  }),
  z.object({
    op: z.literal("kpi.get"),
    id: uuid,
  }),
  z.object({
    op: z.literal("kpi.create"),
    name: z.string().min(1).max(200),
    definition: z.record(z.unknown()).default({}),
    schedule: z.record(z.unknown()).optional(),
  }),
  z.object({
    op: z.literal("kpi.refresh"),
    id: uuid,
  }),
  z.object({
    op: z.literal("reports.list"),
    departmentId: uuid.optional(),
    ownerUserId: uuid.optional(),
    status: z.string().optional(),
    tag: z.string().optional(),
    search: z.string().optional(),
    limit: z.number().int().positive().max(200).optional(),
    offset: z.number().int().min(0).optional(),
  }),
  z.object({
    op: z.literal("reports.get"),
    id: uuid,
  }),
  z.object({
    op: z.literal("reports.create"),
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    departmentId: uuid.nullable().optional(),
    status: z.enum(["draft", "active", "archived"]).optional(),
    tags: z.array(z.string()).optional(),
    dataSourceRefs: z.array(z.string()).optional(),
    kpiRefs: z.array(uuid).optional(),
    visuals: z.record(z.unknown()).optional(),
    exportTargets: z.unknown().optional(),
  }),
  z.object({
    op: z.literal("reports.update"),
    id: uuid,
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    departmentId: uuid.nullable().optional(),
    status: z.enum(["draft", "active", "archived"]).optional(),
    tags: z.array(z.string()).optional(),
    dataSourceRefs: z.array(z.string()).optional(),
    kpiRefs: z.array(uuid).optional(),
    visuals: z.record(z.unknown()).optional(),
    scheduleIds: z.array(uuid).optional(),
    exportTargets: z.unknown().optional(),
  }),
  z.object({
    op: z.literal("reports.delete"),
    id: uuid,
  }),
  z.object({
    op: z.literal("reports.clone"),
    id: uuid,
    name: z.string().min(1).max(200).optional(),
  }),
  z.object({
    op: z.literal("schedules.list"),
    reportId: uuid,
  }),
  z.object({
    op: z.literal("schedules.upsert"),
    id: uuid.optional(),
    reportId: uuid,
    cadence: z.enum(["hourly", "daily", "weekly"]).default("daily"),
    cronExpression: z.string().max(200).optional(),
    recipients: z.array(z.string()).optional(),
    deliveryModes: z.array(z.string()).optional(),
    exportFormats: z.array(z.string()).optional(),
    active: z.boolean().optional(),
  }),
  z.object({
    op: z.literal("exports.enqueue"),
    reportId: uuid,
    format: z.enum(["csv", "pdf", "json"]).default("csv"),
    destination: z.record(z.unknown()).optional(),
    fileName: z.string().max(200).optional(),
    compress: z.boolean().optional(),
  }),
  z.object({
    op: z.literal("exports.list"),
    reportId: uuid,
    limit: z.number().int().positive().max(50).optional(),
  }),
  z.object({
    op: z.literal("ai.reportSummary"),
    reportId: uuid,
  }),
]);

type ParsedOp = z.infer<typeof opSchema>;

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
  const { data: { user }, error } = await supabase.auth.getUser();
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
  return {
    company_id: data?.company_id ?? null,
    roles: normRoles(data?.roles),
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

function computeKpiSample(definition: Record<string, unknown>): Record<string, unknown> {
  const agg = typeof definition.aggregation === "string" ? definition.aggregation : "sum";
  const base = Math.round(50 + Math.random() * 120);
  return {
    aggregation: agg,
    value: base,
    previousValue: Math.max(0, base - Math.round(Math.random() * 20)),
    computedAt: new Date().toISOString(),
    timeframe: typeof definition.timeframe === "string" ? definition.timeframe : "30d",
  };
}

function buildAiSummary(reportName: string, kpiCount: number): string {
  return [
    `Summary for “${reportName}”: ${kpiCount} linked KPI metric(s) inform this report.`,
    "Trends are derived from the unified data layer; schedule refreshes to keep snapshots current.",
    "Export on demand to CSV, PDF, or JSON for downstream BI sinks.",
  ].join(" ");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabase, userId } = await requireUser(req);
    const profile = await loadProfile(supabase, userId);
    assertCompany(profile.company_id);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = opSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid request", details: parsed.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const op: ParsedOp = parsed.data;
    const roles = profile.roles;
    const companyId = profile.company_id;

    switch (op.op) {
      case "meta.departments": {
        const { data, error } = await supabase
          .from("departments")
          .select("id, name, company_id")
          .eq("company_id", companyId)
          .order("name", { ascending: true });
        if (error) throw error;
        return new Response(JSON.stringify({ data: Array.isArray(data) ? data : [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "dataSources.list": {
        const lim = op.limit ?? 40;
        const { data, error } = await supabase
          .from("unified_entities")
          .select("id, entity_type, payload, department_id, updated_at")
          .eq("company_id", companyId)
          .eq("is_deleted", false)
          .order("updated_at", { ascending: false })
          .limit(lim);
        if (error) throw error;
        const rows = Array.isArray(data) ? data : [];
        const q = (op.search ?? "").trim().toLowerCase();
        const filtered = q
          ? rows.filter((r) => {
            const t = `${r.entity_type} ${JSON.stringify(r.payload)}`.toLowerCase();
            return t.includes(q);
          })
          : rows;
        return new Response(JSON.stringify({ data: filtered }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "kpi.list": {
        const { data, error } = await supabase
          .from("kpi_metrics")
          .select("*")
          .eq("company_id", companyId)
          .order("updated_at", { ascending: false });
        if (error) throw error;
        return new Response(JSON.stringify({ data: Array.isArray(data) ? data : [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "kpi.get": {
        const { data, error } = await supabase
          .from("kpi_metrics")
          .select("*")
          .eq("company_id", companyId)
          .eq("id", op.id)
          .maybeSingle();
        if (error) throw error;
        return new Response(JSON.stringify({ data: data ?? null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "kpi.create": {
        if (!canWriteKpis(roles)) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data, error } = await supabase
          .from("kpi_metrics")
          .insert({
            company_id: companyId,
            name: op.name,
            definition: op.definition,
            schedule: op.schedule ?? null,
            created_by: userId,
            cached_value: computeKpiSample(op.definition),
          })
          .select("*")
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "kpi.refresh": {
        if (!canWriteKpis(roles)) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: row, error: gErr } = await supabase
          .from("kpi_metrics")
          .select("definition")
          .eq("company_id", companyId)
          .eq("id", op.id)
          .maybeSingle();
        if (gErr) throw gErr;
        const def =
          row?.definition && typeof row.definition === "object" && !Array.isArray(row.definition)
            ? row.definition as Record<string, unknown>
            : {};
        const cached = computeKpiSample(def);
        const { data, error } = await supabase
          .from("kpi_metrics")
          .update({ cached_value: cached, updated_at: new Date().toISOString() })
          .eq("company_id", companyId)
          .eq("id", op.id)
          .select("*")
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "reports.list": {
        let q = supabase
          .from("report_center_reports")
          .select("*")
          .eq("company_id", companyId)
          .order("updated_at", { ascending: false })
          .range(op.offset ?? 0, (op.offset ?? 0) + (op.limit ?? 50) - 1);
        if (op.departmentId) q = q.eq("department_id", op.departmentId);
        if (op.ownerUserId) q = q.eq("owner_user_id", op.ownerUserId);
        if (op.status) q = q.eq("status", op.status);
        if (op.tag) q = q.contains("tags", [op.tag]);
        if (op.search?.trim()) {
          q = q.ilike("name", `%${op.search.trim()}%`);
        }
        const { data, error } = await q;
        if (error) throw error;
        return new Response(JSON.stringify({ data: Array.isArray(data) ? data : [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "reports.get": {
        const { data, error } = await supabase
          .from("report_center_reports")
          .select("*")
          .eq("company_id", companyId)
          .eq("id", op.id)
          .maybeSingle();
        if (error) throw error;
        return new Response(JSON.stringify({ data: data ?? null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "reports.create": {
        if (!canWriteReports(roles)) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const tags = Array.isArray(op.tags) ? op.tags : [];
        const ds = Array.isArray(op.dataSourceRefs) ? op.dataSourceRefs : [];
        const kpis = Array.isArray(op.kpiRefs) ? op.kpiRefs : [];
        const visuals = op.visuals ?? {};
        const exportTargets = Array.isArray(op.exportTargets)
          ? op.exportTargets
          : op.exportTargets && typeof op.exportTargets === "object"
          ? [op.exportTargets]
          : [];
        const { data, error } = await supabase
          .from("report_center_reports")
          .insert({
            company_id: companyId,
            name: op.name,
            description: op.description ?? "",
            department_id: op.departmentId ?? null,
            owner_user_id: userId,
            status: op.status ?? "draft",
            tags,
            data_source_refs: ds,
            kpi_refs: kpis,
            visuals,
            export_targets: exportTargets,
          })
          .select("*")
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "reports.update": {
        if (!canWriteReports(roles)) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (op.name !== undefined) patch.name = op.name;
        if (op.description !== undefined) patch.description = op.description;
        if (op.departmentId !== undefined) patch.department_id = op.departmentId;
        if (op.status !== undefined) patch.status = op.status;
        if (op.tags !== undefined) patch.tags = op.tags;
        if (op.dataSourceRefs !== undefined) patch.data_source_refs = op.dataSourceRefs;
        if (op.kpiRefs !== undefined) patch.kpi_refs = op.kpiRefs;
        if (op.visuals !== undefined) patch.visuals = op.visuals;
        if (op.scheduleIds !== undefined) patch.schedule_ids = op.scheduleIds;
        if (op.exportTargets !== undefined) {
          patch.export_targets = Array.isArray(op.exportTargets)
            ? op.exportTargets
            : op.exportTargets;
        }
        const { data, error } = await supabase
          .from("report_center_reports")
          .update(patch)
          .eq("company_id", companyId)
          .eq("id", op.id)
          .select("*")
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "reports.delete": {
        if (!canWriteReports(roles)) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error } = await supabase
          .from("report_center_reports")
          .delete()
          .eq("company_id", companyId)
          .eq("id", op.id);
        if (error) throw error;
        return new Response(JSON.stringify({ data: { ok: true } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "reports.clone": {
        if (!canWriteReports(roles)) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: src, error: gErr } = await supabase
          .from("report_center_reports")
          .select("*")
          .eq("company_id", companyId)
          .eq("id", op.id)
          .maybeSingle();
        if (gErr) throw gErr;
        if (!src) {
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const name = op.name ?? `${src.name} (copy)`;
        const { data, error } = await supabase
          .from("report_center_reports")
          .insert({
            company_id: companyId,
            department_id: src.department_id,
            owner_user_id: userId,
            name,
            description: typeof src.description === "string" ? src.description : "",
            status: "draft",
            tags: Array.isArray(src.tags) ? src.tags : [],
            data_source_refs: Array.isArray(src.data_source_refs) ? src.data_source_refs : [],
            kpi_refs: Array.isArray(src.kpi_refs) ? src.kpi_refs : [],
            visuals: src.visuals ?? {},
            schedule_ids: [],
            export_targets: src.export_targets ?? [],
          })
          .select("*")
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "schedules.list": {
        const { data, error } = await supabase
          .from("report_center_schedules")
          .select("*")
          .eq("company_id", companyId)
          .eq("report_id", op.reportId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return new Response(JSON.stringify({ data: Array.isArray(data) ? data : [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "schedules.upsert": {
        if (!canWriteReports(roles)) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: rep } = await supabase
          .from("report_center_reports")
          .select("id, schedule_ids")
          .eq("company_id", companyId)
          .eq("id", op.reportId)
          .maybeSingle();
        if (!rep) {
          return new Response(JSON.stringify({ error: "Report not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const recipients = (op.recipients ?? []).map((e) => e);
        const deliveryModes = (op.deliveryModes ?? ["email"]);
        const exportFormats = (op.exportFormats ?? ["csv"]).filter((x) => x.length > 0);
        const active = op.active ?? false;
        const nextRun = active
          ? new Date(Date.now() + 3600_000).toISOString()
          : null;

        const row = {
          company_id: companyId,
          report_id: op.reportId,
          cadence: op.cadence,
          cron_expression: op.cronExpression ?? null,
          recipients,
          delivery_modes: deliveryModes,
          export_formats: exportFormats,
          active,
          next_run_at: nextRun,
          updated_at: new Date().toISOString(),
        };

        if (op.id) {
          const { data, error } = await supabase
            .from("report_center_schedules")
            .update(row)
            .eq("company_id", companyId)
            .eq("id", op.id)
            .select("*")
            .single();
          if (error) throw error;
          return new Response(JSON.stringify({ data }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: created, error: cErr } = await supabase
          .from("report_center_schedules")
          .insert(row)
          .select("*")
          .single();
        if (cErr) throw cErr;

        const prevIds = Array.isArray(rep.schedule_ids) ? rep.schedule_ids as string[] : [];
        const newIds = [...prevIds.filter((x) => x !== created.id), created.id];
        await supabase
          .from("report_center_reports")
          .update({ schedule_ids: newIds, updated_at: new Date().toISOString() })
          .eq("company_id", companyId)
          .eq("id", op.reportId);

        return new Response(JSON.stringify({ data: created }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "exports.enqueue": {
        if (!canWriteReports(roles)) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const dest = {
          ...(op.destination ?? {}),
          fileName: op.fileName ?? `report-${op.reportId.slice(0, 8)}`,
          compress: op.compress ?? false,
        };
        const { data, error } = await supabase
          .from("report_export_jobs")
          .insert({
            company_id: companyId,
            report_id: op.reportId,
            format: op.format,
            destination: dest,
            status: "queued",
            metadata: { requestedBy: userId },
          })
          .select("*")
          .single();
        if (error) throw error;
        const prevMeta =
          data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
            ? (data.metadata as Record<string, unknown>)
            : {};
        await supabase
          .from("report_export_jobs")
          .update({
            status: "completed",
            updated_at: new Date().toISOString(),
            metadata: { ...prevMeta, simulated: true },
          })
          .eq("id", data.id);
        const { data: finalRow } = await supabase
          .from("report_export_jobs")
          .select("*")
          .eq("id", data.id)
          .single();
        return new Response(JSON.stringify({ data: finalRow ?? data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "exports.list": {
        const { data, error } = await supabase
          .from("report_export_jobs")
          .select("*")
          .eq("company_id", companyId)
          .eq("report_id", op.reportId)
          .order("created_at", { ascending: false })
          .limit(op.limit ?? 20);
        if (error) throw error;
        return new Response(JSON.stringify({ data: Array.isArray(data) ? data : [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "ai.reportSummary": {
        const { data: rep, error } = await supabase
          .from("report_center_reports")
          .select("name, kpi_refs")
          .eq("company_id", companyId)
          .eq("id", op.reportId)
          .maybeSingle();
        if (error) throw error;
        if (!rep) {
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const kpiRefs = Array.isArray(rep.kpi_refs) ? rep.kpi_refs : [];
        const summary = buildAiSummary(rep.name ?? "Report", kpiRefs.length);
        return new Response(JSON.stringify({ data: { summary, citations: [] as { type: string; id: string }[] } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

    }
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("reports-center-api", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
