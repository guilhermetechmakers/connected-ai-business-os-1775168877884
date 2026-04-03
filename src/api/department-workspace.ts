import { invokeUnifiedDataApi } from "@/lib/unified-data-api";
import { invokeDepartmentAiGenerate } from "@/lib/department-ai-api";
import type { UnifiedEntityRow } from "@/types/unified";
import type { DepartmentAiGenerateParams, DepartmentAiGenerateResult } from "@/lib/department-ai-api";

export type { DepartmentAiGenerateParams, DepartmentAiGenerateResult };

export async function createDepartmentTask(input: {
  departmentId: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  assigneeHint?: string;
  dueDate?: string;
}): Promise<UnifiedEntityRow | null> {
  const payload: Record<string, unknown> = {
    title: input.title.trim(),
    status: input.status ?? "open",
  };
  if (input.description?.trim()) payload.description = input.description.trim();
  if (input.priority?.trim()) payload.priority = input.priority.trim();
  if (input.assigneeHint?.trim()) payload.assigneeHint = input.assigneeHint.trim();
  if (input.dueDate?.trim()) payload.dueDate = input.dueDate.trim();

  const { data, error } = await invokeUnifiedDataApi<UnifiedEntityRow>({
    op: "entities.upsert",
    entityType: "Task",
    payload,
    departmentId: input.departmentId,
  });
  if (error || !data) return null;
  return data;
}

export async function generateDepartmentAiResponse(
  params: DepartmentAiGenerateParams,
): Promise<{ data: DepartmentAiGenerateResult | null; error: string | null }> {
  return invokeDepartmentAiGenerate(params);
}
