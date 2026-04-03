import { fetchExecutiveDashboardSnapshot } from "@/api/executive-dashboard";
import {
  fetchDashboardRollups,
  fetchRecentActivity,
  fetchUnifiedEntities,
} from "@/api/unified-data";
import { fetchAiDashboardSummary } from "@/api/ai";
import type { DataAdapterContext } from "@/types/dashboard";

type AdapterFn = (
  config: Record<string, unknown>,
  ctx: DataAdapterContext,
) => Promise<unknown>;

const cache = new Map<string, { expires: number; value: unknown }>();
const DEFAULT_TTL_MS = 30_000;

function cacheKey(adapterKey: string, ctx: DataAdapterContext): string {
  const dr = ctx.dateRange;
  const range = dr ? `${dr.preset}:${dr.fromIso}:${dr.toIso}` : "";
  return `${adapterKey}:${ctx.companyId ?? "none"}:${ctx.userId ?? "none"}:${ctx.departmentId ?? ""}:${range}`;
}

async function withCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expires > now) {
    return hit.value as T;
  }
  const value = await fetcher();
  cache.set(key, { value, expires: now + ttlMs });
  return value;
}

export function invalidateDataAdapterCache(prefix?: string): void {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const k of [...cache.keys()]) {
    if (k.startsWith(prefix)) cache.delete(k);
  }
}

const rollupsAdapter: AdapterFn = async (_config, ctx) => {
  const key = cacheKey("rollups", ctx);
  return withCache(key, DEFAULT_TTL_MS, async () => {
    const rows = await fetchDashboardRollups("rollups");
    return Array.isArray(rows) ? rows : [];
  });
};

const activityAdapter: AdapterFn = async (config, ctx) => {
  const limit =
    typeof config.limit === "number" && config.limit > 0 ? Math.min(config.limit, 100) : 24;
  const key = `${cacheKey("activity", ctx)}:${limit}`;
  return withCache(key, DEFAULT_TTL_MS, async () => {
    const rows = await fetchRecentActivity(limit);
    return Array.isArray(rows) ? rows : [];
  });
};

const alertsAdapter: AdapterFn = async (config, ctx) => {
  const limit =
    typeof config.limit === "number" && config.limit > 0 ? Math.min(config.limit, 100) : 12;
  const key = `${cacheKey("alerts", ctx)}:${limit}`;
  return withCache(key, DEFAULT_TTL_MS, async () => {
    const rows = await fetchUnifiedEntities({
      entityType: "Alert",
      limit,
    });
    return Array.isArray(rows) ? rows : [];
  });
};

const departmentsAdapter: AdapterFn = async (_config, ctx) => {
  const key = cacheKey("departments", ctx);
  return withCache(key, DEFAULT_TTL_MS, async () => {
    const rows = await fetchUnifiedEntities({
      entityType: "Department",
      limit: 40,
    });
    return Array.isArray(rows) ? rows : [];
  });
};

const aiGovernanceAdapter: AdapterFn = async (_config, ctx) => {
  const key = cacheKey("ai_governance", ctx);
  return withCache(key, DEFAULT_TTL_MS, async () => {
    return fetchAiDashboardSummary();
  });
};

const throughputSampleAdapter: AdapterFn = async () => {
  return [
    { name: "Mon", value: 32 },
    { name: "Tue", value: 40 },
    { name: "Wed", value: 38 },
    { name: "Thu", value: 52 },
    { name: "Fri", value: 61 },
    { name: "Sat", value: 48 },
    { name: "Sun", value: 55 },
  ];
};

const riskSampleAdapter: AdapterFn = async () => {
  return [
    { name: "On track", value: 62, color: "rgb(0,210,122)" },
    { name: "Watch", value: 24, color: "rgb(154,208,255)" },
    { name: "At risk", value: 14, color: "rgb(220,80,80)" },
  ];
};

const execMetricsAdapter: AdapterFn = async (_config, ctx) => {
  const key = cacheKey("exec_metrics_snapshot", ctx);
  return withCache(key, DEFAULT_TTL_MS, async () => {
    const snap = await fetchExecutiveDashboardSnapshot();
    const kpis = Array.isArray(snap.kpis) ? snap.kpis : [];
    if (kpis.length === 0) {
      return [
        { label: "Net retention", value: "112%", delta: "+3.1%", trend: "up" as const },
        { label: "Pipeline coverage", value: "3.4x", delta: "+0.2x", trend: "up" as const },
        { label: "Cash runway", value: "18 mo", delta: "stable", trend: "neutral" as const },
        { label: "Integration SLA", value: "99.2%", delta: "-0.1%", trend: "down" as const },
      ];
    }
    return kpis.map((k) => ({
      label: k.name,
      value: k.valueText,
      delta: k.delta ?? "",
      trend: k.trend,
    }));
  });
};

const executiveSnapshotAdapter: AdapterFn = async () => {
  return fetchExecutiveDashboardSnapshot();
};

const registry: Record<string, AdapterFn> = {
  rollups: rollupsAdapter,
  activity_feed: activityAdapter,
  alerts_feed: alertsAdapter,
  departments_rollup: departmentsAdapter,
  ai_governance: aiGovernanceAdapter,
  throughput_sample: throughputSampleAdapter,
  risk_sample: riskSampleAdapter,
  exec_metrics: execMetricsAdapter,
  executive_snapshot: executiveSnapshotAdapter,
  ai_insight: async () => null,
  quick_actions: async () => [],
  none: async () => null,
  executive_brief: async () => null,
};

export async function runDataAdapter(
  adapterKey: string | null | undefined,
  config: Record<string, unknown>,
  ctx: DataAdapterContext,
): Promise<unknown> {
  const key = adapterKey && registry[adapterKey] ? adapterKey : "none";
  const fn = registry[key] ?? registry.none!;
  try {
    return await fn(config, ctx);
  } catch {
    return null;
  }
}
