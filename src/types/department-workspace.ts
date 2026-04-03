export type DepartmentDirectoryMetrics = {
  openTasks: number;
  kpis: number;
  documents: number;
};

export type DepartmentDirectoryRow = {
  id: string;
  name: string;
  leadUserId: string | null;
  createdAt: string;
  updatedAt: string;
  metrics: DepartmentDirectoryMetrics;
  status: "active" | "archived";
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
