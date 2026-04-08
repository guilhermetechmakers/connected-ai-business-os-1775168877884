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
const REPORT_EXPORT_BUCKET = "report-exports";
const REPORT_EXPORT_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

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
    r.has("company_admin") ||
    r.has("super_admin") ||
    r.has("owner") ||
    r.has("manager") ||
    r.has("executive") ||
    r.has("analyst") ||
    r.has("team_member") ||
    r.has("builder")
  );
}

function canWriteKpis(roles: string[]): boolean {
  const r = roleSet(roles);
  return (
    r.has("admin") ||
    r.has("company admin") ||
    r.has("company_admin") ||
    r.has("super_admin") ||
    r.has("owner") ||
    r.has("analyst") ||
    r.has("manager") ||
    r.has("builder")
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

function sanitizeFileName(input: string): string {
  const trimmed = input.trim();
  const safe = trimmed
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return safe.length > 0 ? safe.slice(0, 180) : "report-export";
}

function escapePdfText(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function buildSimplePdf(lines: string[]): Uint8Array {
  const safeLines = lines
    .filter((line) => typeof line === "string" && line.trim().length > 0)
    .slice(0, 38);

  const streamContent = safeLines
    .map((line, index) => {
      const y = 770 - index * 18;
      return `BT /F1 12 Tf 40 ${y} Td (${escapePdfText(line.slice(0, 160))}) Tj ET`;
    })
    .join("\n");

  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${streamContent.length} >> stream\n${streamContent}\nendstream endobj`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

function encodeCsvCell(value: unknown): string {
  const raw = String(value ?? "");
  if (/[",\n]/.test(raw)) {
    return `"${raw.replace(/"/g, "\"\"")}"`;
  }
  return raw;
}

function buildCsv(rows: Array<[string, unknown]>): string {
  const lines = ["field,value"];
  for (const [field, value] of rows) {
    lines.push(`${encodeCsvCell(field)},${encodeCsvCell(value)}`);
  }
  return `${lines.join("\n")}\n`;
}

function resolveExportFileName(
  requested: string | undefined,
  reportName: string,
  format: "csv" | "pdf" | "json",
): string {
  const ext = format === "pdf" ? "pdf" : format === "json" ? "json" : "csv";
  const fallbackBase = sanitizeFileName(reportName || "report");
  const raw = requested?.trim() ? requested.trim() : `${fallbackBase}.${ext}`;
  const sanitized = sanitizeFileName(raw);
  return sanitized.toLowerCase().endsWith(`.${ext}`) ? sanitized : `${sanitized}.${ext}`;
}

function buildExportContent(params: {
  report: Record<string, unknown>;
  format: "csv" | "pdf" | "json";
  generatedAt: string;
  requestedBy: string;
}): { mimeType: string; bytes: Uint8Array } {
  const reportName = String(params.report.name ?? "Untitled report");
  const reportDescription = String(params.report.description ?? "");
  const reportStatus = String(params.report.status ?? "draft");
  const updatedAt = String(params.report.updated_at ?? params.generatedAt);
  const tags = Array.isArray(params.report.tags) ? params.report.tags : [];
  const sourceRefs = Array.isArray(params.report.data_source_refs)
    ? params.report.data_source_refs
    : [];
  const kpiRefs = Array.isArray(params.report.kpi_refs) ? params.report.kpi_refs : [];

  if (params.format === "pdf") {
    const lines = [
      `Report: ${reportName}`,
      `Status: ${reportStatus}`,
      `Generated at: ${params.generatedAt}`,
      `Generated by: ${params.requestedBy}`,
      `Updated at: ${updatedAt}`,
      "",
      "Description:",
      reportDescription || "(no description)",
      "",
      `Tags: ${tags.join(", ") || "(none)"}`,
      `Data sources: ${sourceRefs.join(", ") || "(none)"}`,
      `KPI refs: ${kpiRefs.join(", ") || "(none)"}`,
    ];
    return {
      mimeType: "application/pdf",
      bytes: buildSimplePdf(lines),
    };
  }

  if (params.format === "json") {
    const payload = {
      report: {
        id: params.report.id ?? null,
        name: reportName,
        description: reportDescription,
        status: reportStatus,
        updatedAt,
        tags,
        dataSourceRefs: sourceRefs,
        kpiRefs,
      },
      generatedAt: params.generatedAt,
      generatedBy: params.requestedBy,
    };
    return {
      mimeType: "application/json",
      bytes: new TextEncoder().encode(`${JSON.stringify(payload, null, 2)}\n`),
    };
  }

  const csv = buildCsv([
    ["report_id", params.report.id ?? ""],
    ["name", reportName],
    ["description", reportDescription],
    ["status", reportStatus],
    ["updated_at", updatedAt],
    ["generated_at", params.generatedAt],
    ["generated_by", params.requestedBy],
    ["tags", tags.join("|")],
    ["data_source_refs", sourceRefs.join("|")],
    ["kpi_refs", kpiRefs.join("|")],
  ]);
  return {
    mimeType: "text/csv; charset=utf-8",
    bytes: new TextEncoder().encode(csv),
  };
}

async function uploadReportExportFile(params: {
  supabase: SupabaseClient;
  companyId: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<{ filePath: string; downloadUrl: string; fileSize: number }> {
  const safeName = sanitizeFileName(params.fileName);
  const filePath = `${params.companyId}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await params.supabase.storage
    .from(REPORT_EXPORT_BUCKET)
    .upload(filePath, params.bytes, {
      contentType: params.mimeType,
      upsert: false,
    });
  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const { data: signed, error: signedError } = await params.supabase.storage
    .from(REPORT_EXPORT_BUCKET)
    .createSignedUrl(filePath, REPORT_EXPORT_URL_TTL_SECONDS);
  if (signedError || !signed?.signedUrl) {
    throw new Error(signedError?.message ?? "Could not create signed URL");
  }

  return {
    filePath,
    downloadUrl: signed.signedUrl,
    fileSize: params.bytes.byteLength,
  };
}

async function hydrateReportExportUrls(
  supabase: SupabaseClient,
  rows: unknown[],
): Promise<Record<string, unknown>[]> {
  const list = Array.isArray(rows) ? rows : [];
  return await Promise.all(list.map(async (row) => {
    if (!row || typeof row !== "object") return {};
    const obj = row as Record<string, unknown>;
    const filePath = typeof obj.file_path === "string" ? obj.file_path : null;
    if (!filePath) return obj;

    const { data: signed, error } = await supabase.storage
      .from(REPORT_EXPORT_BUCKET)
      .createSignedUrl(filePath, REPORT_EXPORT_URL_TTL_SECONDS);
    if (error || !signed?.signedUrl) return obj;
    return { ...obj, download_url: signed.signedUrl };
  }));
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

        const { data: report, error: reportError } = await supabase
          .from("report_center_reports")
          .select("id, name, description, status, updated_at, tags, data_source_refs, kpi_refs")
          .eq("company_id", companyId)
          .eq("id", op.reportId)
          .maybeSingle();
        if (reportError) throw reportError;
        if (!report) {
          return new Response(JSON.stringify({ error: "Report not found" }), {
            status: 404,
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

        try {
          const generatedAt = new Date().toISOString();
          const fileName = resolveExportFileName(
            typeof op.fileName === "string" ? op.fileName : undefined,
            String(report.name ?? `report-${op.reportId.slice(0, 8)}`),
            op.format,
          );
          const content = buildExportContent({
            report: report as Record<string, unknown>,
            format: op.format,
            generatedAt,
            requestedBy: userId,
          });
          const upload = await uploadReportExportFile({
            supabase,
            companyId,
            fileName,
            mimeType: content.mimeType,
            bytes: content.bytes,
          });

          await supabase
            .from("report_export_jobs")
            .update({
              status: "completed",
              error_message: null,
              file_name: fileName,
              mime_type: content.mimeType,
              file_path: upload.filePath,
              file_size: upload.fileSize,
              download_url: upload.downloadUrl,
              metadata: {
                ...prevMeta,
                generatedAt,
                generatedBy: userId,
                generator: "reports-center-api",
                compressRequested: Boolean(op.compress),
              },
              updated_at: new Date().toISOString(),
            })
            .eq("id", data.id)
            .eq("company_id", companyId);
        } catch (e) {
          const message = e instanceof Error ? e.message : "Export generation failed";
          await supabase
            .from("report_export_jobs")
            .update({
              status: "failed",
              error_message: message.slice(0, 2000),
              updated_at: new Date().toISOString(),
              metadata: {
                ...prevMeta,
                failedAt: new Date().toISOString(),
                failureStage: "generation_or_upload",
              },
            })
            .eq("id", data.id)
            .eq("company_id", companyId);
        }

        const { data: finalRow, error: finalError } = await supabase
          .from("report_export_jobs")
          .select("*")
          .eq("id", data.id)
          .eq("company_id", companyId)
          .single();
        if (finalError) throw finalError;

        const hydrated = await hydrateReportExportUrls(supabase, [finalRow]);
        return new Response(JSON.stringify({ data: hydrated[0] ?? finalRow }), {
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
        const rows = await hydrateReportExportUrls(supabase, Array.isArray(data) ? data : []);
        return new Response(JSON.stringify({ data: rows }), {
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
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
