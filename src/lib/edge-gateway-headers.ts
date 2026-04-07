import { supabaseAnonKey } from "@/lib/supabase";

/**
 * Supabase's API gateway validates `apikey` and `Authorization` together.
 * Always send the project anon key as `apikey` alongside the user access token.
 */
export function edgeFunctionAuthHeaders(accessToken: string): Record<string, string> {
  return {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${accessToken}`,
  };
}

/** Use for unauthenticated invokes; `fetchWithAuth` still adds `Authorization` if omitted. */
export function edgeFunctionAnonApiKeyHeader(): Record<string, string> {
  return { apikey: supabaseAnonKey };
}
