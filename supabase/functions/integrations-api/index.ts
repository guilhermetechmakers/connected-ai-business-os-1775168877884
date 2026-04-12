/**
 * Integrations API.
 * Real provider runtime for OAuth, connection tests, sync, tools, and event queue ingestion.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";
import { corsHeaders } from "../_shared/cors.ts";
import { encryptCredentialsJson } from "../_shared/credentials-crypto.ts";
import {
  connectionTest,
  enqueueConnectorEvent,
  listProviderCatalog,
  oauthCallback,
  oauthStart,
  syncTrigger,
  toolsExecute,
  toolsList,
  type ProviderKey,
} from "../_shared/integrations-runtime.ts";

const providerKeySchema = z.enum([
  "slack",
  "google_drive",
  "gmail",
  "google_calendar",
  "hubspot",
  "quickbooks",
  "stripe",
]);

const opSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("catalog.list") }),
  z.object({ op: z.literal("connectors.list") }),
  z.object({
    op: z.literal("connectors.create"),
    providerKey: providerKeySchema,
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
    op: z.literal("connectors.remove"),
    connectorId: z.string().uuid(),
  }),
  z.object({
    op: z.literal("oauth.start"),
    providerKey: providerKeySchema,
    connectorId: z.string().uuid().optional(),
  }),
  z.object({
    op: z.literal("oauth.callback"),
    code: z.string().min(1),
    state: z.string().min(8),
  }),
  z.object({
    op: z.literal("credentials.upsert"),
    connectorId: z.string().uuid(),
    credentials: z.record(z.string(), z.unknown()),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    op: z.literal("credentials.meta"),
    connectorId: z.string().uuid(),
  }),
  z.object({
    op: z.literal("connection.test"),
    connectorId: z.string().uuid(),
  }),
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
  z.object({ op: z.literal("tools.list") }),
  z.object({
    op: z.literal("tools.execute"),
    toolId: z.string().min(3),
    args: z.record(z.string(), z.unknown()).optional(),
    confirmed: z.boolean().optional(),
    conversationId: z.string().uuid().optional(),
    workflowRunId: z.string().uuid().optional(),
  }),
  z.object({
    op: z.literal("events.enqueue"),
    providerKey: providerKeySchema,
    connectorId: z.string().uuid().optional(),
    eventType: z.string().min(2).max(120),
    externalEventId: z.string().min(2).max(300),
    payload: z.record(z.string(), z.unknown()),
    availableAt: z.string().datetime().optional(),
  }),
  z.object({ op: z.literal("admin.tenants") }),
  z.object({ op: z.literal("admin.integrationOverview") }),
]);

type ParsedOp = z.infer<typeof opSchema>;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type LogLevel = "info" | "warn" | "error";

function writeLog(level: LogLevel, event: string, fields: Record<string, unknown>) {
  const entry = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...fields,
  };
  const message = JSON.stringify(entry);
  if (level === "error") {
    console.error(message);
    return;
  }
  if (level === "warn") {
    console.warn(message);
    return;
  }
  console.log(message);
}

function summarizeRawRequestBody(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const body = raw as Record<string, unknown>;
  const summary: Record<string, unknown> = {};
  if (typeof body.op === "string") summary.op = body.op;
  if (typeof body.connectorId === "string") summary.connectorId = body.connectorId;
  if (typeof body.providerKey === "string") summary.providerKey = body.providerKey;
  if (typeof body.toolId === "string") summary.toolId = body.toolId;
  if (typeof body.eventType === "string") summary.eventType = body.eventType;
  if (typeof body.externalEventId === "string") summary.externalEventId = body.externalEventId;
  return summary;
}

function summarizeZodIssues(error: z.ZodError): unknown[] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    code: issue.code,
    message: issue.message,
  }));
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    };
  }
  if (typeof error === "object" && error !== null) {
    const objectError = error as Record<string, unknown>;
    let serialized: string | null = null;
    try {
      serialized = JSON.stringify(objectError);
    } catch {
      serialized = null;
    }
    return {
      type: Object.prototype.toString.call(error),
      keys: Object.keys(objectError),
      message: typeof objectError.message === "string" ? objectError.message : null,
      name: typeof objectError.name === "string" ? objectError.name : null,
      status: typeof objectError.status === "number" ? objectError.status : null,
      code: typeof objectError.code === "string" ? objectError.code : null,
      details: typeof objectError.details === "string" ? objectError.details : null,
      hint: typeof objectError.hint === "string" ? objectError.hint : null,
      serialized,
    };
  }
  return {
    type: typeof error,
    value: String(error),
  };
}

function truncateString(value: string, max = 500): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
}

async function summarizeResponseBody(response: Response): Promise<unknown> {
  try {
    const text = await response.clone().text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return truncateString(text);
    }
  } catch {
    return null;
  }
}

async function logCompletedRequest(
  opLog: Record<string, unknown>,
  startedAt: number,
  response: Response,
): Promise<void> {
  const durationMs = Date.now() - startedAt;
  const base = {
    ...opLog,
    status: response.status,
    durationMs,
  };
  if (response.status >= 500) {
    writeLog("error", "integrations_api.request_failed", {
      ...base,
      response: await summarizeResponseBody(response),
    });
    return;
  }
  if (response.status >= 400) {
    writeLog("warn", "integrations_api.request_failed", {
      ...base,
      response: await summarizeResponseBody(response),
    });
    return;
  }
  writeLog("info", "integrations_api.request_completed", base);
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
  const roles = Array.isArray(data?.roles) ? data!.roles : [];
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

function canIntegrationAdminRead(roles: string[]): boolean {
  const r = roles.map((x) => String(x).toLowerCase());
  return r.some((x) =>
    ["super_admin", "compliance_auditor", "auditor"].includes(x)
  );
}

async function handleAdminOverview(
  roles: string[],
  op: "admin.tenants" | "admin.integrationOverview",
): Promise<Response> {
  if (!canIntegrationAdminRead(roles)) return json({ error: "Forbidden" }, 403);
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

  if (op === "admin.tenants") {
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
      healthy: cl.filter((x) => ["healthy", "connected"].includes(String(x.status))).length,
      errors: cl.filter((x) => String(x.status) === "error").length,
      lastSync: cl
        .map((x) => x.last_sync_at)
        .filter(Boolean)
        .sort()
        .pop() ?? null,
    });
  }
  return json({ overview: summaries });
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
    case "catalog.list":
      return json({
        catalog: listProviderCatalog().map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          logoUrl: null,
          supportsOAuth: p.supportsOAuth,
          supportsApiKey: p.supportsApiKey,
          linkedGroup: p.linkedGroup ?? null,
        })),
      });
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
    case "connectors.remove": {
      const { error } = await supabase
        .from("connectors")
        .delete()
        .eq("id", body.connectorId)
        .eq("company_id", companyId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    case "oauth.start": {
      const started = await oauthStart(supabase, {
        companyId,
        userId,
        providerKey: body.providerKey,
        connectorId: body.connectorId,
      });
      return json(started);
    }
    case "oauth.callback": {
      if (!masterKey) return json({ error: "Server missing CREDENTIALS_MASTER_KEY" }, 500);
      const result = await oauthCallback(supabase, {
        companyId,
        code: body.code,
        state: body.state,
        masterKey,
      });
      return json(result);
    }
    case "credentials.upsert": {
      if (!masterKey) return json({ error: "Server missing CREDENTIALS_MASTER_KEY" }, 500);
      const encrypted = await encryptCredentialsJson(body.credentials, masterKey);
      const now = new Date().toISOString();
      const { error } = await supabase.from("connector_credentials").upsert(
        {
          company_id: companyId,
          connector_id: body.connectorId,
          encrypted_payload: encrypted,
          metadata: {
            ...(body.metadata ?? {}),
            updatedAt: now,
          },
          rotated_at: now,
          updated_at: now,
        },
        { onConflict: "connector_id" },
      );
      if (error) return json({ error: error.message }, 400);
      await supabase
        .from("connectors")
        .update({
          status: "connected",
          last_error_message: null,
          last_error_remediation: null,
          updated_at: now,
        })
        .eq("id", body.connectorId)
        .eq("company_id", companyId);
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
      return json({ meta: data ?? null });
    }
    case "connection.test": {
      if (!masterKey) return json({ error: "Server missing CREDENTIALS_MASTER_KEY" }, 500);
      const test = await connectionTest(supabase, {
        companyId,
        connectorId: body.connectorId,
        masterKey,
      });
      return json(test);
    }
    case "sync.trigger": {
      if (!masterKey) return json({ error: "Server missing CREDENTIALS_MASTER_KEY" }, 500);
      const result = await syncTrigger(supabase, {
        companyId,
        userId,
        connectorId: body.connectorId,
        idempotencyKey: body.idempotencyKey,
        masterKey,
      });
      return json(result);
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
      const healthy = list.filter((c) =>
        ["healthy", "connected"].includes(String(c.status))
      ).length;
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
    case "tools.list": {
      const list = await toolsList(supabase, { companyId, roles });
      return json({ tools: list });
    }
    case "tools.execute": {
      if (!masterKey) return json({ error: "Server missing CREDENTIALS_MASTER_KEY" }, 500);
      const safeArgs = body.args && typeof body.args === "object"
        ? Object.keys(body.args as Record<string, unknown>)
        : [];
      writeLog("info", "integrations_api.tools_execute_attempt", {
        op: body.op,
        companyId,
        userId,
        toolId: body.toolId,
        confirmed: body.confirmed === true,
        conversationId: body.conversationId ?? null,
        workflowRunId: body.workflowRunId ?? null,
        argKeys: safeArgs,
      });
      try {
        const result = await toolsExecute(supabase, {
          companyId,
          userId,
          roles,
          toolId: body.toolId,
          args: body.args ?? {},
          confirmed: body.confirmed === true,
          conversationId: body.conversationId,
          workflowRunId: body.workflowRunId,
          source: "integrations_api",
          masterKey,
        });
        writeLog("info", "integrations_api.tools_execute_success", {
          op: body.op,
          companyId,
          userId,
          toolId: body.toolId,
          pendingConfirmation: result.pendingConfirmation === true,
          providerKey: result.providerKey ?? null,
          connectorId: result.connectorId ?? null,
        });
        return json(result, result.pendingConfirmation ? 202 : 200);
      } catch (error) {
        const err = serializeError(error);
        const errMsg = String(err.message ?? "");
        writeLog("error", "integrations_api.tools_execute_failed", {
          op: body.op,
          companyId,
          userId,
          toolId: body.toolId,
          error: err,
        });
        const status = /not authorized|permission|forbidden/i.test(errMsg) ? 403 : 500;
        return json({ error: errMsg || "Tool execution failed" }, status);
      }
    }
    case "events.enqueue": {
      const enqueued = await enqueueConnectorEvent(supabase, companyId, {
        providerKey: body.providerKey as ProviderKey,
        connectorId: body.connectorId ?? null,
        eventType: body.eventType,
        externalEventId: body.externalEventId,
        payload: body.payload,
        availableAt: body.availableAt,
      });
      return json({ ok: true, ...enqueued });
    }
    case "admin.tenants":
      return await handleAdminOverview(roles, "admin.tenants");
    case "admin.integrationOverview":
      return await handleAdminOverview(roles, "admin.integrationOverview");
    default:
      return json({ error: "Unknown operation" }, 400);
  }
}

serve(async (req) => {
  const startedAt = Date.now();
  const url = new URL(req.url);
  const requestId = crypto.randomUUID();
  const baseLog = {
    requestId,
    method: req.method,
    path: url.pathname,
  };

  writeLog("info", "integrations_api.request_received", {
    ...baseLog,
    userAgent: req.headers.get("user-agent"),
  });

  if (req.method === "OPTIONS") {
    writeLog("info", "integrations_api.options", baseLog);
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabase, userId } = await requireUser(req);
    writeLog("info", "integrations_api.authenticated", {
      ...baseLog,
      userId,
    });

    const raw = await req.json().catch(() => null);
    const rawSummary = summarizeRawRequestBody(raw);
    const parsed = opSchema.safeParse(raw);
    if (!parsed.success) {
      writeLog("warn", "integrations_api.invalid_body", {
        ...baseLog,
        userId,
        body: rawSummary,
        issues: summarizeZodIssues(parsed.error),
      });
      return json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
    }

    const profile = await loadProfile(supabase, userId);
    const adminOps = parsed.data.op === "admin.tenants" ||
      parsed.data.op === "admin.integrationOverview";
    const opLog = {
      ...baseLog,
      userId,
      op: parsed.data.op,
      companyId: profile.company_id,
    };

    if (adminOps) {
      const response = await handleOp(
        supabase,
        userId,
        profile.company_id ?? "",
        profile.roles,
        parsed.data,
      );
      await logCompletedRequest(opLog, startedAt, response);
      return response;
    }

    assertCompany(profile.company_id);
    const response = await handleOp(
      supabase,
      userId,
      profile.company_id,
      profile.roles,
      parsed.data,
    );
    await logCompletedRequest(opLog, startedAt, response);
    return response;
  } catch (e) {
    if (e instanceof Response) {
      writeLog(e.status >= 500 ? "error" : "warn", "integrations_api.response_error", {
        ...baseLog,
        status: e.status,
        durationMs: Date.now() - startedAt,
      });
      return e;
    }

    writeLog("error", "integrations_api.unhandled_error", {
      ...baseLog,
      durationMs: Date.now() - startedAt,
      error: serializeError(e),
    });
    const message = e instanceof Error ? e.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
