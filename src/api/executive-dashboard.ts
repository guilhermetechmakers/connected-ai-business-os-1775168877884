/**
 * Executive dashboard snapshot + export audit — unified-data-api (`executive.snapshot`, `executive.exportLog`).
 */
import { invokeUnifiedDataApi } from "@/lib/unified-data-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  normalizeExecutiveSnapshot,
  type ExecutiveDashboardSnapshot,
} from "@/types/executive-dashboard";

export type { ExecutiveDashboardSnapshot } from "@/types/executive-dashboard";

function offlineExecutiveSnapshot(): ExecutiveDashboardSnapshot {
  return normalizeExecutiveSnapshot({
    kpis: [
      {
        id: "offline-k1",
        name: "Net retention",
        valueText: "112%",
        delta: "+3.1%",
        unit: null,
        trend: "up",
      },
      {
        id: "offline-k2",
        name: "Pipeline coverage",
        valueText: "3.4x",
        delta: "+0.2x",
        unit: null,
        trend: "up",
      },
      {
        id: "offline-k3",
        name: "Cash runway",
        valueText: "18 mo",
        delta: "stable",
        unit: null,
        trend: "neutral",
      },
      {
        id: "offline-k4",
        name: "Integration SLA",
        valueText: "99.2%",
        delta: "-0.1%",
        unit: null,
        trend: "down",
      },
    ],
    risks: [
      {
        id: "offline-r1",
        title: "Pipeline concentration in top accounts",
        severity: "medium",
        status: "watch",
        ownerDepartmentId: null,
        dueDate: null,
      },
      {
        id: "offline-r2",
        title: "Vendor renewal window (30 days)",
        severity: "low",
        status: "open",
        ownerDepartmentId: null,
        dueDate: null,
      },
    ],
    departments: [
      { departmentId: "offline-d1", name: "Revenue", intensity: 88, trend: "up" },
      { departmentId: "offline-d2", name: "Product", intensity: 72, trend: "neutral" },
      { departmentId: "offline-d3", name: "Operations", intensity: 64, trend: "down" },
      { departmentId: "offline-d4", name: "Finance", intensity: 91, trend: "up" },
    ],
    generatedAt: new Date().toISOString(),
  });
}

export async function fetchExecutiveDashboardSnapshot(): Promise<ExecutiveDashboardSnapshot> {
  if (!isSupabaseConfigured) {
    return offlineExecutiveSnapshot();
  }
  const { data, error } = await invokeUnifiedDataApi<unknown>({
    op: "executive.snapshot",
  });
  if (error || data == null) {
    return offlineExecutiveSnapshot();
  }
  return normalizeExecutiveSnapshot(data);
}

export async function logExecutiveExport(params: {
  exportType: "csv" | "pdf" | "json";
  metadata?: Record<string, unknown>;
}): Promise<{ ok: boolean; id?: string }> {
  const { data, error } = await invokeUnifiedDataApi<{
    ok?: boolean;
    id?: string;
    error?: string;
  }>({
    op: "executive.exportLog",
    exportType: params.exportType,
    metadata: params.metadata ?? {},
  });
  if (error || !data || typeof data !== "object") {
    return { ok: false };
  }
  const o = data as Record<string, unknown>;
  return { ok: Boolean(o.ok), id: typeof o.id === "string" ? o.id : undefined };
}
