import { invokeWorkflowsApi } from "@/lib/workflows-api";
import type {
  ActivityLogEntryRow,
  WorkflowApprovalRow,
  WorkflowDefinition,
  WorkflowNode,
  WorkflowNodeType,
  WorkflowRow,
  WorkflowRunRow,
  WorkflowValidationResult,
} from "@/types/workflows";

function asWorkflowDefinition(raw: unknown): WorkflowDefinition {
  if (!raw || typeof raw !== "object") {
    return { nodes: [] };
  }
  const o = raw as Record<string, unknown>;
  const nodes = Array.isArray(o.nodes) ? o.nodes : [];
  return {
    version: typeof o.version === "number" ? o.version : undefined,
    schedule:
      o.schedule && typeof o.schedule === "object"
        ? (o.schedule as WorkflowDefinition["schedule"])
        : undefined,
    policies:
      o.policies && typeof o.policies === "object"
        ? (o.policies as WorkflowDefinition["policies"])
        : undefined,
    nodes: nodes
      .filter((n): n is Record<string, unknown> => !!n && typeof n === "object")
      .map((n): WorkflowNode => ({
        id: String(n.id ?? ""),
        type: n.type as WorkflowNodeType,
        label: typeof n.label === "string" ? n.label : undefined,
        config:
          n.config && typeof n.config === "object"
            ? (n.config as Record<string, unknown>)
            : {},
        next: Array.isArray(n.next)
          ? n.next.map((x) => String(x))
          : [],
        position:
          n.position &&
          typeof n.position === "object" &&
          typeof (n.position as { x?: unknown }).x === "number" &&
          typeof (n.position as { y?: unknown }).y === "number"
            ? {
                x: (n.position as { x: number }).x,
                y: (n.position as { y: number }).y,
              }
            : undefined,
      })),
  };
}

export async function fetchWorkflows(params?: {
  status?: string;
  search?: string;
}): Promise<WorkflowRow[]> {
  const { data, error } = await invokeWorkflowsApi<WorkflowRow[]>({
    op: "workflows.list",
    status: params?.status,
    search: params?.search,
  });
  if (error) return [];
  const list = Array.isArray(data) ? data : [];
  return list.map((w) => ({
    ...w,
    definition: asWorkflowDefinition(w.definition),
  }));
}

export async function fetchWorkflow(id: string): Promise<WorkflowRow | null> {
  const { data, error } = await invokeWorkflowsApi<WorkflowRow>({
    op: "workflows.get",
    id,
  });
  if (error || !data) return null;
  return {
    ...data,
    definition: asWorkflowDefinition(data.definition),
  };
}

export async function createWorkflow(payload: {
  name: string;
  definition: WorkflowDefinition;
  status?: string;
}): Promise<WorkflowRow | null> {
  const { data, error } = await invokeWorkflowsApi<WorkflowRow>({
    op: "workflows.create",
    name: payload.name,
    definition: payload.definition,
    status: payload.status,
  });
  if (error || !data) return null;
  return {
    ...data,
    definition: asWorkflowDefinition(data.definition),
  };
}

export async function updateWorkflow(payload: {
  id: string;
  name?: string;
  definition?: WorkflowDefinition;
  status?: string;
}): Promise<WorkflowRow | null> {
  const { data, error } = await invokeWorkflowsApi<WorkflowRow>({
    op: "workflows.update",
    id: payload.id,
    name: payload.name,
    definition: payload.definition,
    status: payload.status,
  });
  if (error || !data) return null;
  return {
    ...data,
    definition: asWorkflowDefinition(data.definition),
  };
}

export async function deleteWorkflow(id: string): Promise<boolean> {
  const { error } = await invokeWorkflowsApi<{ ok: boolean }>({
    op: "workflows.delete",
    id,
  });
  return !error;
}

export async function validateWorkflowDefinition(
  definition: WorkflowDefinition,
): Promise<WorkflowValidationResult | null> {
  const { data, error } = await invokeWorkflowsApi<WorkflowValidationResult>({
    op: "workflows.validate",
    definition,
  });
  if (error || !data) return null;
  return {
    valid: Boolean(data.valid),
    errors: Array.isArray(data.errors) ? data.errors : [],
    topoOrder: Array.isArray(data.topoOrder) ? data.topoOrder : [],
  };
}

export async function runWorkflow(payload: {
  workflowId: string;
  testMode?: boolean;
  correlationId?: string;
}): Promise<WorkflowRunRow | null> {
  const { data, error } = await invokeWorkflowsApi<WorkflowRunRow>({
    op: "workflows.run",
    workflowId: payload.workflowId,
    testMode: payload.testMode,
    correlationId: payload.correlationId,
  });
  if (error || !data) return null;
  return data;
}

export async function fetchWorkflowRuns(params?: {
  workflowId?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): Promise<WorkflowRunRow[]> {
  const { data, error } = await invokeWorkflowsApi<WorkflowRunRow[]>({
    op: "workflowRuns.list",
    workflowId: params?.workflowId,
    status: params?.status,
    from: params?.from,
    to: params?.to,
    limit: params?.limit,
    offset: params?.offset,
  });
  if (error) return [];
  return Array.isArray(data) ? data : [];
}

export async function fetchWorkflowRun(id: string): Promise<WorkflowRunRow | null> {
  const { data, error } = await invokeWorkflowsApi<WorkflowRunRow>({
    op: "workflowRuns.get",
    id,
  });
  if (error || !data) return null;
  return data;
}

export async function appendWorkflowRunLogs(
  runId: string,
  entries: Record<string, unknown>[],
): Promise<WorkflowRunRow | null> {
  const { data, error } = await invokeWorkflowsApi<WorkflowRunRow>({
    op: "workflowRuns.appendLogs",
    id: runId,
    entries,
  });
  if (error || !data) return null;
  return data;
}

export async function fetchActivityLog(params?: {
  actionType?: string;
  departmentId?: string;
  userId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): Promise<ActivityLogEntryRow[]> {
  const { data, error } = await invokeWorkflowsApi<ActivityLogEntryRow[]>({
    op: "activityLog.list",
    actionType: params?.actionType,
    departmentId: params?.departmentId,
    userId: params?.userId,
    from: params?.from,
    to: params?.to,
    limit: params?.limit,
    offset: params?.offset,
  });
  if (error) return [];
  return Array.isArray(data) ? data : [];
}

export async function fetchApprovals(params?: {
  runId?: string;
  decision?: string;
}): Promise<WorkflowApprovalRow[]> {
  const { data, error } = await invokeWorkflowsApi<WorkflowApprovalRow[]>({
    op: "approvals.list",
    runId: params?.runId,
    decision: params?.decision,
  });
  if (error) return [];
  return Array.isArray(data) ? data : [];
}

export async function submitApproval(payload: {
  runId: string;
  decision: "approved" | "rejected";
  notes?: string;
}): Promise<WorkflowRunRow | null> {
  const { data, error } = await invokeWorkflowsApi<WorkflowRunRow>({
    op: "approvals.submit",
    runId: payload.runId,
    decision: payload.decision,
    notes: payload.notes,
  });
  if (error || !data) return null;
  return data;
}

export function createDefaultWorkflowDefinition(): WorkflowDefinition {
  const triggerId = crypto.randomUUID();
  const actionId = crypto.randomUUID();
  return {
    version: 1,
    nodes: [
      {
        id: triggerId,
        type: "trigger",
        label: "Manual / schedule",
        config: { kind: "manual" },
        next: [actionId],
        position: { x: 40, y: 80 },
      },
      {
        id: actionId,
        type: "action",
        label: "Notify channel",
        config: { channel: "slack", template: "default" },
        next: [],
        position: { x: 280, y: 80 },
      },
    ],
    schedule: { cronExpression: "", timezone: "UTC" },
    policies: { maxRetries: 3, backoffMs: 2000, alertOnFailure: true },
  };
}

export function parseRunLogs(run: WorkflowRunRow | null): Record<string, unknown>[] {
  if (!run) return [];
  const raw = run.logs;
  return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
}
