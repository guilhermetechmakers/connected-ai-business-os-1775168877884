import type { Json } from "@/types/database";

export interface ActivityLogEntry {
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
  workflow_run_id: string | null;
  connector_id: string | null;
  integration_id: string | null;
  ai_action_id: string | null;
  ai_triggered?: boolean;
  idempotency_key?: string | null;
  created_at: string;
}

export interface ActivityLogsListResult {
  entries: ActivityLogEntry[];
  total: number;
  canViewFullPayload: boolean;
}

export interface SystemTemplateRow {
  id: string;
  template_key: string;
  name: string;
  category: string;
  definition: Json | Record<string, unknown>;
  version: string;
  created_at: string;
  updated_at: string;
}

export interface FeatureFlagRow {
  id: string;
  flag_key: string;
  company_id: string | null;
  enabled: boolean;
  rollout?: number;
  payload: Json | Record<string, unknown>;
  updated_at: string;
  created_at?: string;
}

export const ACTIVITY_EVENT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "user_action", label: "User action" },
  { value: "workflow_event", label: "Workflow event" },
  { value: "workflow_run", label: "Workflow run" },
  { value: "integration_sync", label: "Integration sync" },
  { value: "connector.sync", label: "Connector sync" },
  { value: "ai_action", label: "AI action" },
  { value: "system_change", label: "System change" },
  { value: "system_alert", label: "System alert" },
  { value: "admin_action", label: "Admin action" },
  { value: "search_event", label: "Search" },
  { value: "module_event", label: "Module" },
];
