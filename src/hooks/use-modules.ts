import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  createInternalModule,
  deleteInternalModule,
  deployInternalModule,
  fetchInternalModuleDetail,
  fetchInternalModules,
  fetchMarketplaceTemplates,
  fetchModulePermissions,
  fetchModuleVersions,
  installMarketplaceTemplate,
  publishModuleVersion,
  putModulePermissions,
  rollbackModuleVersion,
  setModuleDepartmentBindings,
  updateInternalModule,
} from "@/api/modules";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type {
  ModuleDataBinding,
  ModulePermissionRow,
} from "@/types/modules";

export const modulesQueryKeys = {
  root: ["internal-modules"] as const,
  list: (filters: { status?: string; search?: string; tag?: string }) =>
    [...modulesQueryKeys.root, "list", filters] as const,
  detail: (id: string) => [...modulesQueryKeys.root, "detail", id] as const,
  templates: () => [...modulesQueryKeys.root, "templates"] as const,
  roles: () => [...modulesQueryKeys.root, "roles"] as const,
  departments: () => [...modulesQueryKeys.root, "departments"] as const,
  versions: (moduleId: string) =>
    [...modulesQueryKeys.root, "versions", moduleId] as const,
  permissions: (moduleId: string) =>
    [...modulesQueryKeys.root, "permissions", moduleId] as const,
  audit: (moduleId: string) => [...modulesQueryKeys.root, "audit", moduleId] as const,
};

export function useInternalModulesList(params: {
  status?: string;
  search?: string;
  tag?: string;
}) {
  const filters = {
    status: params.status,
    search: params.search,
    tag: params.tag,
  };
  return useQuery({
    queryKey: modulesQueryKeys.list(filters),
    queryFn: () => fetchInternalModules(filters),
    enabled: isSupabaseConfigured,
  });
}

export function useInternalModuleDetail(moduleId: string | undefined) {
  return useQuery({
    queryKey: modulesQueryKeys.detail(moduleId ?? ""),
    queryFn: () => fetchInternalModuleDetail(moduleId!),
    enabled: isSupabaseConfigured && !!moduleId,
  });
}

export function useMarketplaceTemplatesQuery() {
  return useQuery({
    queryKey: modulesQueryKeys.templates(),
    queryFn: () => fetchMarketplaceTemplates(),
    enabled: isSupabaseConfigured,
  });
}

export function useCompanyRolesQuery() {
  return useQuery({
    queryKey: modulesQueryKeys.roles(),
    queryFn: async (): Promise<{ id: string; name: string }[]> => {
      const { data, error } = await supabase
        .from("roles")
        .select("id,name")
        .order("name");
      if (error) return [];
      const list = Array.isArray(data) ? data : [];
      return list.map((r) => ({
        id: String((r as { id?: string }).id ?? ""),
        name: String((r as { name?: string }).name ?? ""),
      }));
    },
    enabled: isSupabaseConfigured,
  });
}

export function useCompanyDepartmentsQuery() {
  return useQuery({
    queryKey: modulesQueryKeys.departments(),
    queryFn: async (): Promise<{ id: string; name: string }[]> => {
      const { data, error } = await supabase
        .from("departments")
        .select("id,name")
        .order("name");
      if (error) return [];
      const list = Array.isArray(data) ? data : [];
      return list.map((r) => ({
        id: String((r as { id?: string }).id ?? ""),
        name: String((r as { name?: string }).name ?? ""),
      }));
    },
    enabled: isSupabaseConfigured,
  });
}

export function useModuleVersionsList(moduleId: string | undefined) {
  return useQuery({
    queryKey: modulesQueryKeys.versions(moduleId ?? ""),
    queryFn: () => fetchModuleVersions(moduleId!),
    enabled: isSupabaseConfigured && !!moduleId,
  });
}

export function useModulePermissionsQuery(moduleId: string | undefined) {
  return useQuery({
    queryKey: modulesQueryKeys.permissions(moduleId ?? ""),
    queryFn: () => fetchModulePermissions(moduleId!),
    enabled: isSupabaseConfigured && !!moduleId,
  });
}

export type ModuleAuditEntry = {
  id: string;
  event_type: string;
  actor_user_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export function useModuleAudit(moduleId: string | undefined) {
  return useQuery({
    queryKey: modulesQueryKeys.audit(moduleId ?? ""),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("id,event_type,actor_user_id,payload,created_at")
        .eq("related_entity", "internal_module")
        .eq("related_id", moduleId!)
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) return [];
      const list = Array.isArray(data) ? data : [];
      return list.map((e): ModuleAuditEntry => ({
        id: String((e as { id?: string }).id ?? ""),
        event_type: String((e as { event_type?: string }).event_type ?? ""),
        actor_user_id:
          (e as { actor_user_id?: string | null }).actor_user_id ?? null,
        payload:
          (e as { payload?: unknown }).payload &&
          typeof (e as { payload?: unknown }).payload === "object" &&
          !Array.isArray((e as { payload?: unknown }).payload)
            ? ((e as { payload: Record<string, unknown> }).payload)
            : {},
        created_at: String((e as { created_at?: string }).created_at ?? ""),
      }));
    },
    enabled: isSupabaseConfigured && !!moduleId,
  });
}

function mapTenantScopeForApi(scopes: string[]): string[] {
  const list = Array.isArray(scopes) ? scopes : [];
  return list.map((s) => {
    if (s === "current") return "current_tenant";
    if (s === "subsidiaries") return "child_tenants";
    return s;
  });
}

export function useCreateModuleMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      name: string;
      description?: string;
      ui_entry?: string;
      uiEntry?: string;
      tenant_scope?: string[];
      tenantScope?: string[];
      tags?: string[];
      data_bindings?: ModuleDataBinding[];
      dataBindings?: ModuleDataBinding[];
      permissions?: ModulePermissionRow[];
    }) =>
      createInternalModule({
        name: payload.name,
        description: payload.description,
        ui_entry: payload.ui_entry ?? payload.uiEntry,
        tenant_scope: mapTenantScopeForApi(
          payload.tenant_scope ?? payload.tenantScope ?? ["current_tenant"],
        ),
        tags: payload.tags ?? [],
        data_bindings: payload.data_bindings ?? payload.dataBindings ?? [],
        permissions: payload.permissions ?? [],
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: modulesQueryKeys.root });
    },
  });
}

export function useUpdateModuleMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateInternalModule,
    onSuccess: (_res, vars) => {
      void qc.invalidateQueries({ queryKey: modulesQueryKeys.root });
      void qc.invalidateQueries({ queryKey: modulesQueryKeys.detail(vars.id) });
      void qc.invalidateQueries({
        queryKey: modulesQueryKeys.versions(vars.id),
      });
    },
  });
}

export function useDeleteModuleMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteInternalModule,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: modulesQueryKeys.root });
    },
  });
}

export function useInstallTemplateMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: installMarketplaceTemplate,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: modulesQueryKeys.root });
    },
  });
}

export function useDeployModuleMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deployInternalModule,
    onSuccess: (_d, moduleId) => {
      void qc.invalidateQueries({ queryKey: modulesQueryKeys.root });
      void qc.invalidateQueries({ queryKey: modulesQueryKeys.detail(moduleId) });
    },
  });
}

export function usePublishModuleVersionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: publishModuleVersion,
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({
        queryKey: modulesQueryKeys.versions(vars.moduleId),
      });
      void qc.invalidateQueries({
        queryKey: modulesQueryKeys.detail(vars.moduleId),
      });
      void qc.invalidateQueries({ queryKey: modulesQueryKeys.root });
    },
  });
}

export function useRollbackModuleMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: rollbackModuleVersion,
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({
        queryKey: modulesQueryKeys.detail(vars.moduleId),
      });
      void qc.invalidateQueries({
        queryKey: modulesQueryKeys.versions(vars.moduleId),
      });
      void qc.invalidateQueries({ queryKey: modulesQueryKeys.root });
    },
  });
}

export function usePutModulePermissionsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: putModulePermissions,
    onSuccess: (_ok, vars) => {
      void qc.invalidateQueries({
        queryKey: modulesQueryKeys.detail(vars.moduleId),
      });
      void qc.invalidateQueries({
        queryKey: modulesQueryKeys.permissions(vars.moduleId),
      });
    },
  });
}

export function useSetModuleDepartmentsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: setModuleDepartmentBindings,
    onSuccess: (_ok, vars) => {
      void qc.invalidateQueries({
        queryKey: modulesQueryKeys.detail(vars.moduleId),
      });
    },
  });
}

export type CreateModuleFormValues = {
  name: string;
  description: string;
  uiEntry: string;
  tenantScope: string[];
  tags: string[];
  dataBindings: ModuleDataBinding[];
  permissionRows: ModulePermissionRow[];
};
