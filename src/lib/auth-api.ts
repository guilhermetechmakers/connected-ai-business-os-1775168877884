import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export type AuthApiEnvelope<T> = {
  data: T | null;
  error: { message: string; code?: string; details?: unknown } | null;
  meta: Record<string, unknown>;
};

function asEnvelope<T>(raw: unknown): AuthApiEnvelope<T> {
  if (raw && typeof raw === "object" && "data" in raw && "error" in raw) {
    const r = raw as AuthApiEnvelope<T>;
    return {
      data: r.data ?? null,
      error: r.error ?? null,
      meta: r.meta && typeof r.meta === "object" ? r.meta : {},
    };
  }
  return {
    data: null,
    error: { message: "Unexpected response shape" },
    meta: {},
  };
}

/**
 * Invoke auth-api Edge Function; returns full envelope (no throw on API-level errors).
 */
export async function invokeAuthApiEnvelope<T>(
  body: Record<string, unknown>,
  options?: { skipAuthHeader?: boolean },
): Promise<AuthApiEnvelope<T>> {
  if (!isSupabaseConfigured) {
    return {
      data: null,
      error: {
        message:
          "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
      },
      meta: {},
    };
  }

  const headers: Record<string, string> = {};
  if (!options?.skipAuthHeader) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const { data, error } = await supabase.functions.invoke<unknown>("auth-api", {
    body,
    headers,
  });

  if (error) {
    return {
      data: null,
      error: { message: error.message },
      meta: {},
    };
  }

  return asEnvelope<T>(data);
}

/**
 * Invoke auth-api and unwrap data, throwing on transport or envelope errors.
 */
export async function invokeAuthApi<T>(
  body: Record<string, unknown>,
  options?: { skipAuthHeader?: boolean },
): Promise<T> {
  const env = await invokeAuthApiEnvelope<T>(body, options);
  if (env.error) {
    throw new Error(env.error.message);
  }
  if (env.data === null || env.data === undefined) {
    throw new Error("Auth API returned no data");
  }
  return env.data;
}

export function safeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : [];
}
