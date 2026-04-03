import type { Json } from "@/types/database";

export type WorkflowNodeType =
  | "trigger"
  | "condition"
  | "action"
  | "approval"
  | "delay"
  | "subworkflow";

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  label?: string;
  config: Record<string, unknown>;
  next: string[];
  position?: { x: number; y: number };
}

export interface WorkflowDefinition {
  version?: number;
  nodes: WorkflowNode[];
  schedule?: {
    cronExpression?: string;
    timezone?: string;
  };
  policies?: {
    maxRetries?: number;
    backoffMs?: number;
    alertOnFailure?: boolean;
  };
}

export interface WorkflowRow {
  id: string;
  company_id: string;
  name: string;
  definition: WorkflowDefinition | Json;
  status: string;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowRunRow {
  id: string;
  workflow_id: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  logs: unknown;
  result_metadata: Json | Record<string, unknown>;
  test_mode: boolean;
  correlation_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityLogEntryRow {
  id: string;
  company_id: string;
  event_type: string;
  actor_user_id: string | null;
  payload: Json | Record<string, unknown>;
  redacted_payload?: Json | Record<string, unknown> | null;
  metadata?: Json | Record<string, unknown> | null;
  related_entity: string | null;
  related_id: string | null;
  department_id: string | null;
  workflow_run_id?: string | null;
  connector_id?: string | null;
  integration_id?: string | null;
  ai_action_id?: string | null;
  idempotency_key?: string | null;
  created_at: string;
}

export interface WorkflowApprovalRow {
  id: string;
  run_id: string;
  step_id: string | null;
  approver_user_id: string | null;
  decision: string;
  notes: string | null;
  created_at: string;
  decided_at: string | null;
}

export interface WorkflowValidationResult {
  valid: boolean;
  errors: string[];
  topoOrder: string[];
}
