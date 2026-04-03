import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/contexts/auth-context";
import { fetchDepartmentWorkspaceListCatalog } from "@/lib/departments-workspace-list-api";
import type { DepartmentWorkspaceListItem } from "@/types/department-workspace";

export function useDepartments(tenantId: string | null | undefined) {
  const { isConfigured } = useAuth();
  const key = tenantId ?? "none";

  return useQuery({
    queryKey: ["departments", "workspace-list", key],
    enabled: !isConfigured || Boolean(tenantId),
    queryFn: async (): Promise<DepartmentWorkspaceListItem[]> => {
      const list = await fetchDepartmentWorkspaceListCatalog();
      return Array.isArray(list) ? list : [];
    },
  });
}
