import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createTenantDepartmentWorkspace,
  fetchDepartmentWorkspaceListCatalog,
} from "@/lib/departments-workspace-list-api";

const workspaceListKey = (tenantId: string | undefined) =>
  ["departments", "workspace-list", tenantId ?? "none"] as const;

export function useDepartmentWorkspaceListCatalog(tenantId: string | undefined) {
  return useQuery({
    queryKey: workspaceListKey(tenantId),
    queryFn: fetchDepartmentWorkspaceListCatalog,
  });
}

export function useCreateDepartmentWorkspaceMutation(tenantId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTenantDepartmentWorkspace,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: workspaceListKey(tenantId) });
      void qc.invalidateQueries({ queryKey: ["departments", "directory"] });
    },
  });
}
