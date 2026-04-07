/**
 * Workflows & Automation API — definitions, runs, validation, simulated execution, activity log, approvals.
 * Client: supabase.functions.invoke('workflows-api', { body: { op, ... } }).
 * Secrets: SUPABASE_URL, SUPABASE_ANON_KEY (user JWT forwarded in Authorization).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";
import { corsHeaders } from "../_shared/cors.ts";
import { redactPayloadJson } from "../_shared/activity-log-redact.ts";
import {
  dequeueConnectorEvents,
  enqueueConnectorEvent,
  markConnectorEventFailed,
  markConnectorEventProcessed,
  toolsExecute,
  type ConnectorEventQueueRow,
  type ProviderKey,
} from "../_shared/integrations-runtime.ts";

const providerKeySchema = z.enum([
  "slack",
  "google_drive",
  "gmail",
  "google_calendar",
  "hubspot",
  "quickbooks",
]);

const nodeSchema = z.object({
  id: z.string().min(1).max(120),
  type: z.enum([
    "trigger",
    "condition",
    "action",
    "approval",
    "delay",
    "subworkflow",
    "branch",
    "loop",
  ]),
  label: z.string().max(200).optional(),
  config: z.record(z.unknown()).default({}),
  next: z.array(z.string()).default([]),
  position: z
    .object({ x: z.number(), y: z.number() })
    .optional(),
});

const workflowDefinitionSchema = z.object({
  version: z.number().int().positive().optional(),
  nodes: z.array(nodeSchema).default([]),
  schedule: z
    .object({
      cronExpression: z.string().optional(),
      timezone: z.string().optional(),
      nextRunAt: z.string().optional(),
    })
    .optional(),
  policies: z
    .object({
      maxRetries: z.number().int().min(0).max(20).optional(),
      backoffMs: z.number().int().min(0).optional(),
      alertOnFailure: z.boolean().optional(),
    })
    .optional(),
});

const opSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("workflows.list"),
    status: z.string().optional(),
    search: z.string().optional(),
    departmentId: z.string().uuid().optional(),
  }),
  z.object({ op: z.literal("workflows.get"), id: z.string().uuid() }),
  z.object({
    op: z.literal("workflows.create"),
    name: z.string().min(1).max(200),
    definition: workflowDefinitionSchema,
    status: z.enum(["draft", "active", "paused", "Draft", "Active", "Paused"]).optional(),
    departmentId: z.string().uuid().nullable().optional(),
  }),
  z.object({
    op: z.literal("workflows.update"),
    id: z.string().uuid(),
    name: z.string().min(1).max(200).optional(),
    definition: workflowDefinitionSchema.optional(),
    status: z.enum(["draft", "active", "paused", "Draft", "Active", "Paused"]).optional(),
    departmentId: z.string().uuid().nullable().optional(),
  }),
  z.object({ op: z.literal("workflows.delete"), id: z.string().uuid() }),
  z.object({
    op: z.literal("workflows.validate"),
    definition: workflowDefinitionSchema,
  }),
  z.object({
    op: z.literal("workflows.run"),
    workflowId: z.string().uuid(),
    testMode: z.boolean().optional(),
    correlationId: z.string().max(200).optional(),
    departmentId: z.string().uuid().optional(),
    inputPayload: z.record(z.unknown()).optional(),
  }),
  z.object({
    op: z.literal("workflows.schedule"),
    workflowId: z.string().uuid(),
    cronExpression: z.string().max(200).optional(),
    timezone: z.string().max(80).optional(),
  }),
  z.object({
    op: z.literal("workflowRuns.retry"),
    runId: z.string().uuid(),
  }),
  z.object({
    op: z.literal("workflowRuns.cancel"),
    runId: z.string().uuid(),
  }),
  z.object({ op: z.literal("libraries.list") }),
  z.object({
    op: z.literal("workflowRuns.list"),
    workflowId: z.string().uuid().optional(),
    status: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    limit: z.number().int().positive().max(100).optional(),
    offset: z.number().int().min(0).optional(),
  }),
  z.object({ op: z.literal("workflowRuns.get"), id: z.string().uuid() }),
  z.object({
    op: z.literal("workflowRuns.appendLogs"),
    id: z.string().uuid(),
    entries: z.array(z.record(z.unknown())).min(1).max(50),
  }),
  z.object({
    op: z.literal("activityLog.list"),
    actionType: z.string().optional(),
    departmentId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    limit: z.number().int().positive().max(200).optional(),
    offset: z.number().int().min(0).optional(),
  }),
  z.object({
    op: z.literal("approvals.list"),
    runId: z.string().uuid().optional(),
    decision: z.string().optional(),
  }),
  z.object({
    op: z.literal("approvals.submit"),
    runId: z.string().uuid(),
    decision: z.enum(["approved", "rejected"]),
    notes: z.string().max(2000).optional(),
  }),
  z.object({
    op: z.literal("connectorEvents.enqueue"),
    providerKey: providerKeySchema,
    connectorId: z.string().uuid().optional(),
    eventType: z.string().min(2).max(120),
    externalEventId: z.string().min(2).max(300),
    payload: z.record(z.unknown()),
    availableAt: z.string().datetime().optional(),
  }),
  z.object({
    op: z.literal("connectorEvents.process"),
    limit: z.number().int().positive().max(100).optional(),
  }),
]);

type ParsedOp = z.infer<typeof opSchema>;
type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;

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

function normalizeStatus(s: string): string {
  const lower = s.toLowerCase();
  if (lower === "draft" || lower === "active" || lower === "paused") return lower;
  return s;
}

function canMutateWorkflows(roles: string[]): boolean {
  const r = roles.map((x) => String(x).toLowerCase());
  return r.some((x) =>
    ["admin", "owner", "manager", "builder"].includes(x)
  );
}

type ValidationResult = {
  valid: boolean;
  errors: string[];
  topoOrder: string[];
};

function computeNextSchedulePreview(cronExpression: string | undefined): string | null {
  const c = cronExpression?.trim();
  if (!c) return null;
  const d = new Date();
  d.setUTCHours(d.getUTCHours() + 1);
  return d.toISOString();
}

function validateGraph(def: WorkflowDefinition): ValidationResult {
  const nodes = Array.isArray(def.nodes) ? def.nodes : [];
  const errors: string[] = [];
  if (nodes.length === 0) {
    return { valid: false, errors: ["Add at least one node"], topoOrder: [] };
  }
  const idSet = new Set(nodes.map((n) => n.id));
  const triggers = nodes.filter((n) => n.type === "trigger");
  if (triggers.length === 0) {
    errors.push("At least one Trigger node is required");
  }

  const adj = new Map<string, string[]>();
  for (const n of nodes) {
    const next = Array.isArray(n.next) ? n.next : [];
    const filtered = next.filter((id) => idSet.has(id));
    if (next.length !== filtered.length) {
      errors.push(`Node "${n.id}" references unknown next step(s)`);
    }
    adj.set(n.id, filtered);
  }

  const visited = new Set<string>();
  const stack = new Set<string>();
  const dfs = (u: string): boolean => {
    if (stack.has(u)) {
      errors.push(`Cycle detected at node "${u}"`);
      return false;
    }
    if (visited.has(u)) return true;
    visited.add(u);
    stack.add(u);
    for (const v of adj.get(u) ?? []) {
      if (!dfs(v)) {
        stack.delete(u);
        return false;
      }
    }
    stack.delete(u);
    return true;
  };
  for (const n of nodes) {
    if (!visited.has(n.id)) dfs(n.id);
  }

  const reachable = new Set<string>();
  const reach = (u: string) => {
    if (reachable.has(u)) return;
    reachable.add(u);
    for (const v of adj.get(u) ?? []) reach(v);
  };
  for (const t of triggers) reach(t.id);
  for (const n of nodes) {
    if (!reachable.has(n.id)) {
      errors.push(
        `Node "${n.label ?? n.id}" is not reachable from any trigger`,
      );
    }
  }

  const inDegree = new Map<string, number>();
  for (const n of nodes) inDegree.set(n.id, 0);
  for (const [, outs] of adj) {
    for (const t of outs) {
      inDegree.set(t, (inDegree.get(t) ?? 0) + 1);
    }
  }
  const queue: string[] = [];
  for (const n of nodes) {
    if ((inDegree.get(n.id) ?? 0) === 0) queue.push(n.id);
  }
  const topoOrder: string[] = [];
  while (queue.length) {
    const u = queue.shift()!;
    topoOrder.push(u);
    for (const v of adj.get(u) ?? []) {
      const nextDeg = (inDegree.get(v) ?? 0) - 1;
      inDegree.set(v, nextDeg);
      if (nextDeg === 0) queue.push(v);
    }
  }
  if (topoOrder.length !== nodes.length) {
    errors.push("Graph has cycles or invalid ordering");
  }

  const valid = errors.length === 0;
  return { valid, errors: [...new Set(errors)], topoOrder };
}

function canViewFullActivityPayload(roles: string[]): boolean {
  const r = roles.map((x) => String(x).toLowerCase());
  return r.some((x) =>
    ["admin", "owner", "super_admin", "auditor", "manager"].includes(x)
  );
}

function mapActivityRowForViewer(
  row: Record<string, unknown>,
  fullPayload: boolean,
): Record<string, unknown> {
  const payload = row.payload;
  const redacted = row.redacted_payload ?? redactPayloadJson(payload);
  return {
    ...row,
    payload: fullPayload ? payload : (redacted ?? {}),
  };
}

async function insertActivity(
  supabase: SupabaseClient,
  companyId: string,
  eventType: string,
  actorUserId: string | null,
  payload: Record<string, unknown>,
  related?: { entity: string; id: string; departmentId?: string | null },
) {
  const redacted = redactPayloadJson(payload) as Record<string, unknown>;
  const row: Record<string, unknown> = {
    company_id: companyId,
    event_type: eventType,
    actor_user_id: actorUserId,
    payload,
    redacted_payload: redacted,
    metadata: { source: "workflows-api" },
  };
  if (related?.entity) row.related_entity = related.entity;
  if (related?.id) row.related_id = related.id;
  if (related?.departmentId) row.department_id = related.departmentId;
  if (related?.entity === "workflow_run" && related.id) {
    row.workflow_run_id = related.id;
  }
  await supabase.from("activity_logs").insert(row);
}

async function readLogs(supabase: SupabaseClient, runId: string): Promise<unknown[]> {
  const { data, error } = await supabase
    .from("workflow_runs")
    .select("logs")
    .eq("id", runId)
    .maybeSingle();
  if (error) throw error;
  const raw = data?.logs;
  return Array.isArray(raw) ? raw : [];
}

async function appendRunLogs(
  supabase: SupabaseClient,
  runId: string,
  entries: Record<string, unknown>[],
) {
  const existing = await readLogs(supabase, runId);
  const next = [...existing, ...entries];
  const { error } = await supabase
    .from("workflow_runs")
    .update({ logs: next, updated_at: new Date().toISOString() })
    .eq("id", runId);
  if (error) throw error;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function workflowMatchesProviderEvent(
  def: WorkflowDefinition,
  providerKey: string,
  eventType: string,
): boolean {
  const nodes = Array.isArray(def.nodes) ? def.nodes : [];
  for (const node of nodes) {
    if (node.type !== "trigger") continue;
    const cfg = asRecord(node.config);
    const kind = String(cfg.kind ?? "").toLowerCase();
    if (kind !== "provider_event") continue;
    const p = String(cfg.providerKey ?? cfg.provider ?? "").toLowerCase();
    const e = String(cfg.eventType ?? "").toLowerCase();
    if (p !== providerKey.toLowerCase()) continue;
    if (e && e !== eventType.toLowerCase()) continue;
    return true;
  }
  return false;
}

async function executeWorkflowRun(
  supabase: SupabaseClient,
  companyId: string,
  userId: string,
  workflowId: string,
  runId: string,
  def: WorkflowDefinition,
  testMode: boolean,
  roles: string[],
  inputPayload?: Record<string, unknown>,
) {
  const validation = validateGraph(def);
  if (!validation.valid) {
    await supabase
      .from("workflow_runs")
      .update({
        status: "Failed",
        finished_at: new Date().toISOString(),
        result_metadata: { validationErrors: validation.errors },
        updated_at: new Date().toISOString(),
      })
      .eq("id", runId);
    await insertActivity(supabase, companyId, "workflow_run", userId, {
      workflowId,
      runId,
      status: "Failed",
      reason: "invalid_definition",
      errors: validation.errors,
    }, { entity: "workflow_run", id: runId });
    return;
  }

  const nodes = Array.isArray(def.nodes) ? def.nodes : [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const order = validation.topoOrder.length
    ? validation.topoOrder
    : nodes.map((n) => n.id);

  for (const stepId of order) {
    const node = nodeById.get(stepId);
    if (!node) continue;
    const ts = new Date().toISOString();
    await appendRunLogs(supabase, runId, [
      {
        ts,
        level: "info",
        stepId,
        stepStatus: "running",
        message: `Executing ${node.type}: ${node.label ?? stepId}`,
      },
    ]);

    if (node.type === "approval") {
      const cfg = node.config && typeof node.config === "object"
        ? node.config as Record<string, unknown>
        : {};
      const dueHours = typeof cfg.dueByHours === "number" && cfg.dueByHours > 0
        ? cfg.dueByHours
        : 24;
      const dueBy = new Date(Date.now() + dueHours * 3600_000).toISOString();
      const approverIds = Array.isArray(cfg.approverUserIds)
        ? cfg.approverUserIds.map((x) => String(x))
        : [];
      await supabase
        .from("workflow_runs")
        .update({
          status: "WaitingApproval",
          updated_at: new Date().toISOString(),
        })
        .eq("id", runId);
      await supabase.from("workflow_approvals").insert({
        run_id: runId,
        step_id: stepId,
        decision: "pending",
        due_by: dueBy,
        approvers: approverIds,
      });
      await appendRunLogs(supabase, runId, [
        {
          ts: new Date().toISOString(),
          level: "info",
          stepId,
          stepStatus: "waiting_approval",
          message: testMode
            ? "Test run: approval gate (no notification sent)"
            : "Awaiting human approval",
        },
      ]);
      await insertActivity(supabase, companyId, "workflow_run", userId, {
        workflowId,
        runId,
        stepId,
        status: "waiting_approval",
        testMode,
      }, { entity: "workflow_run", id: runId });
      return;
    }

    if (node.type === "action") {
      const cfg = asRecord(node.config);
      const toolId = typeof cfg.toolId === "string"
        ? cfg.toolId
        : typeof cfg.actionId === "string"
          ? cfg.actionId
          : "";
      if (!toolId) {
        await appendRunLogs(supabase, runId, [
          {
            ts: new Date().toISOString(),
            level: "info",
            stepId,
            stepStatus: "success",
            message: "Action placeholder executed (no toolId configured)",
          },
        ]);
      } else {
        const masterKey = Deno.env.get("CREDENTIALS_MASTER_KEY");
        if (!masterKey) throw new Error("Server missing CREDENTIALS_MASTER_KEY");
        const args = asRecord(cfg.args);
        if (Object.keys(args).length === 0) {
          for (const [k, v] of Object.entries(cfg)) {
            if (["toolId", "actionId", "kind", "providerKey", "provider", "eventType"].includes(k)) {
              continue;
            }
            args[k] = v;
          }
        }
        if (inputPayload && Object.keys(inputPayload).length > 0 && args.payload === undefined) {
          args.payload = inputPayload;
        }
        const exec = await toolsExecute(supabase, {
          companyId,
          userId,
          roles,
          toolId,
          args,
          confirmed: true,
          workflowRunId: runId,
          source: "workflow",
          masterKey,
        });
        if (exec.pendingConfirmation) {
          throw new Error(`Workflow tool requires confirmation: ${toolId}`);
        }
        await appendRunLogs(supabase, runId, [
          {
            ts: new Date().toISOString(),
            level: "info",
            stepId,
            stepStatus: "success",
            message: `Executed tool ${toolId}`,
            toolResult: exec.result ?? {},
          },
        ]);
      }
    } else if (node.type === "delay") {
      await appendRunLogs(supabase, runId, [
        {
          ts: new Date().toISOString(),
          level: "info",
          stepId,
          stepStatus: "success",
          message: "Delay step recorded (scheduler would wait here)",
        },
      ]);
    } else if (node.type === "subworkflow") {
      await appendRunLogs(supabase, runId, [
        {
          ts: new Date().toISOString(),
          level: "info",
          stepId,
          stepStatus: "success",
          message: "Sub-workflow placeholder executed",
        },
      ]);
    } else if (node.type === "branch") {
      await appendRunLogs(supabase, runId, [
        {
          ts: new Date().toISOString(),
          level: "info",
          stepId,
          stepStatus: "success",
          message: "Branch evaluated (runtime router placeholder)",
        },
      ]);
    } else if (node.type === "loop") {
      await appendRunLogs(supabase, runId, [
        {
          ts: new Date().toISOString(),
          level: "info",
          stepId,
          stepStatus: "success",
          message: "Loop iteration boundary (scheduler would iterate)",
        },
      ]);
    } else {
      await appendRunLogs(supabase, runId, [
        {
          ts: new Date().toISOString(),
          level: "info",
          stepId,
          stepStatus: "success",
          message: `Completed ${node.type}`,
        },
      ]);
    }
  }

  const finished = new Date().toISOString();
  await supabase
    .from("workflow_runs")
    .update({
      status: "Completed",
      finished_at: finished,
      result_metadata: {
        stepsExecuted: order.length,
        completedAt: finished,
        testMode,
      },
      updated_at: finished,
    })
    .eq("id", runId);

  await insertActivity(supabase, companyId, "workflow_run", userId, {
    workflowId,
    runId,
    status: "Completed",
    testMode,
  }, { entity: "workflow_run", id: runId });
}

async function findActiveWorkflowsForEvent(
  supabase: SupabaseClient,
  companyId: string,
  providerKey: string,
  eventType: string,
): Promise<Array<{ id: string; definition: WorkflowDefinition; departmentId: string | null }>> {
  const { data, error } = await supabase
    .from("workflows")
    .select("id, definition, status, department_id")
    .eq("company_id", companyId);
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  const matches: Array<{ id: string; definition: WorkflowDefinition; departmentId: string | null }> = [];
  for (const row of rows) {
    const status = String(row.status ?? "").toLowerCase();
    if (status !== "active") continue;
    const parsed = workflowDefinitionSchema.safeParse(row.definition);
    if (!parsed.success) continue;
    if (!workflowMatchesProviderEvent(parsed.data, providerKey, eventType)) continue;
    matches.push({
      id: String(row.id),
      definition: parsed.data,
      departmentId: row.department_id ? String(row.department_id) : null,
    });
  }
  return matches;
}

async function processConnectorEventsQueue(
  supabase: SupabaseClient,
  params: {
    companyId: string;
    userId: string;
    roles: string[];
    limit: number;
  },
): Promise<{
  processed: number;
  failed: number;
  runsStarted: number;
}> {
  const events = await dequeueConnectorEvents(supabase, params.companyId, params.limit);
  let processed = 0;
  let failed = 0;
  let runsStarted = 0;

  for (const event of events) {
    try {
      const matches = await findActiveWorkflowsForEvent(
        supabase,
        params.companyId,
        String(event.provider_key),
        String(event.event_type),
      );
      for (const wf of matches) {
        const now = new Date().toISOString();
        const inputPayload = {
          triggerEvent: {
            id: event.id,
            providerKey: event.provider_key,
            eventType: event.event_type,
            externalEventId: event.external_event_id,
            payload: event.payload,
            createdAt: event.created_at,
          },
        };
        const { data: runRow, error: runErr } = await supabase
          .from("workflow_runs")
          .insert({
            workflow_id: wf.id,
            status: "Running",
            started_at: now,
            logs: [{
              ts: now,
              level: "info",
              message: `Triggered by ${event.provider_key}:${event.event_type}`,
            }],
            test_mode: false,
            correlation_id: `${event.provider_key}:${event.external_event_id}`,
            input_payload: inputPayload,
          })
          .select("id")
          .single();
        if (runErr || !runRow?.id) throw runErr ?? new Error("Failed to start triggered run");
        await executeWorkflowRun(
          supabase,
          params.companyId,
          params.userId,
          wf.id,
          String(runRow.id),
          wf.definition,
          false,
          params.roles,
          inputPayload,
        );
        runsStarted += 1;
      }
      await markConnectorEventProcessed(supabase, event.id);
      processed += 1;
    } catch (error) {
      failed += 1;
      const msg = error instanceof Error ? error.message : "Event processing failed";
      await markConnectorEventFailed(supabase, event.id, msg);
    }
  }

  return { processed, failed, runsStarted };
}

async function handleOp(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
  roles: string[],
  body: ParsedOp,
): Promise<Response> {
  const mutate = canMutateWorkflows(roles);

  switch (body.op) {
    case "workflows.list": {
      let q = supabase
        .from("workflows")
        .select(
          "id, company_id, name, definition, status, owner_user_id, department_id, next_run_at, created_at, updated_at",
        )
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false });
      if (body.status) {
        q = q.eq("status", normalizeStatus(body.status));
      }
      const { data, error } = await q;
      if (error) return json({ error: error.message }, 400);
      const rows = Array.isArray(data) ? data : [];
      const search = body.search?.trim().toLowerCase();
      let scoped = rows;
      if (body.departmentId) {
        scoped = rows.filter((r) => {
          const did = r.department_id as string | null | undefined;
          return did === body.departmentId || did === null || did === undefined;
        });
      }
      const filtered = search
        ? scoped.filter((r) =>
          String(r.name ?? "").toLowerCase().includes(search)
        )
        : scoped;
      return json({ data: filtered });
    }
    case "workflows.get": {
      const { data, error } = await supabase
        .from("workflows")
        .select("*")
        .eq("id", body.id)
        .eq("company_id", companyId)
        .maybeSingle();
      if (error) return json({ error: error.message }, 400);
      if (!data) return json({ error: "Not found" }, 404);
      return json({ data });
    }
    case "workflows.create": {
      if (!mutate) return json({ error: "Forbidden" }, 403);
      const status = body.status ? normalizeStatus(body.status) : "draft";
      const parsedDef = workflowDefinitionSchema.parse(body.definition);
      const v = validateGraph(parsedDef);
      if (!v.valid) {
        return json({ error: "Invalid definition", details: v.errors }, 422);
      }
      let deptId: string | null = null;
      if (body.departmentId !== undefined && body.departmentId !== null) {
        const { data: drow } = await supabase
          .from("departments")
          .select("id")
          .eq("id", body.departmentId)
          .eq("company_id", companyId)
          .maybeSingle();
        if (!drow?.id) {
          return json({ error: "Department not found in tenant" }, 400);
        }
        deptId = body.departmentId;
      }

      const { data, error } = await supabase
        .from("workflows")
        .insert({
          company_id: companyId,
          name: body.name,
          definition: parsedDef as unknown as Record<string, unknown>,
          status,
          owner_user_id: userId,
          department_id: deptId,
        })
        .select("*")
        .single();
      if (error) return json({ error: error.message }, 400);
      await insertActivity(supabase, companyId, "user_action", userId, {
        action: "workflow.create",
        workflowId: data?.id,
      }, data?.id ? { entity: "workflow", id: data.id } : undefined);
      return json({ data });
    }
    case "workflows.update": {
      if (!mutate) return json({ error: "Forbidden" }, 403);
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.name !== undefined) patch.name = body.name;
      if (body.status !== undefined) patch.status = normalizeStatus(body.status);
      if (body.departmentId !== undefined) {
        if (body.departmentId === null) {
          patch.department_id = null;
        } else {
          const { data: drow } = await supabase
            .from("departments")
            .select("id")
            .eq("id", body.departmentId)
            .eq("company_id", companyId)
            .maybeSingle();
          if (!drow?.id) {
            return json({ error: "Department not found in tenant" }, 400);
          }
          patch.department_id = body.departmentId;
        }
      }
      if (body.definition !== undefined) {
        const parsedDef = workflowDefinitionSchema.parse(body.definition);
        const v = validateGraph(parsedDef);
        if (!v.valid) {
          return json({ error: "Invalid definition", details: v.errors }, 422);
        }
        patch.definition = parsedDef;
      }
      const { data, error } = await supabase
        .from("workflows")
        .update(patch)
        .eq("id", body.id)
        .eq("company_id", companyId)
        .select("*")
        .maybeSingle();
      if (error) return json({ error: error.message }, 400);
      if (!data) return json({ error: "Not found" }, 404);
      await insertActivity(supabase, companyId, "user_action", userId, {
        action: "workflow.update",
        workflowId: body.id,
      }, { entity: "workflow", id: body.id });
      return json({ data });
    }
    case "workflows.delete": {
      if (!mutate) return json({ error: "Forbidden" }, 403);
      const { error } = await supabase
        .from("workflows")
        .delete()
        .eq("id", body.id)
        .eq("company_id", companyId);
      if (error) return json({ error: error.message }, 400);
      await insertActivity(supabase, companyId, "user_action", userId, {
        action: "workflow.delete",
        workflowId: body.id,
      }, { entity: "workflow", id: body.id });
      return json({ data: { ok: true } });
    }
    case "workflows.validate": {
      const parsedDef = workflowDefinitionSchema.parse(body.definition);
      const v = validateGraph(parsedDef);
      return json({ data: v });
    }
    case "workflows.run": {
      if (!mutate) return json({ error: "Forbidden" }, 403);
      const { data: wf, error: wfErr } = await supabase
        .from("workflows")
        .select("id, definition, status, department_id")
        .eq("id", body.workflowId)
        .eq("company_id", companyId)
        .maybeSingle();
      if (wfErr) return json({ error: wfErr.message }, 400);
      if (!wf) return json({ error: "Workflow not found" }, 404);

      const wfDept = wf.department_id as string | null | undefined;
      if (wfDept && body.departmentId && wfDept !== body.departmentId) {
        return json({ error: "Workflow is not in this department scope" }, 403);
      }
      if (wfDept && !body.departmentId) {
        return json({ error: "departmentId required for department-scoped workflow" }, 400);
      }

      const rawDef = wf.definition;
      const parsedDef = workflowDefinitionSchema.safeParse(rawDef);
      if (!parsedDef.success) {
        return json({ error: "Stored definition is invalid" }, 422);
      }
      const v = validateGraph(parsedDef.data);
      if (!v.valid) {
        return json({ error: "Invalid graph", details: v.errors }, 422);
      }

      const now = new Date().toISOString();
      const testMode = Boolean(body.testMode);
      const inputPayload = body.inputPayload && typeof body.inputPayload === "object"
        ? body.inputPayload
        : {};
      const { data: runRow, error: runErr } = await supabase
        .from("workflow_runs")
        .insert({
          workflow_id: body.workflowId,
          status: "Running",
          started_at: now,
          logs: [
            {
              ts: now,
              level: "info",
              message: testMode ? "Test run started" : "Run started",
            },
          ],
          test_mode: testMode,
          correlation_id: body.correlationId ?? null,
          input_payload: inputPayload,
        })
        .select("*")
        .single();
      if (runErr) return json({ error: runErr.message }, 400);
      const runId = runRow?.id as string;

      try {
        await executeWorkflowRun(
          supabase,
          companyId,
          userId,
          body.workflowId,
          runId,
          parsedDef.data,
          testMode,
          roles,
          inputPayload as Record<string, unknown>,
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Execution failed";
        await supabase
          .from("workflow_runs")
          .update({
            status: "Failed",
            finished_at: new Date().toISOString(),
            result_metadata: { error: msg },
            updated_at: new Date().toISOString(),
          })
          .eq("id", runId);
        await insertActivity(supabase, companyId, "system_alert", userId, {
          workflowId: body.workflowId,
          runId,
          message: msg,
        }, { entity: "workflow_run", id: runId });
      }

      const { data: finalRun } = await supabase
        .from("workflow_runs")
        .select("*")
        .eq("id", runId)
        .maybeSingle();
      return json({ data: finalRun });
    }
    case "workflowRuns.list": {
      let q = supabase
        .from("workflow_runs")
        .select("*")
        .order("created_at", { ascending: false });
      if (body.workflowId) q = q.eq("workflow_id", body.workflowId);
      if (body.status) q = q.eq("status", body.status);
      if (body.from) q = q.gte("created_at", body.from);
      if (body.to) q = q.lte("created_at", body.to);
      const limit = body.limit ?? 50;
      const offset = body.offset ?? 0;
      q = q.range(offset, offset + limit - 1);
      const { data, error } = await q;
      if (error) return json({ error: error.message }, 400);
      return json({ data: Array.isArray(data) ? data : [] });
    }
    case "workflowRuns.get": {
      const { data, error } = await supabase
        .from("workflow_runs")
        .select("*")
        .eq("id", body.id)
        .maybeSingle();
      if (error) return json({ error: error.message }, 400);
      if (!data) return json({ error: "Not found" }, 404);
      return json({ data });
    }
    case "workflowRuns.appendLogs": {
      if (!mutate) return json({ error: "Forbidden" }, 403);
      const { data: existing } = await supabase
        .from("workflow_runs")
        .select("id")
        .eq("id", body.id)
        .maybeSingle();
      if (!existing) {
        return json({ error: "Not found" }, 404);
      }
      const entries = Array.isArray(body.entries) ? body.entries : [];
      await appendRunLogs(supabase, body.id, entries as Record<string, unknown>[]);
      const { data: updated } = await supabase
        .from("workflow_runs")
        .select("*")
        .eq("id", body.id)
        .maybeSingle();
      return json({ data: updated });
    }
    case "activityLog.list": {
      let q = supabase
        .from("activity_logs")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (body.actionType) q = q.eq("event_type", body.actionType);
      if (body.departmentId) q = q.eq("department_id", body.departmentId);
      if (body.userId) q = q.eq("actor_user_id", body.userId);
      if (body.from) q = q.gte("created_at", body.from);
      if (body.to) q = q.lte("created_at", body.to);
      const limit = body.limit ?? 50;
      const offset = body.offset ?? 0;
      q = q.range(offset, offset + limit - 1);
      const { data, error } = await q;
      if (error) return json({ error: error.message }, 400);
      const rows = Array.isArray(data) ? data : [];
      const full = canViewFullActivityPayload(roles);
      const mapped = rows.map((r) =>
        mapActivityRowForViewer(r as Record<string, unknown>, full)
      );
      return json({ data: mapped });
    }
    case "approvals.list": {
      let q = supabase
        .from("workflow_approvals")
        .select("*")
        .order("created_at", { ascending: false });
      if (body.runId) q = q.eq("run_id", body.runId);
      if (body.decision) q = q.eq("decision", body.decision);
      const { data, error } = await q;
      if (error) return json({ error: error.message }, 400);
      return json({ data: Array.isArray(data) ? data : [] });
    }
    case "approvals.submit": {
      if (!mutate) return json({ error: "Forbidden" }, 403);
      const { data: runRow, error: runErr } = await supabase
        .from("workflow_runs")
        .select("id, status")
        .eq("id", body.runId)
        .maybeSingle();
      const run = runRow as { status?: string } | null;
      if (runErr || !run) {
        return json({ error: "Run not found" }, 404);
      }
      if (run.status !== "WaitingApproval") {
        return json({ error: "Run is not waiting for approval" }, 400);
      }
      const decidedAt = new Date().toISOString();
      const { data: pendingRow, error: pendingErr } = await supabase
        .from("workflow_approvals")
        .select("id")
        .eq("run_id", body.runId)
        .eq("decision", "pending")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (pendingErr) return json({ error: pendingErr.message }, 400);
      if (!pendingRow?.id) {
        return json({ error: "No pending approval for this run" }, 400);
      }
      const { error: upErr } = await supabase
        .from("workflow_approvals")
        .update({
          approver_user_id: userId,
          decision: body.decision,
          notes: body.notes ?? null,
          decided_at: decidedAt,
        })
        .eq("id", pendingRow.id);
      if (upErr) return json({ error: upErr.message }, 400);

      const nextStatus = body.decision === "approved" ? "Completed" : "Failed";
      await supabase
        .from("workflow_runs")
        .update({
          status: nextStatus,
          finished_at: decidedAt,
          result_metadata: { approvalDecision: body.decision },
          updated_at: decidedAt,
        })
        .eq("id", body.runId);

      await appendRunLogs(supabase, body.runId, [
        {
          ts: decidedAt,
          level: "info",
          message: `Approval ${body.decision}`,
        },
      ]);

      await insertActivity(supabase, companyId, "user_action", userId, {
        action: "workflow.approval",
        runId: body.runId,
        decision: body.decision,
      }, { entity: "workflow_run", id: body.runId });

      const { data: updated } = await supabase
        .from("workflow_runs")
        .select("*")
        .eq("id", body.runId)
        .maybeSingle();
      return json({ data: updated });
    }
    case "connectorEvents.enqueue": {
      if (!mutate) return json({ error: "Forbidden" }, 403);
      const result = await enqueueConnectorEvent(supabase, companyId, {
        providerKey: body.providerKey as ProviderKey,
        connectorId: body.connectorId ?? null,
        eventType: body.eventType,
        externalEventId: body.externalEventId,
        payload: body.payload,
        availableAt: body.availableAt,
      });
      await insertActivity(supabase, companyId, "workflow_trigger", userId, {
        action: "connector_event.enqueue",
        providerKey: body.providerKey,
        eventType: body.eventType,
        queueId: result.id,
      });
      return json({ data: { ok: true, ...result } });
    }
    case "connectorEvents.process": {
      if (!mutate) return json({ error: "Forbidden" }, 403);
      const outcome = await processConnectorEventsQueue(supabase, {
        companyId,
        userId,
        roles,
        limit: body.limit ?? 25,
      });
      await insertActivity(supabase, companyId, "workflow_trigger", userId, {
        action: "connector_event.process",
        ...outcome,
      });
      return json({ data: outcome });
    }
    case "libraries.list": {
      const triggers = [
        { id: "tr-manual", type: "trigger", label: "Manual / UI", description: "Start from console or API", preset: { kind: "manual" } },
        { id: "tr-schedule", type: "trigger", label: "Schedule (cron)", description: "Time-based recurrence", preset: { kind: "schedule" } },
        {
          id: "tr-slack-message",
          type: "trigger",
          label: "Slack message event",
          description: "Runs when Slack message.created events are enqueued.",
          preset: { kind: "provider_event", providerKey: "slack", eventType: "message.created" },
        },
        {
          id: "tr-hubspot-contact",
          type: "trigger",
          label: "HubSpot contact event",
          description: "Runs for HubSpot contact sync/webhook events.",
          preset: { kind: "provider_event", providerKey: "hubspot", eventType: "contact.synced" },
        },
        {
          id: "tr-quickbooks-invoice",
          type: "trigger",
          label: "QuickBooks invoice event",
          description: "Runs when invoice events arrive from QuickBooks.",
          preset: { kind: "provider_event", providerKey: "quickbooks", eventType: "invoice.synced" },
        },
        {
          id: "tr-google-calendar",
          type: "trigger",
          label: "Google Calendar event",
          description: "Runs from normalized Google calendar poll events.",
          preset: { kind: "provider_event", providerKey: "google_calendar", eventType: "event.synced" },
        },
      ];
      const actions = [
        {
          id: "ac-slack-send",
          type: "action",
          label: "Slack send message",
          description: "Execute tool slack.send_message",
          preset: { toolId: "slack.send_message", args: { channel: "", text: "" } },
        },
        {
          id: "ac-drive-search",
          type: "action",
          label: "Drive search files",
          description: "Execute tool google_drive.search_files",
          preset: { toolId: "google_drive.search_files", args: { query: "", pageSize: 20 } },
        },
        {
          id: "ac-gmail-send",
          type: "action",
          label: "Gmail send email",
          description: "Execute tool gmail.send_email",
          preset: { toolId: "gmail.send_email", args: { to: "", subject: "", body: "" } },
        },
        {
          id: "ac-calendar-create",
          type: "action",
          label: "Calendar create event",
          description: "Execute tool google_calendar.create_event",
          preset: { toolId: "google_calendar.create_event", args: { summary: "", start: "", end: "" } },
        },
        {
          id: "ac-hubspot-upsert-contact",
          type: "action",
          label: "HubSpot upsert contact",
          description: "Execute tool hubspot.upsert_contact",
          preset: { toolId: "hubspot.upsert_contact", args: { email: "" } },
        },
        {
          id: "ac-hubspot-update-deal",
          type: "action",
          label: "HubSpot update deal stage",
          description: "Execute tool hubspot.update_deal_stage",
          preset: { toolId: "hubspot.update_deal_stage", args: { dealId: "", dealstage: "" } },
        },
        {
          id: "ac-qbo-reminder",
          type: "action",
          label: "QuickBooks send reminder",
          description: "Execute tool quickbooks.send_invoice_reminder",
          preset: { toolId: "quickbooks.send_invoice_reminder", args: { invoiceId: "" } },
        },
      ];
      const logic = [
        { id: "lg-condition", type: "condition", label: "If / else", description: "Boolean gate on payload", preset: { expression: "payload.status == 'open'" } },
        { id: "lg-branch", type: "branch", label: "Multi-branch", description: "Route by rules", preset: { mode: "first-match" } },
        { id: "lg-loop", type: "loop", label: "Loop", description: "Iterate collection", preset: { collectionPath: "items" } },
        { id: "lg-delay", type: "delay", label: "Delay", description: "Wait before next step", preset: { seconds: 60 } },
        { id: "lg-approval", type: "approval", label: "Approval gate", description: "Human decision + SLA", preset: { dueByHours: 24, approverUserIds: [] } },
      ];
      return json({ data: { triggers, actions, logic } });
    }
    case "workflows.schedule": {
      if (!mutate) return json({ error: "Forbidden" }, 403);
      const { data: wf, error: wfErr } = await supabase
        .from("workflows")
        .select("id, definition")
        .eq("id", body.workflowId)
        .eq("company_id", companyId)
        .maybeSingle();
      if (wfErr) return json({ error: wfErr.message }, 400);
      if (!wf) return json({ error: "Workflow not found" }, 404);
      const rawDef = wf.definition;
      const parsed = workflowDefinitionSchema.safeParse(rawDef);
      if (!parsed.success) {
        return json({ error: "Stored definition is invalid" }, 422);
      }
      const cron =
        body.cronExpression ?? parsed.data.schedule?.cronExpression ?? "";
      const timezone = body.timezone ?? parsed.data.schedule?.timezone ?? "UTC";
      const nextRunAt = computeNextSchedulePreview(cron);
      const merged: WorkflowDefinition = {
        ...parsed.data,
        schedule: {
          ...parsed.data.schedule,
          cronExpression: cron,
          timezone,
          nextRunAt: nextRunAt ?? undefined,
        },
      };
      const { data: updated, error: upErr } = await supabase
        .from("workflows")
        .update({
          definition: merged as unknown as Record<string, unknown>,
          next_run_at: nextRunAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.workflowId)
        .eq("company_id", companyId)
        .select("*")
        .maybeSingle();
      if (upErr) return json({ error: upErr.message }, 400);
      await insertActivity(supabase, companyId, "user_action", userId, {
        action: "workflow.schedule",
        workflowId: body.workflowId,
        nextRunAt,
      }, { entity: "workflow", id: body.workflowId });
      return json({ data: updated });
    }
    case "workflowRuns.retry": {
      if (!mutate) return json({ error: "Forbidden" }, 403);
      const { data: oldRun, error: oldErr } = await supabase
        .from("workflow_runs")
        .select("id, workflow_id, status, test_mode, correlation_id, retry_count")
        .eq("id", body.runId)
        .maybeSingle();
      if (oldErr) return json({ error: oldErr.message }, 400);
      if (!oldRun) return json({ error: "Run not found" }, 404);
      const st = String(oldRun.status ?? "");
      if (st !== "Failed" && st !== "Canceled") {
        return json({ error: "Only failed or canceled runs can be retried" }, 400);
      }
      const { data: wf, error: wfErr2 } = await supabase
        .from("workflows")
        .select("id, definition, department_id")
        .eq("id", oldRun.workflow_id as string)
        .eq("company_id", companyId)
        .maybeSingle();
      if (wfErr2 || !wf) return json({ error: "Workflow not found" }, 404);
      const parsedDef = workflowDefinitionSchema.safeParse(wf.definition);
      if (!parsedDef.success) {
        return json({ error: "Stored definition is invalid" }, 422);
      }
      const v = validateGraph(parsedDef.data);
      if (!v.valid) {
        return json({ error: "Invalid graph", details: v.errors }, 422);
      }
      const prevRetry = typeof oldRun.retry_count === "number" ? oldRun.retry_count : 0;
      const nextRetry = prevRetry + 1;
      const now2 = new Date().toISOString();
      const { data: newRun, error: insErr } = await supabase
        .from("workflow_runs")
        .insert({
          workflow_id: oldRun.workflow_id as string,
          status: "Running",
          started_at: now2,
          logs: [
            {
              ts: now2,
              level: "info",
              message: `Retry #${nextRetry} (from ${oldRun.id})`,
            },
          ],
          test_mode: Boolean(oldRun.test_mode),
          correlation_id: (oldRun.correlation_id as string | null) ?? null,
          retry_count: nextRetry,
          result_metadata: { parentRunId: oldRun.id },
          input_payload: {},
        })
        .select("*")
        .single();
      if (insErr) return json({ error: insErr.message }, 400);
      const newId = newRun?.id as string;
      try {
        await executeWorkflowRun(
          supabase,
          companyId,
          userId,
          oldRun.workflow_id as string,
          newId,
          parsedDef.data,
          Boolean(oldRun.test_mode),
          roles,
          {},
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Execution failed";
        await supabase
          .from("workflow_runs")
          .update({
            status: "Failed",
            finished_at: new Date().toISOString(),
            result_metadata: { error: msg },
            updated_at: new Date().toISOString(),
          })
          .eq("id", newId);
      }
      const { data: finalRun } = await supabase
        .from("workflow_runs")
        .select("*")
        .eq("id", newId)
        .maybeSingle();
      return json({ data: finalRun });
    }
    case "workflowRuns.cancel": {
      if (!mutate) return json({ error: "Forbidden" }, 403);
      const { data: runRow, error: rErr } = await supabase
        .from("workflow_runs")
        .select("id, status, workflow_id")
        .eq("id", body.runId)
        .maybeSingle();
      if (rErr) return json({ error: rErr.message }, 400);
      if (!runRow) return json({ error: "Not found" }, 404);
      const { data: wfCheck } = await supabase
        .from("workflows")
        .select("id")
        .eq("id", runRow.workflow_id as string)
        .eq("company_id", companyId)
        .maybeSingle();
      if (!wfCheck) return json({ error: "Forbidden" }, 403);
      if (String(runRow.status) !== "Running") {
        return json({ error: "Run is not active" }, 400);
      }
      const canceledAt = new Date().toISOString();
      await supabase
        .from("workflow_runs")
        .update({
          status: "Canceled",
          finished_at: canceledAt,
          updated_at: canceledAt,
          result_metadata: { canceled: true },
        })
        .eq("id", body.runId);
      await appendRunLogs(supabase, body.runId, [
        { ts: canceledAt, level: "info", message: "Run canceled by user" },
      ]);
      await insertActivity(supabase, companyId, "user_action", userId, {
        action: "workflow.run.cancel",
        runId: body.runId,
      }, { entity: "workflow_run", id: body.runId });
      const { data: updated } = await supabase
        .from("workflow_runs")
        .select("*")
        .eq("id", body.runId)
        .maybeSingle();
      return json({ data: updated });
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
