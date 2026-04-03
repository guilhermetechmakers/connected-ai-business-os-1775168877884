import { isSupabaseConfigured, supabase } from "@/lib/supabase";

/**
 * Invoke dashboard-api Edge Function; returns parsed `{ data }` or error string.
 */
export async function invokeDashboardApi<T>(
  body: Record<string, unknown>,
): Promise<{ data: T | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return {
      data: null,
      error:
        "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    return { data: null, error: "Not signed in" };
  }

  const { data, error } = await supabase.functions.invoke<unknown>("dashboard-api", {
    body,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) {
    return { data: null, error: error.message };
  }

  if (data && typeof data === "object" && "error" in data) {
    const err = (data as { error?: unknown }).error;
    if (err !== undefined && err !== null) {
      return { data: null, error: String(err) };
    }
  }

  if (data && typeof data === "object" && "data" in data) {
    return { data: (data as { data: T }).data ?? null, error: null };
  }

  return { data: data as T, error: null };
}
