export type DepartmentDirectoryMetrics = {
  openTasks: number;
  kpis: number;
  documents: number;
  newMessages: number;
  activeMembers: number;
  lastActivity: string;
};

export type DepartmentWorkspaceStatus = "active" | "paused" | "inactive";

export type DepartmentDirectoryRow = {
  id: string;
  name: string;
  leadUserId: string | null;
  leadName?: string | null;
  createdAt: string;
  updatedAt: string;
  lastUpdated: string;
  metrics: DepartmentDirectoryMetrics;
  status: DepartmentWorkspaceStatus | "archived";
  type?: string | null;
  headcount?: number;
  userRole?: "Manager" | "Member" | "Guest";
  aiAvailable?: boolean;
};

/** Catalog row for the Department Workspace List page (strict card model). */
export type DepartmentWorkspaceListItem = {
  id: string;
  name: string;
  leadName: string | null;
  leadUserId: string | null;
  headcount: number;
  status: DepartmentWorkspaceStatus;
  type: string | null;
  metrics: DepartmentDirectoryMetrics;
  userRole: "Manager" | "Member" | "Guest";
  aiAvailable: boolean;
  lastUpdated: string;
};

export type DepartmentAiGenerateResult = {
  reply: string;
  citations: Array<{ type: string; id: string }>;
};

export type DepartmentTaskCreateInput = {
  departmentId: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  assigneeId?: string | null;
  dueDate?: string;
};
