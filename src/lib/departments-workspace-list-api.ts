import { normalizeDepartmentDirectory } from "@/components/department-workspace";
import {
  fetchTenantDepartmentsDirectory,
  invokeDepartmentWorkspaceApi,
} from "@/lib/department-workspace-api";
import {
  parseWorkspaceDepartmentList,
  toDepartmentWorkspaceListItem,
  validateDepartmentShape,
} from "@/lib/department-workspace-list";
import { isSupabaseConfigured } from "@/lib/supabase";
import type {
  DepartmentWorkspaceListItem,
  DepartmentWorkspaceStatus,
} from "@/types/department-workspace";

const DEMO_DEPARTMENTS: DepartmentWorkspaceListItem[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Revenue",
    leadName: "Alex Chen",
    leadUserId: null,
    headcount: 18,
    status: "active",
    type: "Sales",
    metrics: {
      openTasks: 24,
      newMessages: 6,
      activeMembers: 18,
      lastActivity: new Date().toISOString(),
      kpis: 5,
      documents: 12,
    },
    userRole: "Manager",
    aiAvailable: true,
    lastUpdated: new Date().toISOString(),
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    name: "Product",
    leadName: "Jordan Lee",
    leadUserId: null,
    headcount: 22,
    status: "active",
    type: "Ops",
    metrics: {
      openTasks: 31,
      newMessages: 3,
      activeMembers: 22,
      lastActivity: new Date().toISOString(),
      kpis: 8,
      documents: 20,
    },
    userRole: "Member",
    aiAvailable: true,
    lastUpdated: new Date().toISOString(),
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    name: "Operations",
    leadName: "Sam Rivera",
    leadUserId: null,
    headcount: 14,
    status: "paused",
    type: "Ops",
    metrics: {
      openTasks: 9,
      newMessages: 0,
      activeMembers: 14,
      lastActivity: new Date().toISOString(),
      kpis: 4,
      documents: 7,
    },
    userRole: "Guest",
    aiAvailable: false,
    lastUpdated: new Date().toISOString(),
  },
];

export { parseWorkspaceDepartmentList, validateDepartmentShape } from "@/lib/department-workspace-list";

/**
 * Workspace directory: Edge Function `tenants.departments.list` with guarded parsing;
 * falls back to `fetchTenantDepartmentsDirectory` or demo rows when unauthenticated / offline.
 */
export async function fetchDepartmentWorkspaceListCatalog(): Promise<
  DepartmentWorkspaceListItem[]
> {
  if (!isSupabaseConfigured) {
    return [...DEMO_DEPARTMENTS];
  }

  const { data, error } = await invokeDepartmentWorkspaceApi<unknown>({
    op: "tenants.departments.list",
  });

  if (!error && Array.isArray(data)) {
    const parsed = parseWorkspaceDepartmentList(data);
    if (parsed.length > 0) return parsed;
  }

  const rows = await fetchTenantDepartmentsDirectory();
  const safeRows = Array.isArray(rows) ? rows : [];
  if (safeRows.length > 0) {
    return safeRows.map((d) => toDepartmentWorkspaceListItem(d));
  }

  return [...DEMO_DEPARTMENTS];
}

export type CreateDepartmentWorkspaceInput = {
  name: string;
  departmentType?: string;
  leadUserId?: string | null;
  workspaceStatus?: DepartmentWorkspaceStatus;
  headcount?: number | null;
};

export async function createTenantDepartmentWorkspace(
  input: CreateDepartmentWorkspaceInput,
): Promise<{ data: DepartmentWorkspaceListItem | null; error: string | null }> {
  const body: Record<string, unknown> = {
    op: "tenants.departments.create",
    name: input.name.trim(),
  };
  if (input.departmentType?.trim()) {
    body.departmentType = input.departmentType.trim();
  }
  if (input.leadUserId !== undefined) {
    body.leadUserId = input.leadUserId;
  }
  if (input.workspaceStatus) {
    body.workspaceStatus = input.workspaceStatus;
  }
  if (input.headcount != null) {
    body.headcount = input.headcount;
  }

  const { data, error } = await invokeDepartmentWorkspaceApi<unknown>(body);
  if (error) {
    return { data: null, error };
  }
  const direct = validateDepartmentShape(data);
  if (direct) {
    return { data: direct, error: null };
  }
  const rows = normalizeDepartmentDirectory(
    Array.isArray(data) ? data : data != null ? [data] : [],
  );
  const first = rows[0];
  if (!first) {
    return { data: null, error: "Invalid department response" };
  }
  return { data: toDepartmentWorkspaceListItem(first), error: null };
}
