import type { Json } from "@/types/database";

export type DashboardKind = "global" | "executive";

export type DashboardWidgetVisibilityRules = {
  roles?: string[];
};

export type DashboardWidgetDefinitionRow = {
  id: string;
  company_id: string | null;
  name: string;
  type: string;
  default_config: Record<string, unknown>;
  visibility_rules: DashboardWidgetVisibilityRules | null;
  data_adapter_key: string | null;
  created_at: string;
  updated_at: string;
};

export type DashboardLayoutRow = {
  id: string;
  name: string;
  dashboard_kind: DashboardKind;
  layout_json: DashboardLayoutJson;
  version: number;
  created_at: string;
  updated_at: string;
};

export type GridLayoutItem = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
};

export type DashboardLayoutJson = {
  breakpoints?: Record<string, number>;
  cols?: Record<string, number>;
  layouts?: Record<string, GridLayoutItem[]>;
  widgets?: Record<
    string,
    {
      type: string;
      definitionId?: string | null;
    }
  >;
};

export type DashboardWidgetInstanceRow = {
  id: string;
  layout_id: string;
  widget_definition_id: string | null;
  widget_type: string;
  config: Record<string, unknown>;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
};

export type DashboardExportScheduleRow = {
  id: string;
  company_id: string;
  user_id: string;
  layout_id: string | null;
  target_type: "email" | "webhook";
  target_value: string;
  cron_expression: string;
  last_run_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type DashboardAuditEventRow = {
  id: string;
  company_id: string;
  actor_user_id: string | null;
  event_type: string;
  payload: Json;
  created_at: string;
};

export type ExecutiveBriefResult = {
  brief: string;
  actionItems: string[];
  citations: { source: string; reference?: string; retrievedAt?: string }[];
  timeframe: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    latencyMs?: number;
    model?: string;
  };
};

/** Date window applied across dashboard widgets (query keys + future adapter filters). */
export type DashboardDateRange = {
  preset: "7d" | "30d" | "90d" | "custom";
  fromIso: string;
  toIso: string;
};

export type DataAdapterContext = {
  companyId: string | null;
  userId: string | null;
  roles: string[];
  /** Optional scoping for unified rollups / activity when APIs support it. */
  departmentId?: string | null;
  dateRange?: DashboardDateRange | null;
};
