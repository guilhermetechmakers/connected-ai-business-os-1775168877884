import type {
  DepartmentDirectoryRow,
  DepartmentWorkspaceListItem,
  DepartmentWorkspaceStatus,
} from "@/types/department-workspace";

function rowStatusToWorkspaceStatus(
  s: DepartmentDirectoryRow["status"],
): DepartmentWorkspaceStatus {
  if (s === "paused") return "paused";
  if (s === "inactive" || s === "archived") return "inactive";
  return "active";
}

export function toDepartmentWorkspaceListItem(
  row: DepartmentDirectoryRow,
): DepartmentWorkspaceListItem {
  const m = row.metrics;
  return {
    id: row.id,
    name: row.name,
    leadName: row.leadName ?? null,
    leadUserId: row.leadUserId ?? null,
    headcount: typeof row.headcount === "number" ? row.headcount : 0,
    status: rowStatusToWorkspaceStatus(row.status),
    type: row.type ?? null,
    metrics: {
      openTasks: m.openTasks,
      kpis: m.kpis,
      documents: m.documents,
      newMessages: typeof m.newMessages === "number" ? m.newMessages : 0,
      activeMembers: typeof m.activeMembers === "number" ? m.activeMembers : 0,
      lastActivity:
        typeof m.lastActivity === "string"
          ? m.lastActivity
          : row.lastUpdated || row.updatedAt,
    },
    userRole: row.userRole ?? "Member",
    aiAvailable: row.aiAvailable !== false,
    lastUpdated: row.lastUpdated || row.updatedAt,
  };
}

/** Runtime guard for API / catalog rows before rendering. */
export function validateDepartmentShape(
  dept: unknown,
): DepartmentWorkspaceListItem | null {
  if (!dept || typeof dept !== "object") return null;
  const o = dept as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  const name = typeof o.name === "string" ? o.name : "";
  if (!id || !name) return null;
  const metricsRaw = o.metrics;
  const m =
    metricsRaw && typeof metricsRaw === "object" && !Array.isArray(metricsRaw)
      ? (metricsRaw as Record<string, unknown>)
      : {};
  const statusRaw = typeof o.status === "string" ? o.status : "active";
  const status: DepartmentWorkspaceStatus =
    statusRaw === "paused"
      ? "paused"
      : statusRaw === "inactive"
        ? "inactive"
        : "active";
  const ur = o.userRole;
  const userRole =
    ur === "Manager" || ur === "Guest" || ur === "Member" ? ur : "Member";
  return {
    id,
    name,
    leadName: typeof o.leadName === "string" ? o.leadName : null,
    leadUserId: typeof o.leadUserId === "string" ? o.leadUserId : null,
    headcount:
      typeof o.headcount === "number" && Number.isFinite(o.headcount)
        ? Math.max(0, Math.floor(o.headcount))
        : 0,
    status,
    type: typeof o.type === "string" && o.type.trim() ? o.type.trim() : null,
    metrics: {
      openTasks: typeof m.openTasks === "number" ? m.openTasks : 0,
      kpis: typeof m.kpis === "number" ? m.kpis : 0,
      documents: typeof m.documents === "number" ? m.documents : 0,
      newMessages: typeof m.newMessages === "number" ? m.newMessages : 0,
      activeMembers:
        typeof m.activeMembers === "number" ? m.activeMembers : 0,
      lastActivity:
        typeof m.lastActivity === "string"
          ? m.lastActivity
          : new Date().toISOString(),
    },
    userRole,
    aiAvailable: typeof o.aiAvailable === "boolean" ? o.aiAvailable : true,
    lastUpdated:
      typeof o.lastUpdated === "string"
        ? o.lastUpdated
        : typeof o.updatedAt === "string"
          ? o.updatedAt
          : new Date().toISOString(),
  };
}
