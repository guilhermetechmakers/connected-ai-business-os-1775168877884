import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export async function invokeTransactionalEmailApi<T>(
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

  const { data, error } = await supabase.functions.invoke<unknown>(
    "transactional-email-api",
    {
      body,
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (error) {
    return { data: null, error: error.message };
  }

  if (data && typeof data === "object" && "error" in data) {
    const err = (data as { error?: unknown }).error;
    if (err !== undefined && err !== null) {
      const msg = typeof err === "string" ? err : JSON.stringify(err);
      return { data: null, error: msg };
    }
  }

  return { data: data as T, error: null };
}
