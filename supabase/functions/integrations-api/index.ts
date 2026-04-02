/**
 * Integrations API — connector registry, encrypted credentials, sync (stub), mappings, health.
 * Client: supabase.functions.invoke('integrations-api', { body: { op, ...payload } }).
 * Secrets: CREDENTIALS_MASTER_KEY (base64 32-byte), SUPABASE_SERVICE_ROLE_KEY (admin ops only).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";
import { corsHeaders } from "../_shared/cors.ts";
import {
  decryptCredentialsJson,
  encryptCredentialsJson,
} from "../_shared/credentials-crypto.ts";
import { runProviderSyncStub } from "../_shared/provider-sync-stubs.ts";

const opSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("connectors.list") }),
  z.object({
    op: z.literal("connectors.create"),
    providerKey: z.string().min(1),
    displayName: z.string().optional(),
  }),
  z.object({
    op: z.literal("connectors.update"),
    connectorId: z.string().uuid(),
    status: z.string().optional(),
    config: z.record(z.string(), z.unknown()).optional(),
    syncIntervalMinutes: z.number().int().positive().optional(),
  }),
  z.object({
    op: z.literal("credentials.upsert"),
    connectorId: z.string().uuid(),
    credentials: z.record(z.string(), z.unknown()),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({ op: z.literal("credentials.meta"), connectorId: z.string().uuid() }),
  z.object({
    op: z.literal("sync.trigger"),
    connectorId: z.string().uuid(),
    idempotencyKey: z.string().min(4).max(200).optional(),
  }),
  z.object({
    op: z.literal("sync.list"),
    connectorId: z.string().uuid(),
    limit: z.number().int().positive().max(100).optional(),
  }),
  z.object({
    op: z.literal("logs.list"),
    connectorId: z.string().uuid(),
    limit: z.number().int().positive().max(200).optional(),
  }),
  z.object({ op: z.literal("health.tenant") }),
  z.object({
    op: z.literal("mappings.replace"),
    connectorId: z.string().uuid(),
    mappings: z.array(
      z.object({
        sourceField: z.string(),
        targetEntity: z.string(),
        targetField: z.string(),
        dataType: z.string().optional(),
      }),
    ),
  }),
  z.object({
    op: z.literal("mappings.list"),
    connectorId: z.string().uuid(),
  }),
  z.object({ op: z.literal("admin.tenants") }),
  z.object({ op: z.literal("admin.integrationOverview") }),
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
  const roles = Array.isArray(data?.roles) ? data!.roles : [];
  return { company_id: data?.company_id ?? null, roles };
}

function assertCompany(
  companyId: string | null,
): asserts companyId is string {
  if (!companyId) {
    throw new Response(JSON.stringify({ error: "Profile missing company" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleOp(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
  roles: string[],
  body: ParsedOp,
): Promise<Response> {
  const masterKey = Deno.env.get("CREDENTIALS_MASTER_KEY");

  switch (body.op) {
    case "connectors.list": {
      const { data, error } = await supabase
        .from("connectors")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 500);
      return json({ connectors: data ?? [] });
    }

    case "connectors.create": {
      const { data, error } = await supabase
        .from("connectors")
        .insert({
          company_id: companyId,
          provider_key: body.providerKey,
          display_name: body.displayName ?? body.providerKey,
          status: "disconnected",
        })
        .select("*")
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ connector: data });
    }

    case "connectors.update": {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.status !== undefined) patch.status = body.status;
      if (body.config !== undefined) patch.config = body.config;
      if (body.syncIntervalMinutes !== undefined) {
        patch.sync_interval_minutes = body.syncIntervalMinutes;
      }
      const { data, error } = await supabase
        .from("connectors")
        .update(patch)
        .eq("id", body.connectorId)
        .eq("company_id", companyId)
        .select("*")
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ connector: data });
    }

    case "credentials.upsert": {
      if (!masterKey) {
        return json({ error: "Server missing CREDENTIALS_MASTER_KEY" }, 500);
      }
      const { data: conn, error: cErr } = await supabase
        .from("connectors")
        .select("id, provider_key")
        .eq("id", body.connectorId)
        .eq("company_id", companyId)
        .maybeSingle();
      if (cErr || !conn) return json({ error: "Connector not found" }, 404);

      const encrypted = await encryptCredentialsJson(body.credentials, masterKey);
      const meta = {
        ...(body.metadata ?? {}),
        hasClientId: typeof body.credentials.client_id === "string",
        hasApiKey: typeof body.credentials.api_key === "string",
        updatedAt: new Date().toISOString(),
      };

      const { error: upErr } = await supabase.from("connector_credentials").upsert(
        {
          company_id: companyId,
          connector_id: body.connectorId,
          encrypted_payload: encrypted,
          metadata: meta,
          rotated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "connector_id" },
      );
      if (upErr) return json({ error: upErr.message }, 400);

      await supabase
        .from("connectors")
        .update({ status: "connected", updated_at: new Date().toISOString() })
        .eq("id", body.connectorId);

      return json({ ok: true, masked: { note: "Credentials stored encrypted" } });
    }

    case "credentials.meta": {
      const { data, error } = await supabase
        .from("connector_credentials")
        .select("metadata, rotated_at, created_at")
        .eq("connector_id", body.connectorId)
        .eq("company_id", companyId)
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ meta: null });
      return json({ meta: data });
    }

    case "sync.trigger": {
      const { data: conn, error: cErr } = await supabase
        .from("connectors")
        .select("id, provider_key, status")
        .eq("id", body.connectorId)
        .eq("company_id", companyId)
        .maybeSingle();
      if (cErr || !conn) return json({ error: "Connector not found" }, 404);

      if (body.idempotencyKey) {
        const { data: existing } = await supabase
          .from("connector_sync_runs")
          .select("*")
          .eq("connector_id", body.connectorId)
          .eq("idempotency_key", body.idempotencyKey)
          .maybeSingle();
        if (existing && existing.status === "completed") {
          return json({ deduped: true, run: existing });
        }
      }

      const { data: run, error: rErr } = await supabase
        .from("connector_sync_runs")
        .insert({
          company_id: companyId,
          connector_id: body.connectorId,
          status: "running",
          idempotency_key: body.idempotencyKey ?? null,
        })
        .select("*")
        .single();
      if (rErr || !run) return json({ error: rErr?.message ?? "sync start failed" }, 400);

      let decrypted: Record<string, unknown> = {};
      if (masterKey) {
        const { data: cred } = await supabase
          .from("connector_credentials")
          .select("encrypted_payload")
          .eq("connector_id", body.connectorId)
          .maybeSingle();
        if (cred?.encrypted_payload) {
          try {
            decrypted = await decryptCredentialsJson(cred.encrypted_payload, masterKey);
          } catch {
            decrypted = {};
          }
        }
      }

      const stub = await runProviderSyncStub(conn.provider_key, decrypted);
      const ended = new Date().toISOString();

      await supabase.from("connector_sync_log_entries").insert([
        {
          sync_run_id: run.id,
          level: "info",
          message: "Sync started (stub adapter)",
        },
        {
          sync_run_id: run.id,
          level: "info",
          message: stub.notes.join(" "),
        },
      ]);

      const { data: updatedRun, error: uErr } = await supabase
        .from("connector_sync_runs")
        .update({
          status: "completed",
          ended_at: ended,
          result_summary: {
            recordsProcessed: stub.recordsProcessed,
            unifiedEntitiesUpserted: stub.unifiedEntitiesUpserted,
            provider: conn.provider_key,
          },
        })
        .eq("id", run.id)
        .select("*")
        .single();

      await supabase
        .from("connectors")
        .update({ last_sync_at: ended, status: "healthy", updated_at: ended })
        .eq("id", body.connectorId);

      await supabase.from("activity_logs").insert({
        company_id: companyId,
        event_type: "connector.sync",
        actor_user_id: userId,
        payload: {
          connectorId: body.connectorId,
          syncRunId: run.id,
          providerKey: conn.provider_key,
          idempotencyKey: body.idempotencyKey ?? null,
        },
      });

      if (uErr) return json({ error: uErr.message }, 500);
      return json({ run: updatedRun, stub });
    }

    case "sync.list": {
      const limit = body.limit ?? 20;
      const { data, error } = await supabase
        .from("connector_sync_runs")
        .select("*")
        .eq("connector_id", body.connectorId)
        .eq("company_id", companyId)
        .order("started_at", { ascending: false })
        .limit(limit);
      if (error) return json({ error: error.message }, 500);
      return json({ runs: data ?? [] });
    }

    case "logs.list": {
      const limit = body.limit ?? 50;
      const { data: runs, error: rErr } = await supabase
        .from("connector_sync_runs")
        .select("id")
        .eq("connector_id", body.connectorId)
        .eq("company_id", companyId)
        .order("started_at", { ascending: false })
        .limit(10);
      if (rErr) return json({ error: rErr.message }, 500);
      const runIds = (runs ?? []).map((r) => r.id);
      if (runIds.length === 0) return json({ logs: [] });

      const { data: logs, error: lErr } = await supabase
        .from("connector_sync_log_entries")
        .select("*")
        .in("sync_run_id", runIds)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (lErr) return json({ error: lErr.message }, 500);
      return json({ logs: logs ?? [] });
    }

    case "health.tenant": {
      const { data: connectors, error: cErr } = await supabase
        .from("connectors")
        .select("id, provider_key, status, last_sync_at")
        .eq("company_id", companyId);
      if (cErr) return json({ error: cErr.message }, 500);
      const list = connectors ?? [];
      const healthy = list.filter((c) => c.status === "healthy").length;
      const errorCount = list.filter((c) => c.status === "error").length;
      return json({
        summary: {
          total: list.length,
          healthy,
          errors: errorCount,
          degraded: Math.max(0, list.length - healthy - errorCount),
        },
        connectors: list,
      });
    }

    case "mappings.replace": {
      const { error: delErr } = await supabase
        .from("connector_field_mappings")
        .delete()
        .eq("connector_id", body.connectorId)
        .eq("company_id", companyId);
      if (delErr) return json({ error: delErr.message }, 400);

      const rows = body.mappings.map((m) => ({
        company_id: companyId,
        connector_id: body.connectorId,
        source_field: m.sourceField,
        target_entity: m.targetEntity,
        target_field: m.targetField,
        data_type: m.dataType ?? "string",
      }));

      if (rows.length > 0) {
        const { error: insErr } = await supabase
          .from("connector_field_mappings")
          .insert(rows);
        if (insErr) return json({ error: insErr.message }, 400);
      }
      return json({ ok: true, count: rows.length });
    }

    case "mappings.list": {
      const { data, error } = await supabase
        .from("connector_field_mappings")
        .select("*")
        .eq("connector_id", body.connectorId)
        .eq("company_id", companyId)
        .order("created_at", { ascending: true });
      if (error) return json({ error: error.message }, 500);
      return json({ mappings: data ?? [] });
    }

    case "admin.tenants":
    case "admin.integrationOverview": {
      if (!roles.includes("super_admin")) {
        return json({ error: "Forbidden" }, 403);
      }
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const url = Deno.env.get("SUPABASE_URL") ?? "";
      if (!serviceKey) return json({ error: "Server missing service role" }, 500);
      const admin = createClient(url, serviceKey);
      const { data: companies, error } = await admin
        .from("companies")
        .select("id, name, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) return json({ error: error.message }, 500);
      const companyList = companies ?? [];

      if (body.op === "admin.tenants") {
        return json({ tenants: companyList });
      }

      const summaries: unknown[] = [];
      for (const c of companyList.slice(0, 25)) {
        const { data: conns } = await admin
          .from("connectors")
          .select("id, provider_key, status, last_sync_at")
          .eq("company_id", c.id);
        const cl = Array.isArray(conns) ? conns : [];
        summaries.push({
          companyId: c.id,
          name: c.name,
          connectorCount: cl.length,
          healthy: cl.filter((x) => x.status === "healthy").length,
          lastSync: cl
            .map((x) => x.last_sync_at)
            .filter(Boolean)
            .sort()
            .pop() ?? null,
        });
      }
      return json({ overview: summaries });
    }

    default:
      return json({ error: "Unknown operation" }, 400);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabase, userId } = await requireUser(req);
    const raw = await req.json().catch(() => null);
    const parsed = opSchema.safeParse(raw);
    if (!parsed.success) {
      return json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
    }

    const profile = await loadProfile(supabase, userId);
    const adminOps = parsed.data.op === "admin.tenants" ||
      parsed.data.op === "admin.integrationOverview";

    if (adminOps) {
      return await handleOp(
        supabase,
        userId,
        profile.company_id ?? "",
        profile.roles,
        parsed.data,
      );
    }

    assertCompany(profile.company_id);
    return await handleOp(
      supabase,
      userId,
      profile.company_id,
      profile.roles,
      parsed.data,
    );
  } catch (e) {
    if (e instanceof Response) return e;
    const message = e instanceof Error ? e.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
