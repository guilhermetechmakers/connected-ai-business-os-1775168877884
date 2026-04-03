import { useQuery } from "@tanstack/react-query";

import { fetchExecutiveDashboardSnapshot } from "@/api/executive-dashboard";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { DashboardDateRange } from "@/types/dashboard";

export function useExecutiveDashboardSnapshot(dateRange?: DashboardDateRange | null) {
  const rangeKey = dateRange
    ? `${dateRange.preset}:${dateRange.fromIso}:${dateRange.toIso}`
    : "default";
  return useQuery({
    queryKey: ["executive-dashboard", "snapshot", isSupabaseConfigured ? "live" : "offline", rangeKey],
    queryFn: fetchExecutiveDashboardSnapshot,
    staleTime: 25_000,
  });
}
