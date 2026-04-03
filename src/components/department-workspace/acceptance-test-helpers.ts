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

function normalizeWorkspaceStatus(
  raw: unknown,
): DepartmentDirectoryRow["status"] {
  const s = typeof raw === "string" ? raw.toLowerCase() : "active";
  if (s === "archived" || s === "inactive") return "inactive";
  if (s === "paused") return "paused";
  return "active";
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
    const createdAt = typeof o.createdAt === "string" ? o.createdAt : "";
    const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : "";
    const lastUpdated =
      typeof o.lastUpdated === "string"
        ? o.lastUpdated
        : updatedAt || createdAt || "";
    const headcount =
      typeof o.headcount === "number" && Number.isFinite(o.headcount)
        ? Math.max(0, Math.floor(o.headcount))
        : 0;
    const lastActivity =
      typeof m.lastActivity === "string"
        ? m.lastActivity
        : lastUpdated || new Date().toISOString();
    const userRoleRaw = o.userRole;
    const userRole =
      userRoleRaw === "Manager" || userRoleRaw === "Guest"
        ? userRoleRaw
        : userRoleRaw === "Member"
          ? "Member"
          : undefined;
    const aiRaw = o.aiAvailable;
    const aiAvailable = typeof aiRaw === "boolean" ? aiRaw : true;
    const typeVal = o.type;
    const deptType =
      typeof typeVal === "string" && typeVal.trim() ? typeVal.trim() : null;
    const leadNameRaw = o.leadName;
    const leadName =
      typeof leadNameRaw === "string" && leadNameRaw.trim()
        ? leadNameRaw.trim()
        : null;

    out.push({
      id,
      name,
      leadUserId: typeof o.leadUserId === "string" ? o.leadUserId : null,
      leadName,
      createdAt,
      updatedAt,
      lastUpdated: lastUpdated || updatedAt || createdAt,
      type: deptType,
      headcount,
      userRole,
      aiAvailable,
      metrics: {
        openTasks: typeof m.openTasks === "number" ? m.openTasks : 0,
        kpis: typeof m.kpis === "number" ? m.kpis : 0,
        documents: typeof m.documents === "number" ? m.documents : 0,
        newMessages: typeof m.newMessages === "number" ? m.newMessages : 0,
        activeMembers:
          typeof m.activeMembers === "number" ? m.activeMembers : 0,
        lastActivity,
      },
      status: normalizeWorkspaceStatus(o.status),
    });
  }
  return out;
}
