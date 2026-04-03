import { normalizeDepartmentDirectory } from "@/components/department-workspace";
import { invokeDepartmentWorkspaceApi } from "@/lib/department-workspace-api";
import {
  toDepartmentWorkspaceListItem,
  validateDepartmentShape,
} from "@/lib/department-workspace-list";
import type { DepartmentWorkspaceListItem } from "@/types/department-workspace";

export type CreateDepartmentInput = {
  name: string;
  departmentType?: string;
  workspaceStatus?: "active" | "paused" | "inactive";
  headcount?: number | null;
  leadUserId?: string | null;
};

export async function createTenantDepartment(
  input: CreateDepartmentInput,
): Promise<{ data: DepartmentWorkspaceListItem | null; error: string | null }> {
  const body: Record<string, unknown> = {
    op: "tenants.departments.create",
    name: input.name.trim(),
  };
  if (input.departmentType?.trim()) {
    body.departmentType = input.departmentType.trim();
  }
  if (input.workspaceStatus) {
    body.workspaceStatus = input.workspaceStatus;
  }
  if (input.headcount != null && Number.isFinite(input.headcount)) {
    body.headcount = Math.max(0, Math.floor(input.headcount));
  }
  if (input.leadUserId) {
    body.leadUserId = input.leadUserId;
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
