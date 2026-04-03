import type {
  DashboardWidgetDefinitionRow,
  DashboardWidgetVisibilityRules,
} from "@/types/dashboard";

export function hasWidgetAccess(
  userRoles: string[],
  visibility: DashboardWidgetVisibilityRules | null | undefined,
): boolean {
  const allowed = Array.isArray(visibility?.roles) ? visibility!.roles! : [];
  if (allowed.length === 0) return true;
  const normalized = (userRoles ?? []).map((r) => String(r).toLowerCase());
  const set = new Set(normalized);
  return allowed.some((r) => set.has(String(r).toLowerCase()));
}

export function filterVisibleWidgetDefinitions(
  definitions: DashboardWidgetDefinitionRow[],
  userRoles: string[],
): DashboardWidgetDefinitionRow[] {
  const list = Array.isArray(definitions) ? definitions : [];
  return list.filter((d) => hasWidgetAccess(userRoles, d.visibility_rules));
}
