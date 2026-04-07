import { edgeFunctionAuthHeaders } from "@/lib/edge-gateway-headers";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type TenantUserProfileRestRequest = {
  path: string;
  body?: Record<string, unknown>;
  query?: {
    userId?: string;
    range?: string;
    eventType?: string;
  };
};

/**
 * Invoke `tenant-user-profile-api` — REST path strings with tenant/user scoping enforced server-side.
 */
export async function invokeTenantUserProfileRest<T>(
  req: TenantUserProfileRestRequest,
): Promise<{ data: T | null; error: string | null; raw: unknown }> {
  if (!isSupabaseConfigured) {
    return {
      data: null,
      error: "Supabase is not configured.",
      raw: null,
    };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    return { data: null, error: "Not signed in", raw: null };
  }

  const { data, error } = await supabase.functions.invoke<unknown>("tenant-user-profile-api", {
    body: {
      path: req.path,
      body: req.body,
      query: req.query,
    },
    headers: edgeFunctionAuthHeaders(token),
  });

  if (error) {
    return { data: null, error: error.message, raw: null };
  }

  const raw = data;
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if ("error" in o && o.error != null) {
      const msg =
        typeof o.error === "string" ? o.error : JSON.stringify(o.error);
      return { data: null, error: msg, raw };
    }
    if ("data" in o) {
      return { data: (o.data ?? null) as T | null, error: null, raw };
    }
  }

  return { data: raw as T, error: null, raw };
}
