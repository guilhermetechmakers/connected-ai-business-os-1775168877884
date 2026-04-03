import { useQuery } from "@tanstack/react-query";

import { runDataAdapter } from "@/dashboard/data-adapters";
import type { DataAdapterContext } from "@/types/dashboard";

export const dashboardAdapterQueryKey = {
  root: ["dashboard-adapter"] as const,
  one: (key: string | null | undefined, configHash: string, ctx: DataAdapterContext) =>
    [...dashboardAdapterQueryKey.root, key ?? "none", configHash, ctx.companyId ?? "", ctx.userId ?? ""] as const,
};

function stableConfigHash(config: Record<string, unknown>): string {
  try {
    return JSON.stringify(config ?? {});
  } catch {
    return "{}";
  }
}

export function useDashboardWidgetData(
  adapterKey: string | null | undefined,
  config: Record<string, unknown>,
  ctx: DataAdapterContext,
  enabled = true,
) {
  const hash = stableConfigHash(config);
  return useQuery({
    queryKey: dashboardAdapterQueryKey.one(adapterKey, hash, ctx),
    queryFn: () => runDataAdapter(adapterKey, config, ctx),
    enabled,
    staleTime: 20_000,
  });
}
