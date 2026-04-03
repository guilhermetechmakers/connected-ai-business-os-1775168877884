import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  createActivityLogEntry,
  createAdminTenant,
  deleteAdminSystemTemplate,
  exportTenantActivityLogs,
  fetchAdminActivitySearch,
  fetchAdminActivityTail,
  fetchAdminAuditSearch,
  fetchAdminFeatureFlags,
  fetchAdminSystemTemplates,
  fetchTenantActivityLogs,
  runAdminPruneRetention,
  type AdminPruneRetentionResult,
  upsertAdminFeatureFlag,
  upsertAdminSystemTemplate,
} from "@/api/activity-logs";
import { isSupabaseConfigured } from "@/lib/supabase";

export const activityLogQueryKeys = {
  root: ["activity-logs"] as const,
  list: (filters: Record<string, string | undefined>) =>
    [...activityLogQueryKeys.root, "list", filters] as const,
  adminTemplates: ["activity-logs", "admin", "templates"] as const,
  adminFlags: (companyId: string | undefined) =>
    ["activity-logs", "admin", "flags", companyId ?? "all"] as const,
  adminTail: (limit: number) =>
    ["activity-logs", "admin", "tail", String(limit)] as const,
  adminActivitySearch: (filters: Record<string, string | boolean | undefined>) =>
    ["activity-logs", "admin", "activity-search", filters] as const,
  adminAuditSearch: (filters: Record<string, string | boolean | undefined>) =>
    ["activity-logs", "admin", "audit-search", filters] as const,
};

export function useTenantActivityLogsQuery(params: {
  eventTypes?: string[];
  dateFrom?: string;
  dateTo?: string;
  actorUserId?: string;
  workflowRunId?: string;
  departmentId?: string;
  connectorId?: string;
  integrationId?: string;
  aiActionId?: string;
  search?: string;
  limit?: number;
  offset?: number;
  includeRedactedOnly?: boolean;
  enabled?: boolean;
}) {
  const {
    enabled = true,
    eventTypes,
    dateFrom,
    dateTo,
    actorUserId,
    workflowRunId,
    departmentId,
    connectorId,
    integrationId,
    aiActionId,
    search,
    limit,
    offset,
    includeRedactedOnly,
  } = params;

  const filterKey = {
    et: eventTypes?.join(",") ?? "",
    df: dateFrom,
    dt: dateTo,
    a: actorUserId,
    w: workflowRunId,
    dep: departmentId,
    c: connectorId,
    i: integrationId,
    ai: aiActionId,
    s: search,
    l: limit !== undefined ? String(limit) : undefined,
    o: offset !== undefined ? String(offset) : undefined,
    r: includeRedactedOnly ? "1" : "0",
  };

  return useQuery({
    queryKey: activityLogQueryKeys.list(filterKey),
    queryFn: async () =>
      fetchTenantActivityLogs({
        eventTypes,
        dateFrom,
        dateTo,
        actorUserId,
        workflowRunId,
        departmentId,
        connectorId,
        integrationId,
        aiActionId,
        search,
        limit,
        offset,
        includeRedactedOnly,
      }),
    enabled: enabled && isSupabaseConfigured,
  });
}

export function useActivityLogExportMutation() {
  return useMutation({
    mutationFn: exportTenantActivityLogs,
  });
}

export function useCreateActivityLogMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createActivityLogEntry,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: activityLogQueryKeys.root });
    },
  });
}

export function useAdminSystemTemplatesQuery(enabled = true) {
  return useQuery({
    queryKey: activityLogQueryKeys.adminTemplates,
    queryFn: fetchAdminSystemTemplates,
    enabled: enabled && isSupabaseConfigured,
  });
}

export function useAdminTemplatesUpsertMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertAdminSystemTemplate,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: activityLogQueryKeys.adminTemplates });
    },
  });
}

export function useAdminFeatureFlagsQuery(
  companyId: string | null | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: activityLogQueryKeys.adminFlags(
      companyId === undefined ? undefined : companyId ?? "global",
    ),
    queryFn: () => fetchAdminFeatureFlags({ companyId }),
    enabled: enabled && isSupabaseConfigured,
  });
}

export function useAdminFlagsUpsertMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertAdminFeatureFlag,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["activity-logs", "admin", "flags"] });
    },
  });
}

export function useAdminActivityTailQuery(limit = 60, enabled = true) {
  return useQuery({
    queryKey: activityLogQueryKeys.adminTail(limit),
    queryFn: () => fetchAdminActivityTail(limit),
    enabled: enabled && isSupabaseConfigured,
  });
}

export function useAdminActivitySearchQuery(params: {
  companyId?: string;
  search?: string;
  eventTypes?: string[];
  dateFrom?: string;
  dateTo?: string;
  actorUserId?: string;
  aiTriggeredOnly?: boolean;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}) {
  const {
    companyId,
    search,
    eventTypes,
    dateFrom,
    dateTo,
    actorUserId,
    aiTriggeredOnly,
    limit = 40,
    offset = 0,
    enabled = true,
  } = params;

  const filterKey = {
    c: companyId,
    s: search,
    et: Array.isArray(eventTypes) ? eventTypes.join(",") : "",
    df: dateFrom,
    dt: dateTo,
    a: actorUserId,
    ai: aiTriggeredOnly === true ? "1" : "",
    l: String(limit),
    o: String(offset),
  };

  return useQuery({
    queryKey: activityLogQueryKeys.adminActivitySearch(filterKey),
    queryFn: () =>
      fetchAdminActivitySearch({
        companyId,
        search,
        eventTypes,
        dateFrom,
        dateTo,
        actorUserId,
        aiTriggeredOnly,
        limit,
        offset,
      }),
    enabled: enabled && isSupabaseConfigured,
  });
}

export function useAdminAuditSearchQuery(params: {
  companyId?: string;
  search?: string;
  eventTypes?: string[];
  dateFrom?: string;
  dateTo?: string;
  actorUserId?: string;
  aiTriggeredOnly?: boolean;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}) {
  const {
    companyId,
    search,
    eventTypes,
    dateFrom,
    dateTo,
    actorUserId,
    aiTriggeredOnly,
    limit = 40,
    offset = 0,
    enabled = true,
  } = params;

  const filterKey = {
    c: companyId,
    s: search,
    et: Array.isArray(eventTypes) ? eventTypes.join(",") : "",
    df: dateFrom,
    dt: dateTo,
    a: actorUserId,
    ai: aiTriggeredOnly === true ? "1" : "",
    l: String(limit),
    o: String(offset),
  };

  return useQuery({
    queryKey: activityLogQueryKeys.adminAuditSearch(filterKey),
    queryFn: () =>
      fetchAdminAuditSearch({
        companyId,
        search,
        eventTypes,
        dateFrom,
        dateTo,
        actorUserId,
        aiTriggeredOnly,
        limit,
        offset,
      }),
    enabled: enabled && isSupabaseConfigured,
  });
}

export function useAdminTenantCreateMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAdminTenant,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["integrations", "admin", "tenants"] });
      void qc.invalidateQueries({ queryKey: ["integrations", "admin", "overview"] });
      void qc.invalidateQueries({ queryKey: ["tenancy"] });
    },
  });
}

export function useAdminTemplateDeleteMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteAdminSystemTemplate,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: activityLogQueryKeys.adminTemplates });
    },
  });
}

export function useAdminPruneRetentionMutation() {
  const qc = useQueryClient();
  return useMutation<AdminPruneRetentionResult, Error, void>({
    mutationFn: runAdminPruneRetention,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: activityLogQueryKeys.root });
      void qc.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey[0] === "activity-logs",
      });
    },
  });
}
