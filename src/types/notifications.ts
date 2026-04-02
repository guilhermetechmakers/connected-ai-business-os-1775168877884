export type NotificationChannel = "in_app" | "email" | "push";
export type NotificationType = "in_app" | "email" | "push" | "system";
export type NotificationStatus =
  | "pending"
  | "delivered"
  | "failed"
  | "acknowledged"
  | "dismissed";
export type AlertTriggerType = "kpi" | "workflow" | "ai";

export interface TenantNotificationRow {
  id: string;
  company_id: string;
  user_id: string;
  notification_type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  related_item_id: string | null;
  alert_rule_id: string | null;
  priority: number;
}

/** Alias for pages that use the shorter name. */
export type NotificationRow = TenantNotificationRow;

export interface AlertRuleRow {
  id: string;
  company_id: string;
  name: string;
  trigger_type: AlertTriggerType;
  conditions: Record<string, unknown>;
  actions: unknown;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferenceRow {
  id: string;
  company_id: string;
  user_id: string;
  channels: string[];
  preferences: Record<string, unknown>;
  quiet_hours: { start?: string; end?: string } | null;
  data_retention_days: number;
  updated_at: string;
}

export interface NotificationScheduleRow {
  id: string;
  company_id: string;
  name: string;
  cron_expression: string;
  next_run_at: string | null;
  payload_template: Record<string, unknown>;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationsListResult {
  items: TenantNotificationRow[];
  count: number;
}

export interface BulkUpdateResult {
  updated: number;
}
