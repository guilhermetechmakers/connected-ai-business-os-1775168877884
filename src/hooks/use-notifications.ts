import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  bulkUpdateNotifications,
  createAlertRule,
  createNotificationEvent,
  createNotificationSchedule,
  deleteAlertRule,
  evaluateKpiRules,
  fetchAlertRules,
  fetchChannelSettings,
  fetchNotificationPreferences,
  fetchNotificationSchedules,
  fetchNotificationsList,
  testFcm,
  testSendgrid,
  updateAlertRule,
  upsertChannelSecrets,
  upsertChannelSettings,
  upsertNotificationPreferences,
} from "@/api/notifications";
import type { TenantNotificationRow } from "@/types/notifications";

const qk = {
  notifications: (filters?: Record<string, unknown>) =>
    ["notifications", "list", filters ?? {}] as const,
  rules: () => ["notifications", "alertRules"] as const,
  schedules: () => ["notifications", "schedules"] as const,
  preferences: () => ["notifications", "preferences"] as const,
  channelSettings: () => ["notifications", "channelSettings"] as const,
};

export function useNotificationsQuery(filters?: {
  status?: "all" | "unread" | "read";
  channel?: "in_app" | "email" | "push";
  sort?: "created_at" | "priority";
  order?: "asc" | "desc";
}) {
  return useQuery({
    queryKey: qk.notifications(filters),
    queryFn: () =>
      fetchNotificationsList({
        ...filters,
        status: filters?.status === "all" ? undefined : filters?.status,
        limit: 100,
      }),
  });
}

export type NotificationsListSortUi =
  | "created_at_desc"
  | "created_at_asc"
  | "priority_desc";

export function useNotificationsListQuery(filters?: {
  status?: "all" | "unread" | "read";
  channel?: "in_app" | "email" | "push";
  sort?: NotificationsListSortUi;
}) {
  const uiSort = filters?.sort ?? "created_at_desc";
  const sort: "created_at" | "priority" =
    uiSort === "priority_desc" ? "priority" : "created_at";
  const order: "asc" | "desc" =
    uiSort === "created_at_asc" ? "asc" : "desc";

  return useNotificationsQuery({
    status: filters?.status === "all" ? undefined : filters?.status,
    channel: filters?.channel,
    sort,
    order: uiSort === "priority_desc" ? "desc" : order,
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ["notifications", "unread-count"] as const,
    queryFn: () =>
      fetchNotificationsList({ status: "unread", limit: 200 }),
    select: (rows: TenantNotificationRow[]) =>
      Array.isArray(rows) ? rows.length : 0,
  });
}

export function useBulkNotificationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: bulkUpdateNotifications,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useCreateNotificationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createNotificationEvent,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useAlertRulesQuery() {
  return useQuery({
    queryKey: qk.rules(),
    queryFn: fetchAlertRules,
  });
}

export function useCreateAlertRuleMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAlertRule,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.rules() });
    },
  });
}

export function useUpdateAlertRuleMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateAlertRule,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.rules() });
    },
  });
}

export function useDeleteAlertRuleMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteAlertRule,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.rules() });
    },
  });
}

export function useNotificationSchedulesQuery() {
  return useQuery({
    queryKey: qk.schedules(),
    queryFn: fetchNotificationSchedules,
  });
}

export function useCreateScheduleMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createNotificationSchedule,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.schedules() });
    },
  });
}

export function useNotificationPreferencesQuery() {
  return useQuery({
    queryKey: qk.preferences(),
    queryFn: fetchNotificationPreferences,
  });
}

export function useUpsertPreferencesMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertNotificationPreferences,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.preferences() });
    },
  });
}

export function useChannelSettingsQuery() {
  return useQuery({
    queryKey: qk.channelSettings(),
    queryFn: fetchChannelSettings,
  });
}

export function useUpsertChannelSettingsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertChannelSettings,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.channelSettings() });
    },
  });
}

export function useUpsertChannelSecretsMutation() {
  return useMutation({
    mutationFn: upsertChannelSecrets,
  });
}

type ChannelTestResult = { ok: boolean; error?: string };

export function useTestSendgridMutation() {
  return useMutation<ChannelTestResult, Error, string>({
    mutationFn: (toEmail: string) => testSendgrid(toEmail),
  });
}

export function useTestFcmMutation() {
  return useMutation<ChannelTestResult, Error, string>({
    mutationFn: (deviceToken: string) => testFcm(deviceToken),
  });
}

export function useEvaluateKpiRulesMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kpiId, value }: { kpiId: string; value: number }) =>
      evaluateKpiRules(kpiId, value),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
