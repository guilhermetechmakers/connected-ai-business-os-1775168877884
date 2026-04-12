import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteCustomDashboard,
  getCustomDashboard,
  listCustomDashboards,
  refreshCustomDashboardData,
  saveCustomDashboard,
  updateCustomDashboardMeta,
} from "@/api/dashboard";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useTenantFeatureFlagsQuery } from "@/hooks/use-settings-hub";

export const CUSTOM_DASHBOARDS_FLAG_KEY = "custom_dashboards_v1";

export const customDashboardKeys = {
  root: ["customDashboards"] as const,
  list: () => [...customDashboardKeys.root, "list"] as const,
  detail: (dashboardId: string) => [...customDashboardKeys.root, "detail", dashboardId] as const,
};

export function isCustomDashboardsFeatureEnabled(flags: unknown): boolean {
  const list = Array.isArray(flags) ? flags : [];
  const row = list.find((flag) =>
    Boolean(
      flag &&
        typeof flag === "object" &&
        "flag_key" in flag &&
        (flag as { flag_key?: unknown }).flag_key === CUSTOM_DASHBOARDS_FLAG_KEY,
    )
  ) as { enabled?: unknown; rollout?: unknown } | undefined;
  if (!row) return false;
  const enabled = row.enabled === true;
  const rollout = typeof row.rollout === "number" ? row.rollout : 100;
  return enabled && rollout > 0;
}

export function useCustomDashboardsFeatureQuery() {
  const flagsQ = useTenantFeatureFlagsQuery();
  const enabled = isCustomDashboardsFeatureEnabled(flagsQ.data);
  return {
    ...flagsQ,
    enabled,
  };
}

export function useCustomDashboardsListQuery(limit = 100) {
  return useQuery({
    queryKey: [...customDashboardKeys.list(), limit] as const,
    enabled: isSupabaseConfigured,
    queryFn: () => listCustomDashboards(limit),
  });
}

export function useCustomDashboardDetailQuery(dashboardId: string | undefined) {
  return useQuery({
    queryKey: customDashboardKeys.detail(dashboardId ?? "none"),
    enabled: Boolean(dashboardId) && isSupabaseConfigured,
    queryFn: async () => {
      if (!dashboardId) return { dashboard: null, runs: [] };
      return getCustomDashboard(dashboardId);
    },
  });
}

export function useSaveCustomDashboardMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: saveCustomDashboard,
    onSuccess: (row) => {
      if (!row) return;
      void qc.invalidateQueries({ queryKey: customDashboardKeys.list() });
      void qc.invalidateQueries({ queryKey: customDashboardKeys.detail(row.id) });
    },
  });
}

export function useUpdateCustomDashboardMetaMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateCustomDashboardMeta,
    onSuccess: (row, vars) => {
      if (!row) return;
      void qc.invalidateQueries({ queryKey: customDashboardKeys.list() });
      void qc.invalidateQueries({ queryKey: customDashboardKeys.detail(vars.dashboardId) });
    },
  });
}

export function useRefreshCustomDashboardMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: refreshCustomDashboardData,
    onSuccess: (res, dashboardId) => {
      if (!res) return;
      void qc.invalidateQueries({ queryKey: customDashboardKeys.list() });
      void qc.invalidateQueries({ queryKey: customDashboardKeys.detail(dashboardId) });
    },
  });
}

export function useDeleteCustomDashboardMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dashboardId: string) => {
      const ok = await deleteCustomDashboard(dashboardId);
      return { ok, dashboardId };
    },
    onSuccess: ({ ok, dashboardId }) => {
      if (!ok) return;
      void qc.invalidateQueries({ queryKey: customDashboardKeys.list() });
      void qc.removeQueries({ queryKey: customDashboardKeys.detail(dashboardId) });
    },
  });
}
