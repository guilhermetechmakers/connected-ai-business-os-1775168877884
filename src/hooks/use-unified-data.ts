import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import {
  fetchDashboardRollups,
  fetchDepartmentSnapshot,
  fetchRecentActivity,
  fetchReportSchedules,
  fetchReportTemplates,
  fetchSearchResults,
  fetchUnifiedEntities,
} from "@/api/unified-data";
import { isSupabaseConfigured } from "@/lib/supabase";

export const unifiedQueryKeys = {
  root: ["unified-data"] as const,
  rollups: (view: "rollups" | "kpis") =>
    [...unifiedQueryKeys.root, "rollups", view] as const,
  entities: (filters: Record<string, string | undefined>) =>
    [...unifiedQueryKeys.root, "entities", filters] as const,
  activity: (limit: number) =>
    [...unifiedQueryKeys.root, "activity", limit] as const,
  department: (deptId: string) =>
    [...unifiedQueryKeys.root, "department", deptId] as const,
  search: (q: string, filters: Record<string, string | undefined>) =>
    [...unifiedQueryKeys.root, "search", q, filters] as const,
  reportTemplates: () => [...unifiedQueryKeys.root, "report-templates"] as const,
  reportSchedules: () => [...unifiedQueryKeys.root, "report-schedules"] as const,
};

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export function useDashboardRollups(view: "rollups" | "kpis" = "rollups") {
  return useQuery({
    queryKey: unifiedQueryKeys.rollups(view),
    queryFn: () => fetchDashboardRollups(view),
    enabled: isSupabaseConfigured,
  });
}

export function useUnifiedEntitiesList(params: {
  entityType?: string;
  departmentId?: string;
  search?: string;
  limit?: number;
  enabled?: boolean;
}) {
  const { enabled = true, entityType, departmentId, search, limit } = params;
  const filters = {
    t: entityType,
    d: departmentId,
    s: search,
    l: limit !== undefined ? String(limit) : undefined,
  };
  return useQuery({
    queryKey: unifiedQueryKeys.entities(filters),
    queryFn: () =>
      fetchUnifiedEntities({
        entityType,
        departmentId,
        search,
        limit: limit ?? 40,
      }),
    enabled: enabled && isSupabaseConfigured,
  });
}

export function useRecentActivityFeed(limit = 24) {
  return useQuery({
    queryKey: unifiedQueryKeys.activity(limit),
    queryFn: () => fetchRecentActivity(limit),
    enabled: isSupabaseConfigured,
  });
}

const DEPT_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function useDepartmentWorkspace(deptId: string | undefined) {
  const isValid = Boolean(deptId && DEPT_UUID_RE.test(deptId));
  return useQuery({
    queryKey: unifiedQueryKeys.department(deptId ?? ""),
    queryFn: () => fetchDepartmentSnapshot(deptId!),
    enabled: isValid && isSupabaseConfigured,
  });
}

export function useUnifiedSearch(
  debouncedQ: string,
  filters?: { entityType?: string; departmentId?: string },
) {
  const f = { t: filters?.entityType, d: filters?.departmentId };
  return useQuery({
    queryKey: unifiedQueryKeys.search(debouncedQ, f),
    queryFn: () =>
      fetchSearchResults({
        q: debouncedQ,
        entityType: filters?.entityType,
        departmentId: filters?.departmentId,
        limit: 60,
      }),
    enabled: isSupabaseConfigured && debouncedQ.trim().length >= 2,
  });
}

export function useReportTemplatesQuery() {
  return useQuery({
    queryKey: unifiedQueryKeys.reportTemplates(),
    queryFn: fetchReportTemplates,
    enabled: isSupabaseConfigured,
  });
}

export function useReportSchedulesQuery() {
  return useQuery({
    queryKey: unifiedQueryKeys.reportSchedules(),
    queryFn: fetchReportSchedules,
    enabled: isSupabaseConfigured,
  });
}
