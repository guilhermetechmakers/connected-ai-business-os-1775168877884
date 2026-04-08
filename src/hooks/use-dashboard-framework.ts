import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import {
  ensureDashboardLayout,
  fetchAvailableDashboardWidgets,
  saveDashboardLayout,
} from "@/api/dashboard";
import { getOfflineDefaultLayout } from "@/dashboard/default-layouts";
import { isSupabaseConfigured } from "@/lib/supabase";
import type {
  DashboardKind,
  DashboardLayoutJson,
  DashboardWidgetDefinitionRow,
} from "@/types/dashboard";

export type DashboardSaveInstance = {
  id: string;
  widgetDefinitionId?: string | null;
  widgetType: string;
  config?: Record<string, unknown>;
  isVisible?: boolean;
};

export const dashboardFrameworkKeys = {
  layout: (kind: DashboardKind, layoutName: string) =>
    ["dashboard-framework", "layout", kind, layoutName] as const,
  definitions: () => ["dashboard-framework", "definitions"] as const,
};

export function useDashboardDefinitions() {
  return useQuery({
    queryKey: dashboardFrameworkKeys.definitions(),
    queryFn: fetchAvailableDashboardWidgets,
    enabled: isSupabaseConfigured,
    staleTime: 60_000,
  });
}

export function useDashboardLayoutModel(kind: DashboardKind, layoutName = "Default") {
  const qc = useQueryClient();
  const offline = useMemo(() => getOfflineDefaultLayout(kind), [kind]);

  const layoutQuery = useQuery({
    queryKey: dashboardFrameworkKeys.layout(kind, layoutName),
    queryFn: () => ensureDashboardLayout(kind, layoutName),
    enabled: isSupabaseConfigured,
    staleTime: 30_000,
  });

  const resolved = useMemo(() => {
    if (!isSupabaseConfigured || !layoutQuery.data?.layout) {
      return {
        layoutJson: offline.layoutJson,
        instances: offline.instances,
        layoutId: null as string | null,
      };
    }
    const lj = layoutQuery.data.layout?.layout_json;
    const layoutJson: DashboardLayoutJson =
      lj && typeof lj === "object" ? (lj as DashboardLayoutJson) : offline.layoutJson;
    const instances = Array.isArray(layoutQuery.data.instances)
      ? layoutQuery.data.instances
      : [];
    return {
      layoutJson,
      instances,
      layoutId: layoutQuery.data.layout?.id ?? null,
    };
  }, [layoutQuery.data, offline]);

  const saveMutation = useMutation({
    mutationFn: saveDashboardLayout,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: dashboardFrameworkKeys.layout(kind, layoutName) });
    },
  });

  const persist = useCallback(
    (payload: { layoutJson: DashboardLayoutJson; instances: DashboardSaveInstance[] }) => {
      if (!isSupabaseConfigured) return;
      saveMutation.mutate({
        dashboardKind: kind,
        name: layoutName,
        layoutJson: payload.layoutJson,
        instances: payload.instances,
      });
    },
    [kind, layoutName, saveMutation],
  );

  return {
    layoutQuery,
    layoutJson: resolved.layoutJson,
    instances: resolved.instances,
    layoutId: resolved.layoutId,
    persist,
    isPersisting: saveMutation.isPending,
    persistError: saveMutation.error,
    refetchLayout: layoutQuery.refetch,
  };
}

export function buildInstancesForSave(layoutJson: DashboardLayoutJson): DashboardSaveInstance[] {
  const w = layoutJson.widgets ?? {};
  return Object.entries(w).map(([id, meta]) => ({
    id,
    widgetType: meta.type,
    widgetDefinitionId: meta.definitionId ?? null,
    config: {},
    isVisible: true,
  }));
}

export function definitionByType(
  definitions: DashboardWidgetDefinitionRow[],
  type: string,
): DashboardWidgetDefinitionRow | undefined {
  const list = Array.isArray(definitions) ? definitions : [];
  const tenant = list.find((d) => d.type === type && d.company_id);
  if (tenant) return tenant;
  return list.find((d) => d.type === type && !d.company_id);
}
