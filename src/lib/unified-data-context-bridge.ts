import type { DepartmentWorkspaceSnapshot, UnifiedEntityRow } from "@/types/unified";

/**
 * Normalizes department snapshot slices for UI (runtime-safe arrays).
 */
export function normalizeDepartmentWorkspaceSnapshot(
  raw: DepartmentWorkspaceSnapshot | null | undefined,
): DepartmentWorkspaceSnapshot {
  if (!raw) {
    return {
      department: null,
      entities: [],
      tasks: [],
      documents: [],
      kpis: [],
      workflows: [],
    };
  }
  return {
    department: raw.department ?? null,
    entities: Array.isArray(raw.entities) ? raw.entities : [],
    tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
    documents: Array.isArray(raw.documents) ? raw.documents : [],
    kpis: Array.isArray(raw.kpis) ? raw.kpis : [],
    workflows: Array.isArray(raw.workflows) ? raw.workflows : [],
  };
}

export function filterEntitiesByType(
  rows: UnifiedEntityRow[] | null | undefined,
  entityType: string,
): UnifiedEntityRow[] {
  const list = Array.isArray(rows) ? rows : [];
  return list.filter((e) => e.entity_type === entityType);
}
