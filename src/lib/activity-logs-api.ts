import { edgeFunctionAuthHeaders } from "@/lib/edge-gateway-headers";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export async function invokeActivityLogsApi<T>(
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
    "activity-logs-api",
    {
      body,
      headers: edgeFunctionAuthHeaders(token),
    },
  );

  if (error) {
    return { data: null, error: error.message };
  }

  if (data && typeof data === "object" && "error" in data) {
    const err = (data as { error?: unknown }).error;
    if (err !== undefined && err !== null) {
      const msg =
        typeof err === "string" ? err : JSON.stringify(err);
      return { data: null, error: msg };
    }
  }

  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if ("format" in o && "content" in o) {
      return { data: data as T, error: null };
    }
    if ("total" in o && "data" in o) {
      return { data: data as T, error: null };
    }
    const inner = o.data;
    if (
      "data" in o &&
      inner &&
      typeof inner === "object" &&
      !Array.isArray(inner) &&
      "event_type" in (inner as Record<string, unknown>)
    ) {
      return { data: inner as T, error: null };
    }
  }

  return { data: data as T, error: null };
}
