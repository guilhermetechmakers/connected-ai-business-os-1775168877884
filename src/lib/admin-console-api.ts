import { edgeFunctionAuthHeaders } from "@/lib/edge-gateway-headers";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { AdminActivityApiRow, AdminConsoleRestResponse } from "@/types/admin-console";

const FN = "admin-console-api";

/**
 * Invokes the `admin-console-api` Edge Function (super_admin + service role on server).
 * All list fields are null-safe for UI mapping.
 */
export async function adminConsoleRest<T>(
  path: string,
  query: Record<string, string> = {},
): Promise<AdminConsoleRestResponse<T>> {
  if (!isSupabaseConfigured) {
    return { data: undefined, error: "Supabase not configured" };
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { data: undefined, error: "Not authenticated" };

  const { data, error } = await supabase.functions.invoke<unknown>(FN, {
    body: { path, method: "GET", query },
    headers: edgeFunctionAuthHeaders(token),
  });

  if (error) {
    return { error: error.message };
  }
  if (data && typeof data === "object" && "error" in data) {
    const o = data as { error?: string };
    return { error: o.error ?? "Request failed" };
  }
  return data as AdminConsoleRestResponse<T>;
}

export async function fetchAdminCrossTenantActivity(
  params: { limit?: string; tenantId?: string } = {},
): Promise<AdminActivityApiRow[]> {
  const q: Record<string, string> = {};
  if (params.limit) q.limit = params.limit;
  if (params.tenantId) q.tenantId = params.tenantId;
  const res = await adminConsoleRest<AdminActivityApiRow[]>("/admin/logs/activity", q);
  const raw = res.data;
  return Array.isArray(raw) ? raw : [];
}
