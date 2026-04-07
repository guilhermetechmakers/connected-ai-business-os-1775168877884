import { invokeNotificationsApi } from "@/lib/notifications-api";
import type {
  AlertRuleRow,
  BulkUpdateResult,
  NotificationPreferenceRow,
  NotificationScheduleRow,
  NotificationsListResult,
  TenantNotificationRow,
} from "@/types/notifications";

function edgeSort(
  sort: "created_at" | "priority",
  order: "asc" | "desc",
): "created_at_desc" | "created_at_asc" | "priority_desc" {
  if (sort === "priority") return "priority_desc";
  return order === "asc" ? "created_at_asc" : "created_at_desc";
}

export async function fetchNotificationsList(params?: {
  status?: "all" | "unread" | "read";
  channel?: "in_app" | "email" | "push";
  from?: string;
  to?: string;
  sort?: "created_at" | "priority";
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}): Promise<TenantNotificationRow[]> {
  const { data, error } = await invokeNotificationsApi<NotificationsListResult>({
    op: "notifications.list",
    status: params?.status === "all" ? undefined : params?.status,
    channel: params?.channel,
    from: params?.from,
    to: params?.to,
    sort: edgeSort(params?.sort ?? "created_at", params?.order ?? "desc"),
    limit: params?.limit,
    offset: params?.offset,
  });
  if (error || !data) return [];
  const items = Array.isArray(data.items) ? data.items : [];
  return items as TenantNotificationRow[];
}

export async function fetchNotification(
  id: string,
): Promise<TenantNotificationRow | null> {
  const { data, error } = await invokeNotificationsApi<TenantNotificationRow>({
    op: "notifications.get",
    id,
  });
  if (error || !data) return null;
  return data;
}

export async function createNotificationEvent(payload: {
  targetUserId?: string;
  title: string;
  message: string;
  notification_type?: "system" | "in_app" | "email" | "push";
  channel?: "in_app" | "email" | "push";
  data?: Record<string, unknown>;
  related_item_id?: string;
  alert_rule_id?: string;
  priority?: number;
}): Promise<TenantNotificationRow | null> {
  const { data, error } = await invokeNotificationsApi<TenantNotificationRow>({
    op: "notifications.create",
    title: payload.title,
    message: payload.message,
    notification_type: payload.notification_type ?? "in_app",
    channel: payload.channel ?? "in_app",
    data: payload.data ?? {},
    related_item_id: payload.related_item_id,
    alert_rule_id: payload.alert_rule_id,
    priority: payload.priority,
    target_user_id: payload.targetUserId,
  });
  if (error || !data) return null;
  return data;
}

export async function bulkUpdateNotifications(payload: {
  ids: string[];
  action: "read" | "unread" | "dismiss" | "acknowledge";
}): Promise<BulkUpdateResult | null> {
  const { data, error } = await invokeNotificationsApi<BulkUpdateResult>({
    op: "notifications.bulkUpdate",
    ids: payload.ids,
    action: payload.action,
  });
  if (error || !data) return null;
  return data;
}

export async function fetchAlertRules(): Promise<AlertRuleRow[]> {
  const { data, error } = await invokeNotificationsApi<AlertRuleRow[]>({
    op: "alertRules.list",
  });
  if (error) return [];
  return Array.isArray(data) ? data : [];
}

export async function createAlertRule(payload: {
  name: string;
  trigger_type: "kpi" | "workflow" | "ai";
  conditions?: Record<string, unknown>;
  actions?: unknown[];
  enabled?: boolean;
}): Promise<AlertRuleRow | null> {
  const { data, error } = await invokeNotificationsApi<AlertRuleRow>({
    op: "alertRules.create",
    name: payload.name,
    trigger_type: payload.trigger_type,
    conditions: payload.conditions ?? {},
    actions: Array.isArray(payload.actions) ? payload.actions : [],
    enabled: payload.enabled,
  });
  if (error || !data) return null;
  return data;
}

export async function updateAlertRule(payload: {
  id: string;
  name?: string;
  trigger_type?: "kpi" | "workflow" | "ai";
  conditions?: Record<string, unknown>;
  actions?: unknown[];
  enabled?: boolean;
}): Promise<AlertRuleRow | null> {
  const { data, error } = await invokeNotificationsApi<AlertRuleRow>({
    op: "alertRules.update",
    id: payload.id,
    name: payload.name,
    trigger_type: payload.trigger_type,
    conditions: payload.conditions,
    actions: payload.actions,
    enabled: payload.enabled,
  });
  if (error || !data) return null;
  return data;
}

export async function deleteAlertRule(id: string): Promise<boolean> {
  const { error } = await invokeNotificationsApi<{ ok: boolean }>({
    op: "alertRules.delete",
    id,
  });
  return !error;
}

export async function fetchNotificationSchedules(): Promise<
  NotificationScheduleRow[]
> {
  const { data, error } = await invokeNotificationsApi<NotificationScheduleRow[]>({
    op: "schedules.list",
  });
  if (error) return [];
  return Array.isArray(data) ? data : [];
}

export async function createNotificationSchedule(payload: {
  name: string;
  cron_expression: string;
  payload_template?: Record<string, unknown>;
  active?: boolean;
  next_run_at?: string | null;
}): Promise<NotificationScheduleRow | null> {
  const { data, error } = await invokeNotificationsApi<NotificationScheduleRow>({
    op: "schedules.create",
    name: payload.name,
    cron_expression: payload.cron_expression,
    payload_template: payload.payload_template ?? {},
    active: payload.active,
    next_run_at: payload.next_run_at ?? undefined,
  });
  if (error || !data) return null;
  return data;
}

export async function fetchNotificationPreferences(): Promise<
  NotificationPreferenceRow | Record<string, unknown> | null
> {
  const { data, error } = await invokeNotificationsApi<
    NotificationPreferenceRow | null
  >({
    op: "preferences.get",
  });
  if (error) return null;
  return data ?? null;
}

export async function upsertNotificationPreferences(payload: {
  channels?: string[];
  preferences?: Record<string, unknown>;
  quiet_hours?: { start: string; end: string } | null;
  data_retention_days?: number;
}): Promise<NotificationPreferenceRow | null> {
  const { data, error } = await invokeNotificationsApi<NotificationPreferenceRow>({
    op: "preferences.upsert",
    channels: payload.channels,
    preferences: payload.preferences,
    quiet_hours: payload.quiet_hours,
    data_retention_days: payload.data_retention_days,
  });
  if (error || !data) return null;
  return data;
}

export async function fetchChannelSettings(): Promise<Record<
  string,
  unknown
> | null> {
  const { data, error } = await invokeNotificationsApi<Record<string, unknown> | null>(
    { op: "channelSettings.get" },
  );
  if (error) return null;
  return data ?? null;
}

export async function upsertChannelSettings(payload: {
  resend_from_email?: string | null;
  resend_reply_to?: string | null;
  fcm_sender_id?: string | null;
  webhook_delivery_url?: string | null;
}): Promise<Record<string, unknown> | null> {
  const { data, error } = await invokeNotificationsApi<Record<string, unknown>>({
    op: "channelSettings.upsert",
    resend_from_email: payload.resend_from_email,
    resend_reply_to: payload.resend_reply_to,
    fcm_sender_id: payload.fcm_sender_id,
    webhook_delivery_url: payload.webhook_delivery_url,
  });
  if (error || !data) return null;
  return data;
}

export async function upsertChannelSecrets(payload: {
  provider: "resend" | "fcm";
  resend_api_key?: string;
  fcm_server_key?: string;
}): Promise<boolean> {
  const { error } = await invokeNotificationsApi<{ ok: boolean }>({
    op: "channelSecrets.upsert",
    provider: payload.provider,
    resend_api_key: payload.resend_api_key,
    fcm_server_key: payload.fcm_server_key,
  });
  return !error;
}

export async function testResend(toEmail: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const { data, error } = await invokeNotificationsApi<{ ok: boolean }>({
    op: "channels.testResend",
    to_email: toEmail,
  });
  if (error) return { ok: false, error };
  return { ok: Boolean(data?.ok) };
}

export async function testFcm(deviceToken: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const { data, error } = await invokeNotificationsApi<{ ok: boolean }>({
    op: "channels.testFcm",
    device_token: deviceToken,
  });
  if (error) return { ok: false, error };
  return { ok: Boolean(data?.ok) };
}

export async function evaluateKpiRules(kpiId: string, value: number) {
  return invokeNotificationsApi<{ fired: number }>({
    op: "rules.evaluateKpi",
    kpi_id: kpiId,
    value,
  });
}
