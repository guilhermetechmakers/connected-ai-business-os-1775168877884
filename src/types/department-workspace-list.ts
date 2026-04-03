export type DepartmentWorkspaceStatus = "active" | "paused" | "inactive";

export type DepartmentWorkspaceUserRole = "Manager" | "Member" | "Guest";

export type DepartmentWorkspaceListMetrics = {
  openTasks: number;
  newMessages: number;
  activeMembers: number;
  lastActivity: string;
  kpis: number;
  documents: number;
};

/** Tenant-scoped department card for the workspace directory. */
export type DepartmentWorkspaceListItem = {
  id: string;
  name: string;
  leadName: string | null;
  headcount: number;
  status: DepartmentWorkspaceStatus;
  type: string | null;
  metrics: DepartmentWorkspaceListMetrics;
  userRole: DepartmentWorkspaceUserRole;
  aiAvailable: boolean;
  lastUpdated: string;
};

export type DepartmentWorkspaceListFilters = {
  typeFilter: string;
  statusFilter: "all" | DepartmentWorkspaceStatus;
  manageableOnly: boolean;
};

export type TenantDepartmentsListResponse = {
  data: DepartmentWorkspaceListItem[];
  count?: number;
  status?: string;
};
