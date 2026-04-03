import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  settingsHubAuditAppend,
  settingsHubAuditList,
  settingsHubBuilderKeyCreate,
  settingsHubBuilderKeyRevoke,
  settingsHubBuilderKeysList,
  settingsHubDataPolicyGet,
  settingsHubDataPolicyPatch,
  settingsHubProfileRoleIds,
  settingsHubProfileRolesListTenant,
  settingsHubProfileRolesReplace,
  settingsHubRoleCreate,
  settingsHubRoleDelete,
  settingsHubRolePatch,
  settingsHubRolesList,
  settingsHubTenantFlagUpsert,
  settingsHubTenantFlagsList,
} from "@/lib/settings-hub-api";
import { isSupabaseConfigured } from "@/lib/supabase";

export const settingsHubKeys = {
  dataPolicy: ["settingsHub", "dataPolicy"] as const,
  audit: ["settingsHub", "audit"] as const,
  roles: ["settingsHub", "roles"] as const,
  profileRoles: (profileId: string) => ["settingsHub", "profileRoles", profileId] as const,
  profileAssignmentsTenant: ["settingsHub", "profileAssignmentsTenant"] as const,
  flags: ["settingsHub", "tenantFlags"] as const,
  builderKeys: ["settingsHub", "builderKeys"] as const,
};

export function useTenantDataPolicyQuery() {
  return useQuery({
    queryKey: settingsHubKeys.dataPolicy,
    enabled: isSupabaseConfigured,
    queryFn: async () => {
      const { data, error } = await settingsHubDataPolicyGet();
      if (error) throw new Error(error);
      return data;
    },
  });
}

export function usePatchDataPolicyMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Parameters<typeof settingsHubDataPolicyPatch>[0]) => {
      const { data, error } = await settingsHubDataPolicyPatch(payload);
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsHubKeys.dataPolicy });
      void qc.invalidateQueries({ queryKey: settingsHubKeys.audit });
    },
  });
}

export function useSettingsAuditQuery(limit = 100) {
  return useQuery({
    queryKey: [...settingsHubKeys.audit, limit] as const,
    enabled: isSupabaseConfigured,
    queryFn: async () => {
      const { data, error } = await settingsHubAuditList(limit);
      if (error) throw new Error(error);
      return Array.isArray(data) ? data : [];
    },
  });
}

export function useAppendSettingsAuditMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { action: string; changes?: Record<string, unknown> }) => {
      const { error } = await settingsHubAuditAppend(args.action, args.changes);
      if (error) throw new Error(error);
      return { ok: true as const };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsHubKeys.audit });
    },
  });
}

export function useSettingsRolesQuery() {
  return useQuery({
    queryKey: settingsHubKeys.roles,
    enabled: isSupabaseConfigured,
    queryFn: async () => {
      const { data, error } = await settingsHubRolesList();
      if (error) throw new Error(error);
      return Array.isArray(data) ? data : [];
    },
  });
}

export function useSettingsRoleCreateMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Parameters<typeof settingsHubRoleCreate>[0]) => {
      const { data, error } = await settingsHubRoleCreate(payload);
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsHubKeys.roles });
    },
  });
}

export function useSettingsRolePatchMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Parameters<typeof settingsHubRolePatch>[0]) => {
      const { data, error } = await settingsHubRolePatch(payload);
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsHubKeys.roles });
    },
  });
}

export function useSettingsRoleDeleteMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (roleId: string) => {
      const { data, error } = await settingsHubRoleDelete(roleId);
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsHubKeys.roles });
    },
  });
}

export function useProfileRoleIdsQuery(profileId: string | undefined) {
  return useQuery({
    queryKey: settingsHubKeys.profileRoles(profileId ?? "none"),
    enabled: Boolean(profileId) && isSupabaseConfigured,
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await settingsHubProfileRoleIds(profileId);
      if (error) throw new Error(error);
      return Array.isArray(data) ? data : [];
    },
  });
}

export function useReplaceProfileRolesMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { profileId: string; roleIds: string[] }) => {
      const ids = Array.isArray(args.roleIds) ? args.roleIds : [];
      const { error } = await settingsHubProfileRolesReplace(args.profileId, ids);
      if (error) throw new Error(error);
      return { ok: true as const };
    },
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({
        queryKey: settingsHubKeys.profileRoles(vars.profileId),
      });
      void qc.invalidateQueries({ queryKey: settingsHubKeys.profileAssignmentsTenant });
      void qc.invalidateQueries({ queryKey: settingsHubKeys.audit });
    },
  });
}

export function useProfileRoleAssignmentsTenantQuery() {
  return useQuery({
    queryKey: settingsHubKeys.profileAssignmentsTenant,
    enabled: isSupabaseConfigured,
    queryFn: async () => {
      const { data, error } = await settingsHubProfileRolesListTenant();
      if (error) throw new Error(error);
      return Array.isArray(data) ? data : [];
    },
  });
}

export const useProfileRoleAssignmentsQuery = useProfileRoleAssignmentsTenantQuery;

export const useSetProfileRolesMutation = useReplaceProfileRolesMutation;

export function useTenantFeatureFlagsQuery() {
  return useQuery({
    queryKey: settingsHubKeys.flags,
    enabled: isSupabaseConfigured,
    queryFn: async () => {
      const { data, error } = await settingsHubTenantFlagsList();
      if (error) throw new Error(error);
      return Array.isArray(data) ? data : [];
    },
  });
}

export function useTenantFeatureFlagUpsertMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Parameters<typeof settingsHubTenantFlagUpsert>[0]) => {
      const { data, error } = await settingsHubTenantFlagUpsert(payload);
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsHubKeys.flags });
      void qc.invalidateQueries({ queryKey: settingsHubKeys.audit });
    },
  });
}

/** Alias for UI components using `featureName` / `rollout_percentage` naming. */
export function useUpsertFeatureFlagMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      featureName: string;
      enabled: boolean;
      rollout_percentage?: number;
    }) => {
      const { data, error } = await settingsHubTenantFlagUpsert({
        flagKey: args.featureName,
        enabled: args.enabled,
        rollout: args.rollout_percentage ?? 100,
      });
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsHubKeys.flags });
      void qc.invalidateQueries({ queryKey: settingsHubKeys.audit });
    },
  });
}

export const useCreateRoleMutation = useSettingsRoleCreateMutation;
export const usePatchRoleMutation = useSettingsRolePatchMutation;
export const useDeleteRoleMutation = useSettingsRoleDeleteMutation;

export function useBuilderApiKeysQuery() {
  return useQuery({
    queryKey: settingsHubKeys.builderKeys,
    enabled: isSupabaseConfigured,
    queryFn: async () => {
      const { data, error } = await settingsHubBuilderKeysList();
      if (error) throw new Error(error);
      return Array.isArray(data) ? data : [];
    },
  });
}

export function useCreateBuilderApiKeyMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Parameters<typeof settingsHubBuilderKeyCreate>[0]) => {
      const { data, error } = await settingsHubBuilderKeyCreate(payload);
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsHubKeys.builderKeys });
    },
  });
}

export function useRevokeBuilderApiKeyMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (keyId: string) => {
      const { error } = await settingsHubBuilderKeyRevoke(keyId);
      if (error) throw new Error(error);
      return { ok: true as const };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsHubKeys.builderKeys });
    },
  });
}
