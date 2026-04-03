import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getTenantSettingsEnvelope,
  listTenantUsersEnvelope,
  patchTenantSettings,
} from "@/lib/profile-api";

const tenantSettingsKey = ["tenant", "settings"] as const;
const tenantUsersKey = ["tenant", "users"] as const;

export function useTenantSettingsQuery() {
  return useQuery({
    queryKey: tenantSettingsKey,
    queryFn: async () => {
      const env = await getTenantSettingsEnvelope();
      if (env.error) throw new Error(env.error.message);
      return env.data?.tenant ?? null;
    },
  });
}

export function useTenantUsersQuery() {
  return useQuery({
    queryKey: tenantUsersKey,
    queryFn: async () => {
      const env = await listTenantUsersEnvelope();
      if (env.error) throw new Error(env.error.message);
      const users = env.data?.users;
      return Array.isArray(users) ? users : [];
    },
  });
}

export function usePatchTenantSettingsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const env = await patchTenantSettings(patch);
      if (env.error) throw new Error(env.error.message);
      return env.data?.tenant ?? null;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tenantSettingsKey });
    },
  });
}
