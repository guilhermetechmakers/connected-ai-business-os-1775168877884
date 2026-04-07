import { isSupabaseConfigured, supabase, supabaseAnonKey, supabaseUrl } from "@/lib/supabase";

export type AuthApiEnvelope<T> = {
  data: T | null;
  error: { message: string; code?: string; details?: unknown } | null;
  meta: Record<string, unknown>;
};

function asEnvelope<T>(raw: unknown): AuthApiEnvelope<T> {
  if (raw && typeof raw === "object" && "data" in raw && "error" in raw) {
    const r = raw as AuthApiEnvelope<T> & {
      error?: { message?: string; code?: string; details?: unknown } | null;
    };
    const err = r.error ?? null;
    return {
      data: r.data ?? null,
      error: err
        ? {
            message: typeof err.message === "string" ? err.message : "Request failed",
            ...(typeof err.code === "string" ? { code: err.code } : {}),
            ...(err.details !== undefined ? { details: err.details } : {}),
          }
        : null,
      meta: r.meta && typeof r.meta === "object" ? r.meta : {},
    };
  }
  return {
    data: null,
    error: { message: "Unexpected response shape" },
    meta: {},
  };
}

const getAuthFunctionUrl = () => {
  const base = supabaseUrl.replace(/\/$/, "");
  return base ? `${base}/functions/v1/auth-api` : "";
};

async function buildAuthApiHeaders(options?: { skipAuthHeader?: boolean }): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
  };

  if (!options?.skipAuthHeader) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function responseLooksLikeInvalidJwt(res: Response): Promise<boolean> {
  try {
    const j = (await res.clone().json()) as { message?: string };
    const msg = typeof j?.message === "string" ? j.message : "";
    return res.status === 401 && msg.toLowerCase().includes("invalid jwt");
  } catch {
    return false;
  }
}

/**
 * Invoke auth-api Edge Function via native fetch; returns full envelope (no throw on API-level errors).
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

  const url = getAuthFunctionUrl();
  if (!url || !supabaseAnonKey) {
    return {
      data: null,
      error: { message: "Supabase URL or anon key missing" },
      meta: {},
    };
  }

  try {
    let headers = await buildAuthApiHeaders(options);
    let res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (
      res.status === 401 &&
      !options?.skipAuthHeader &&
      (await responseLooksLikeInvalidJwt(res))
    ) {
      const { error: refErr } = await supabase.auth.refreshSession();
      if (!refErr) {
        headers = await buildAuthApiHeaders(options);
        res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
      }
    }

    const raw: unknown = await res.json().catch(() => null);
    return asEnvelope<T>(raw);
  } catch (e) {
    return {
      data: null,
      error: {
        message: e instanceof Error ? e.message : "Network error contacting auth service",
      },
      meta: {},
    };
  }
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

/** Enterprise SSO — resolves IdP URL from tenant `sso_settings` (unauthenticated). */
export function startTenantSsoFlow(tenantId: string) {
  return invokeAuthApiEnvelope<{ url: string }>(
    { op: "auth.sso.start", tenantId },
    { skipAuthHeader: true },
  );
}
