import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  applyOnboardingCompany,
  bulkDeprovisionTenantsAdmin,
  createTenantAdminModule,
  deleteOnboardingTemplateAdmin,
  deprovisionTenantAdmin,
  fetchOnboardingTemplates,
  fetchOnboardingTemplatesAdmin,
  fetchTenantAdminDetail,
  fetchTenantConfigs,
  fetchTenantIntegrationMonitor,
  fetchTenantsAdminList,
  patchTenantAdminModule,
  upsertOnboardingTemplateAdmin,
  upsertTenantConfig,
} from "@/api/tenants";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { TenantCompanyRecord } from "@/types/tenancy";

export const tenancyQueryKeys = {
  root: ["tenancy"] as const,
  adminList: (filters: Record<string, string | number | undefined>) =>
    [...tenancyQueryKeys.root, "admin-list", filters] as const,
  adminDetail: (id: string) =>
    [...tenancyQueryKeys.root, "admin-detail", id] as const,
  configs: (companyId: string | undefined) =>
    [...tenancyQueryKeys.root, "configs", companyId ?? "self"] as const,
  onboardingTemplates: (type?: string) =>
    [...tenancyQueryKeys.root, "onboarding-templates", type ?? "all"] as const,
  integrationMonitor: (companyId: string) =>
    [...tenancyQueryKeys.root, "integration-monitor", companyId] as const,
};

export function useTenantsAdminListQuery(params: {
  search?: string;
  tenantStatus?: TenantCompanyRecord["tenant_status"];
  region?: string;
  plan?: string;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}) {
  const {
    search,
    tenantStatus,
    region,
    plan,
    limit = 50,
    offset = 0,
    enabled = true,
  } = params;

  const filterKey = {
    s: search,
    st: tenantStatus,
    r: region,
    p: plan,
    l: limit,
    o: offset,
  };

  return useQuery({
    queryKey: tenancyQueryKeys.adminList(filterKey),
    queryFn: () =>
      fetchTenantsAdminList({
        search,
        tenantStatus,
        region,
        plan,
        limit,
        offset,
      }),
    enabled: enabled && isSupabaseConfigured,
    retry: false,
  });
}

export function useTenantAdminDetailQuery(
  companyId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: tenancyQueryKeys.adminDetail(companyId ?? "none"),
    queryFn: () =>
      companyId ? fetchTenantAdminDetail(companyId) : Promise.resolve(null),
    enabled: Boolean(companyId) && enabled && isSupabaseConfigured,
    retry: false,
  });
}

export function useTenantIntegrationMonitorQuery(
  companyId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: tenancyQueryKeys.integrationMonitor(companyId ?? "none"),
    queryFn: () =>
      companyId
        ? fetchTenantIntegrationMonitor(companyId)
        : Promise.resolve(null),
    enabled: Boolean(companyId) && enabled && isSupabaseConfigured,
    retry: false,
  });
}

export function useTenantConfigsQuery(
  companyId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: tenancyQueryKeys.configs(companyId),
    queryFn: () => fetchTenantConfigs({ companyId }),
    enabled: enabled && isSupabaseConfigured,
    retry: false,
  });
}

export function useOnboardingTemplatesQuery(
  templateType?: "onboarding" | "system",
  enabled = true,
) {
  return useQuery({
    queryKey: tenancyQueryKeys.onboardingTemplates(templateType),
    queryFn: () => fetchOnboardingTemplates({ templateType }),
    enabled: enabled && isSupabaseConfigured,
    retry: false,
  });
}

export function useOnboardingTemplatesAdminQuery(enabled = true) {
  return useQuery({
    queryKey: [...tenancyQueryKeys.root, "onboarding-templates-admin"] as const,
    queryFn: fetchOnboardingTemplatesAdmin,
    enabled: enabled && isSupabaseConfigured,
    retry: false,
  });
}

export function useCreateTenantModuleMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTenantAdminModule,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tenancyQueryKeys.root });
      void qc.invalidateQueries({ queryKey: ["integrations", "admin"] });
    },
  });
}

export function usePatchTenantModuleMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: patchTenantAdminModule,
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: tenancyQueryKeys.root });
      void qc.invalidateQueries({
        queryKey: tenancyQueryKeys.adminDetail(vars.companyId),
      });
    },
  });
}

export function useDeprovisionTenantMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deprovisionTenantAdmin,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tenancyQueryKeys.root });
      void qc.invalidateQueries({ queryKey: ["integrations", "admin"] });
    },
  });
}

export function useBulkDeprovisionTenantsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: bulkDeprovisionTenantsAdmin,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tenancyQueryKeys.root });
      void qc.invalidateQueries({ queryKey: ["integrations", "admin"] });
    },
  });
}

export function useUpsertTenantConfigMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertTenantConfig,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tenancyQueryKeys.root });
    },
  });
}

export function useUpsertOnboardingTemplateMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertOnboardingTemplateAdmin,
    onSuccess: () => {
      void qc.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey[0] === "tenancy",
      });
    },
  });
}

export function useDeleteOnboardingTemplateMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteOnboardingTemplateAdmin,
    onSuccess: () => {
      void qc.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey[0] === "tenancy",
      });
    },
  });
}

export function useApplyOnboardingCompanyMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: applyOnboardingCompany,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tenancyQueryKeys.root });
      void qc.invalidateQueries({ queryKey: ["integrations", "admin"] });
    },
  });
}
