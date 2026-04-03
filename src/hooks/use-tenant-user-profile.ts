import { useQuery } from "@tanstack/react-query";

import { restGetAuthMethods } from "@/api/tenant-user-profile-rest";
import { isSupabaseConfigured } from "@/lib/supabase";

export const tenantAuthMethodsQueryKey = (tenantId: string, userId: string) =>
  ["tenant-user-profile", "auth-methods", tenantId, userId] as const;

/**
 * GET /tenants/{tenantId}/users/{userId}/auth-methods via tenant-user-profile-api.
 */
export function useTenantAuthMethods(tenantId: string, userId: string) {
  const enabled =
    isSupabaseConfigured && typeof tenantId === "string" && tenantId.length > 0 && Boolean(userId);

  return useQuery({
    queryKey: tenantAuthMethodsQueryKey(tenantId || "—", userId || "—"),
    queryFn: async () => {
      if (!tenantId || !userId) return null;
      return restGetAuthMethods(tenantId, userId);
    },
    enabled,
  });
}
