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

const nodeSchema = z.object({
  id: z.string().min(1).max(120),
  type: z.enum([
    "trigger",
    "condition",
    "action",
    "approval",
    "delay",
    "subworkflow",
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
  }),
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

async function executeWorkflowRun(
  supabase: SupabaseClient,
  companyId: string,
  userId: string,
  workflowId: string,
  runId: string,
  def: WorkflowDefinition,
  testMode: boolean,
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

    if (node.type === "delay") {
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
          "id, company_id, name, definition, status, owner_user_id, department_id, created_at, updated_at",
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
