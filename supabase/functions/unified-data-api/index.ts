/**
 * Unified Data & Context API — canonical entities, sources, links, versioning, ingest, search, reports, dashboard rollups.
 * Client: supabase.functions.invoke('unified-data-api', { body: { op, ... } }).
 * Secrets: SUPABASE_URL, SUPABASE_ANON_KEY; optional SUPABASE_SERVICE_ROLE_KEY for MV reads + refresh.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";
import { corsHeaders } from "../_shared/cors.ts";

const sourceRefSchema = z.object({
  provider: z.string().min(1),
  externalId: z.string().min(1),
  lastSeenAt: z.string().optional(),
});

const entityTypeSchema = z.enum([
  "Contact",
  "Lead",
  "Opportunity",
  "Deal",
  "Project",
  "Task",
  "Document",
  "KPI",
  "Alert",
  "Activity",
  "Report",
  "Workflow",
  "Company",
  "Department",
  "User",
  "Account",
  "Conversation",
]);

const REQUIRED_PAYLOAD_KEYS: Partial<Record<z.infer<typeof entityTypeSchema>, string[]>> = {
  Task: ["title"],
  Contact: ["name"],
  Lead: ["title"],
  Deal: ["title"],
  Opportunity: ["title"],
  Project: ["name"],
  KPI: ["name"],
  Document: ["title"],
  Alert: ["title"],
  Activity: ["title"],
  Report: ["title"],
};

const opSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("entities.upsert"),
    id: z.string().uuid().optional(),
    entityType: entityTypeSchema,
    payload: z.record(z.unknown()),
    sourceReferences: z.array(sourceRefSchema).optional(),
    departmentId: z.string().uuid().nullable().optional(),
    linkedEntityIds: z.array(z.string().uuid()).optional(),
  }),
  z.object({
    op: z.literal("entities.list"),
    entityType: z.string().optional(),
    departmentId: z.string().uuid().optional(),
    search: z.string().optional(),
    includeDeleted: z.boolean().optional(),
    limit: z.number().int().positive().max(200).optional(),
    offset: z.number().int().min(0).optional(),
  }),
  z.object({
    op: z.literal("entities.link"),
    entityId: z.string().uuid(),
    targetEntityId: z.string().uuid(),
    relationType: z.string().min(1).max(120).optional(),
  }),
  z.object({
    op: z.literal("entities.softDelete"),
    entityId: z.string().uuid(),
  }),
  z.object({
    op: z.literal("entities.materializedView"),
    viewName: z.enum(["rollups", "kpis"]),
  }),
  z.object({
    op: z.literal("entities.refreshMaterializedViews"),
  }),
  z.object({
    op: z.literal("integrations.ingest"),
    provider: z.string().min(1),
    records: z.array(
      z.object({
        externalId: z.string().min(1),
        entityType: entityTypeSchema,
        payload: z.record(z.unknown()),
        departmentId: z.string().uuid().optional(),
      }),
    ).min(1).max(500),
  }),
  z.object({
    op: z.literal("search.query"),
    q: z.string().optional(),
    entityType: z.string().optional(),
    departmentId: z.string().uuid().optional(),
    limit: z.number().int().positive().max(200).optional(),
  }),
  z.object({ op: z.literal("reports.templates.list") }),
  z.object({
    op: z.literal("reports.template.upsert"),
    id: z.string().uuid().optional(),
    name: z.string().min(1),
    definition: z.record(z.unknown()).optional(),
    departmentId: z.string().uuid().nullable().optional(),
  }),
  z.object({
    op: z.literal("reports.template.delete"),
    id: z.string().uuid(),
  }),
  z.object({ op: z.literal("reports.schedules.list") }),
  z.object({
    op: z.literal("reports.schedule.upsert"),
    id: z.string().uuid().optional(),
    reportTemplateId: z.string().uuid(),
    cronExpression: z.string().optional(),
    exportFormat: z.enum(["pdf", "csv", "json"]).optional(),
    nextRunAt: z.string().optional(),
  }),
  z.object({
    op: z.literal("department.snapshot"),
    departmentId: z.string().uuid(),
  }),
  z.object({
    op: z.literal("activity.recent"),
    limit: z.number().int().positive().max(100).optional(),
  }),
  z.object({
    op: z.literal("ai.summarizeResult"),
    entityId: z.string().uuid(),
    mode: z.enum(["brief", "detailed"]).optional(),
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
    throw new Response(JSON.stringify({ error: "No tenant context" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

function normalizeRoles(roles: string[]): Set<string> {
  return new Set((roles ?? []).map((r) => r.toLowerCase()));
}

function canMutateEntities(roles: string[]): boolean {
  const r = normalizeRoles(roles);
  return (
    r.has("admin") ||
    r.has("company admin") ||
    r.has("executive") ||
    r.has("manager")
  );
}

function canAdminMv(roles: string[]): boolean {
  const r = normalizeRoles(roles);
  return r.has("admin") || r.has("company admin");
}

function validatePayloadForType(
  entityType: z.infer<typeof entityTypeSchema>,
  payload: Record<string, unknown>,
): string | null {
  const keys = REQUIRED_PAYLOAD_KEYS[entityType];
  if (!keys?.length) return null;
  for (const k of keys) {
    const v = payload[k];
    if (v === undefined || v === null || (typeof v === "string" && !v.trim())) {
      return `Missing required payload field "${k}" for ${entityType}`;
    }
  }
  return null;
}

async function replaceSources(
  supabase: SupabaseClient,
  companyId: string,
  entityId: string,
  refs: z.infer<typeof sourceRefSchema>[],
): Promise<void> {
  await supabase.from("unified_sources").delete().eq("unified_entity_id", entityId);
  if (!refs.length) return;
  const rows = refs.map((r) => ({
    unified_entity_id: entityId,
    company_id: companyId,
    provider: r.provider,
    external_id: r.externalId,
    last_seen_at: r.lastSeenAt ?? new Date().toISOString(),
  }));
  const { error } = await supabase.from("unified_sources").insert(rows);
  if (error) throw error;
}

async function logActivity(
  supabase: SupabaseClient,
  companyId: string,
  userId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await supabase.from("activity_logs").insert({
    company_id: companyId,
    event_type: eventType,
    actor_user_id: userId,
    payload,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabase, userId } = await requireUser(req);
    const raw = await req.json().catch(() => ({}));
    const parsed = opSchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid request", details: parsed.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const op = parsed.data as ParsedOp;
    const profile = await loadProfile(supabase, userId);
    assertCompany(profile.company_id);
    const companyId = profile.company_id;

    switch (op.op) {
      case "entities.upsert": {
        if (!canMutateEntities(profile.roles)) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const err = validatePayloadForType(op.entityType, op.payload as Record<string, unknown>);
        if (err) {
          return new Response(JSON.stringify({ error: err }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const sourceReferences = (op.sourceReferences ?? []).map((r) => ({
          provider: r.provider,
          externalId: r.externalId,
          lastSeenAt: r.lastSeenAt ?? new Date().toISOString(),
        }));

        if (op.id) {
          const { data: prev, error: gErr } = await supabase
            .from("unified_entities")
            .select("*")
            .eq("id", op.id)
            .eq("company_id", companyId)
            .maybeSingle();
          if (gErr) throw gErr;
          if (!prev) {
            return new Response(JSON.stringify({ error: "Entity not found" }), {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          const { error: vErr } = await supabase.from("unified_entity_versions").insert({
            unified_entity_id: prev.id,
            company_id: companyId,
            version: prev.version,
            payload: prev.payload,
            source_references: prev.source_references,
            actor_user_id: userId,
          });
          if (vErr) throw vErr;

          const nextVersion = (typeof prev.version === "number" ? prev.version : 1) + 1;
          const linkedIds = op.linkedEntityIds ??
            (Array.isArray(prev.linked_entity_ids) ? prev.linked_entity_ids : []);

          const { data: updated, error: uErr } = await supabase
            .from("unified_entities")
            .update({
              entity_type: op.entityType,
              payload: op.payload,
              source_references: sourceReferences,
              department_id: op.departmentId ?? prev.department_id,
              linked_entity_ids: linkedIds,
              version: nextVersion,
              updated_at: new Date().toISOString(),
            })
            .eq("id", op.id)
            .select("*")
            .single();
          if (uErr) throw uErr;

          await replaceSources(supabase, companyId, op.id, op.sourceReferences ?? []);
          await logActivity(supabase, companyId, userId, "unified.entity.upsert", {
            entityId: op.id,
            entityType: op.entityType,
          });

          return new Response(JSON.stringify({ data: updated }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const insertRow = {
          company_id: companyId,
          entity_type: op.entityType,
          payload: op.payload,
          source_references: sourceReferences,
          department_id: op.departmentId ?? null,
          linked_entity_ids: op.linkedEntityIds ?? [],
          version: 1,
          is_deleted: false,
        };

        const { data: created, error: cErr } = await supabase
          .from("unified_entities")
          .insert(insertRow)
          .select("*")
          .single();
        if (cErr) throw cErr;

        await replaceSources(supabase, companyId, created.id, op.sourceReferences ?? []);
        await logActivity(supabase, companyId, userId, "unified.entity.create", {
          entityId: created.id,
          entityType: op.entityType,
        });

        return new Response(JSON.stringify({ data: created }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "entities.list": {
        const limit = op.limit ?? 50;
        const offset = op.offset ?? 0;
        let q = supabase
          .from("unified_entities")
          .select("*, unified_sources(*)")
          .eq("company_id", companyId)
          .order("updated_at", { ascending: false })
          .range(offset, offset + limit - 1);

        if (!op.includeDeleted) {
          q = q.eq("is_deleted", false);
        }
        if (op.entityType) q = q.eq("entity_type", op.entityType);
        if (op.departmentId) q = q.eq("department_id", op.departmentId);
        if (op.search?.trim()) {
          const safe = op.search.trim().replace(/[%_]/g, "");
          if (safe.length > 0) {
            q = q.ilike("entity_type", `%${safe}%`);
          }
        }

        const { data, error } = await q;
        if (error) {
          let q2 = supabase
            .from("unified_entities")
            .select("*")
            .eq("company_id", companyId)
            .order("updated_at", { ascending: false })
            .range(offset, offset + limit - 1);
          if (!op.includeDeleted) q2 = q2.eq("is_deleted", false);
          if (op.entityType) q2 = q2.eq("entity_type", op.entityType);
          if (op.departmentId) q2 = q2.eq("department_id", op.departmentId);
          if (op.search?.trim()) {
            const safe = op.search.trim().replace(/[%_]/g, "");
            if (safe.length > 0) q2 = q2.ilike("entity_type", `%${safe}%`);
          }
          const res2 = await q2;
          if (res2.error) throw res2.error;
          return new Response(JSON.stringify({ data: res2.data ?? [] }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ data: data ?? [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "entities.link": {
        if (!canMutateEntities(profile.roles)) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const rel = op.relationType ?? "related";
        const { error: lErr } = await supabase.from("entity_links").insert({
          company_id: companyId,
          left_entity_id: op.entityId,
          right_entity_id: op.targetEntityId,
          relation_type: rel,
        });
        if (lErr) {
          const msg = lErr.message ?? "";
          if (!msg.includes("duplicate") && !msg.includes("unique")) throw lErr;
        }

        const { data: left } = await supabase
          .from("unified_entities")
          .select("linked_entity_ids")
          .eq("id", op.entityId)
          .eq("company_id", companyId)
          .maybeSingle();
        const { data: right } = await supabase
          .from("unified_entities")
          .select("linked_entity_ids")
          .eq("id", op.targetEntityId)
          .eq("company_id", companyId)
          .maybeSingle();

        const lArr = Array.isArray(left?.linked_entity_ids)
          ? (left!.linked_entity_ids as string[])
          : [];
        const rArr = Array.isArray(right?.linked_entity_ids)
          ? (right!.linked_entity_ids as string[])
          : [];
        const lNext = [...new Set([...lArr, op.targetEntityId])];
        const rNext = [...new Set([...rArr, op.entityId])];

        await supabase
          .from("unified_entities")
          .update({ linked_entity_ids: lNext })
          .eq("id", op.entityId);
        await supabase
          .from("unified_entities")
          .update({ linked_entity_ids: rNext })
          .eq("id", op.targetEntityId);

        await logActivity(supabase, companyId, userId, "unified.entity.link", {
          left: op.entityId,
          right: op.targetEntityId,
          relationType: rel,
        });

        return new Response(JSON.stringify({ data: { ok: true } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "entities.softDelete": {
        if (!canMutateEntities(profile.roles)) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: prev, error: gErr } = await supabase
          .from("unified_entities")
          .select("*")
          .eq("id", op.entityId)
          .eq("company_id", companyId)
          .maybeSingle();
        if (gErr) throw gErr;
        if (!prev) {
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await supabase.from("unified_entity_versions").insert({
          unified_entity_id: prev.id,
          company_id: companyId,
          version: prev.version,
          payload: prev.payload,
          source_references: prev.source_references,
          actor_user_id: userId,
        });

        const nextVersion = (typeof prev.version === "number" ? prev.version : 1) + 1;
        const { data: updated, error: uErr } = await supabase
          .from("unified_entities")
          .update({
            is_deleted: true,
            version: nextVersion,
            updated_at: new Date().toISOString(),
          })
          .eq("id", op.entityId)
          .select("*")
          .single();
        if (uErr) throw uErr;

        await logActivity(supabase, companyId, userId, "unified.entity.soft_delete", {
          entityId: op.entityId,
        });

        return new Response(JSON.stringify({ data: updated }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "entities.materializedView": {
        if (op.viewName === "kpis") {
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
          const url = Deno.env.get("SUPABASE_URL") ?? "";
          if (serviceKey) {
            const admin = createClient(url, serviceKey);
            const { data, error } = await admin
              .from("mv_tenant_dashboard_kpis")
              .select("*")
              .eq("company_id", companyId);
            if (error) throw error;
            return new Response(JSON.stringify({ data: data ?? [] }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
        const { data, error } = await supabase
          .from("v_dashboard_entity_rollups")
          .select("*")
          .eq("company_id", companyId);
        if (error) throw error;
        return new Response(JSON.stringify({ data: data ?? [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "entities.refreshMaterializedViews": {
        if (!canAdminMv(profile.roles)) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        const url = Deno.env.get("SUPABASE_URL") ?? "";
        if (!serviceKey) {
          return new Response(JSON.stringify({ error: "Service role not configured" }), {
            status: 503,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const admin = createClient(url, serviceKey);
        const { error } = await admin.rpc("refresh_dashboard_kpis_mv");
        if (error) throw error;
        return new Response(JSON.stringify({ data: { refreshed: true } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "integrations.ingest": {
        if (!canMutateEntities(profile.roles)) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const results: unknown[] = [];
        for (const rec of op.records) {
          const pErr = validatePayloadForType(rec.entityType, rec.payload as Record<string, unknown>);
          if (pErr) {
            return new Response(JSON.stringify({ error: pErr, record: rec.externalId }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          const { data: existingSrc } = await supabase
            .from("unified_sources")
            .select("unified_entity_id")
            .eq("company_id", companyId)
            .eq("provider", op.provider)
            .eq("external_id", rec.externalId)
            .maybeSingle();

          const refs = [{
            provider: op.provider,
            externalId: rec.externalId,
            lastSeenAt: new Date().toISOString(),
          }];

          if (existingSrc?.unified_entity_id) {
            const eid = existingSrc.unified_entity_id as string;
            const { data: prev, error: pe } = await supabase
              .from("unified_entities")
              .select("*")
              .eq("id", eid)
              .eq("company_id", companyId)
              .maybeSingle();
            if (pe) throw pe;
            if (!prev) continue;

            const mergedPayload = {
              ...(typeof prev.payload === "object" && prev.payload !== null
                ? prev.payload as Record<string, unknown>
                : {}),
              ...rec.payload,
            };

            await supabase.from("unified_entity_versions").insert({
              unified_entity_id: prev.id,
              company_id: companyId,
              version: prev.version,
              payload: prev.payload,
              source_references: prev.source_references,
              actor_user_id: userId,
            });

            const nextVersion = (typeof prev.version === "number" ? prev.version : 1) + 1;
            const { data: upd, error: ue } = await supabase
              .from("unified_entities")
              .update({
                entity_type: rec.entityType,
                payload: mergedPayload,
                department_id: rec.departmentId ?? prev.department_id,
                version: nextVersion,
                updated_at: new Date().toISOString(),
                is_deleted: false,
              })
              .eq("id", eid)
              .select("*")
              .single();
            if (ue) throw ue;
            await replaceSources(supabase, companyId, eid, refs);
            results.push(upd);
          } else {
            const { data: created, error: ce } = await supabase
              .from("unified_entities")
              .insert({
                company_id: companyId,
                entity_type: rec.entityType,
                payload: rec.payload,
                source_references: refs,
                department_id: rec.departmentId ?? null,
                linked_entity_ids: [],
                version: 1,
                is_deleted: false,
              })
              .select("*")
              .single();
            if (ce) throw ce;
            await replaceSources(supabase, companyId, created.id, refs);
            results.push(created);
          }
        }

        await logActivity(supabase, companyId, userId, "integrations.ingest", {
          provider: op.provider,
          count: op.records.length,
        });

        return new Response(JSON.stringify({ data: results }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "search.query": {
        const { data, error } = await supabase.rpc("search_unified_entities", {
          p_search: op.q ?? "",
          p_entity_type: op.entityType ?? null,
          p_department_id: op.departmentId ?? null,
          p_limit: op.limit ?? 50,
        });
        if (error) {
          return new Response(JSON.stringify({ data: [], meta: { fallback: true, error: error.message } }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ data: data ?? [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "reports.templates.list": {
        const { data, error } = await supabase
          .from("report_templates")
          .select("*")
          .eq("company_id", companyId)
          .order("updated_at", { ascending: false });
        if (error) throw error;
        return new Response(JSON.stringify({ data: data ?? [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "reports.template.upsert": {
        if (!canMutateEntities(profile.roles)) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const def = op.definition ?? {};
        if (op.id) {
          const { data, error } = await supabase
            .from("report_templates")
            .update({
              name: op.name,
              definition: def,
              department_id: op.departmentId ?? null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", op.id)
            .eq("company_id", companyId)
            .select("*")
            .single();
          if (error) throw error;
          return new Response(JSON.stringify({ data }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data, error } = await supabase
          .from("report_templates")
          .insert({
            company_id: companyId,
            name: op.name,
            definition: def,
            department_id: op.departmentId ?? null,
            created_by: userId,
          })
          .select("*")
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "reports.template.delete": {
        if (!canMutateEntities(profile.roles)) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error } = await supabase
          .from("report_templates")
          .delete()
          .eq("id", op.id)
          .eq("company_id", companyId);
        if (error) throw error;
        return new Response(JSON.stringify({ data: { ok: true } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "reports.schedules.list": {
        const { data, error } = await supabase
          .from("report_schedules")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return new Response(JSON.stringify({ data: data ?? [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "reports.schedule.upsert": {
        if (!canMutateEntities(profile.roles)) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const row = {
          company_id: companyId,
          report_template_id: op.reportTemplateId,
          cron_expression: op.cronExpression ?? null,
          export_format: op.exportFormat ?? "pdf",
          next_run_at: op.nextRunAt ?? null,
        };
        if (op.id) {
          const { data, error } = await supabase
            .from("report_schedules")
            .update(row)
            .eq("id", op.id)
            .eq("company_id", companyId)
            .select("*")
            .single();
          if (error) throw error;
          return new Response(JSON.stringify({ data }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data, error } = await supabase
          .from("report_schedules")
          .insert(row)
          .select("*")
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "department.snapshot": {
        const { data: dept, error: dErr } = await supabase
          .from("departments")
          .select("*")
          .eq("id", op.departmentId)
          .eq("company_id", companyId)
          .maybeSingle();
        if (dErr) throw dErr;

        const { data: entities, error: eErr } = await supabase
          .from("unified_entities")
          .select("*")
          .eq("company_id", companyId)
          .eq("department_id", op.departmentId)
          .eq("is_deleted", false)
          .order("updated_at", { ascending: false })
          .limit(80);
        if (eErr) throw eErr;

        const list = Array.isArray(entities) ? entities : [];
        const tasks = list.filter((x) => x.entity_type === "Task");
        const docs = list.filter((x) => x.entity_type === "Document");
        const kpis = list.filter((x) => x.entity_type === "KPI");
        const workflows = list.filter((x) => x.entity_type === "Workflow");

        return new Response(
          JSON.stringify({
            data: {
              department: dept,
              entities: list,
              tasks,
              documents: docs,
              kpis,
              workflows,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "activity.recent": {
        const lim = op.limit ?? 30;
        const { data, error } = await supabase
          .from("activity_logs")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(lim);
        if (error) throw error;
        return new Response(JSON.stringify({ data: data ?? [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "ai.summarizeResult": {
        const { data: entity, error: eErr } = await supabase
          .from("unified_entities")
          .select("*")
          .eq("id", op.entityId)
          .eq("company_id", companyId)
          .eq("is_deleted", false)
          .maybeSingle();
        if (eErr) throw eErr;
        if (!entity) {
          return new Response(JSON.stringify({ error: "Entity not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const apiKey = Deno.env.get("OPENAI_API_KEY");
        if (!apiKey) {
          const title =
            typeof (entity.payload as Record<string, unknown>)?.title === "string"
              ? (entity.payload as Record<string, unknown>).title as string
              : entity.entity_type;
          return new Response(
            JSON.stringify({
              data: {
                summary: `Context for "${title}" (${entity.entity_type}). Configure OPENAI_API_KEY for AI summaries.`,
                citations: [{ type: "unified_entity", id: entity.id }],
              },
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const sys = `You are an assistant summarizing tenant-scoped business entities. Output 2-4 sentences. No PII beyond what is in the payload. Entity type: ${entity.entity_type}.`;
        const userMsg = JSON.stringify(entity.payload ?? {});

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: sys },
              { role: "user", content: userMsg },
            ],
          }),
        });
        const json = await res.json();
        const text = json?.choices?.[0]?.message?.content ?? "Unable to summarize.";
        await logActivity(supabase, companyId, userId, "ai.unified_summary", {
          entityId: entity.id,
          mode: op.mode ?? "brief",
        });

        return new Response(
          JSON.stringify({
            data: {
              summary: text,
              citations: [{ type: "unified_entity", id: entity.id }],
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      default:
        return new Response(JSON.stringify({ error: "Unsupported op" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (e) {
    if (e instanceof Response) return e;
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
