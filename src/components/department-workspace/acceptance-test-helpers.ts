import type { DepartmentDirectoryRow } from "@/types/department-workspace";
import type { ActivityLogEntry } from "@/types/activity-log";
import type { DepartmentWorkspaceSnapshot } from "@/types/unified";

/** Returns true when snapshot arrays are safe for rendering (no null array crashes). */
export function isDepartmentSnapshotRenderSafe(
  snap: DepartmentWorkspaceSnapshot | null | undefined,
): boolean {
  if (!snap) return true;
  const keys: (keyof DepartmentWorkspaceSnapshot)[] = [
    "entities",
    "tasks",
    "documents",
    "kpis",
    "workflows",
  ];
  for (const k of keys) {
    const v = snap[k];
    if (v != null && !Array.isArray(v)) return false;
  }
  return true;
}

export function normalizeActivityEntries(
  raw: ActivityLogEntry[] | null | undefined,
): ActivityLogEntry[] {
  return Array.isArray(raw) ? raw : [];
}

/** True when the snapshot includes at least one task, KPI, or workflow entity row. */
export function departmentWorkspaceHasCoreTabsData(
  snap: DepartmentWorkspaceSnapshot | null,
): boolean {
  if (!snap) return false;
  const tasks = Array.isArray(snap.tasks) ? snap.tasks : [];
  const kpis = Array.isArray(snap.kpis) ? snap.kpis : [];
  const workflows = Array.isArray(snap.workflows) ? snap.workflows : [];
  return tasks.length > 0 || kpis.length > 0 || workflows.length > 0;
}

/** Normalizes directory API payloads for the departments list. */
export function normalizeDepartmentDirectory(
  raw: unknown,
): DepartmentDirectoryRow[] {
  if (!Array.isArray(raw)) return [];
  const out: DepartmentDirectoryRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    const name = typeof o.name === "string" ? o.name : "";
    if (!id || !name) continue;
    const metrics = o.metrics;
    const m =
      metrics && typeof metrics === "object"
        ? (metrics as Record<string, unknown>)
        : {};
    out.push({
      id,
      name,
      leadUserId: typeof o.leadUserId === "string" ? o.leadUserId : null,
      createdAt: typeof o.createdAt === "string" ? o.createdAt : "",
      updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : "",
      metrics: {
        openTasks: typeof m.openTasks === "number" ? m.openTasks : 0,
        kpis: typeof m.kpis === "number" ? m.kpis : 0,
        documents: typeof m.documents === "number" ? m.documents : 0,
      },
      status: o.status === "archived" ? "archived" : "active",
    });
  }
  return out;
}
