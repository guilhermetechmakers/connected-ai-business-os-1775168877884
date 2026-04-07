import { FunctionsHttpError } from "@supabase/supabase-js";

import {
  ApiUnauthorizedError,
  normalizeEdgeInvokeError,
} from "@/lib/edge-auth-errors";
import {
  edgeFunctionAnonApiKeyHeader,
  edgeFunctionAuthHeaders,
} from "@/lib/edge-gateway-headers";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const isDev = import.meta.env.DEV;

async function responseLooksLikeInvalidJwt(res: Response): Promise<boolean> {
  try {
    const j = (await res.clone().json()) as { message?: string };
    const msg = typeof j?.message === "string" ? j.message : "";
    return msg.toLowerCase().includes("invalid jwt");
  } catch {
    return false;
  }
}

export type InvokeEdgeFunctionOptions = {
  /**
   * When true (default), requires a user access token and sets `Authorization: Bearer …`.
   * When false, relies on the Supabase client default (anon JWT) — use only for public Edge routes.
   */
  requireAuth?: boolean;
  /** Merged with gateway headers (`apikey` / `Authorization` when authed). */
  headers?: Record<string, string>;
};

/**
 * Central `supabase.functions.invoke` wrapper: explicit `apikey` + Bearer token,
 * typed 401 handling, refresh+retry once on gateway `Invalid JWT`, and dev-only
 * diagnostics when a call is skipped due to missing session.
 */
export async function invokeEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
  options: InvokeEdgeFunctionOptions = {},
): Promise<T> {
  const { requireAuth = true, headers: extraHeaders } = options;

  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }

  let accessToken: string | undefined;

  if (requireAuth) {
    const { data: sessionData } = await supabase.auth.getSession();
    accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      if (isDev) {
        console.debug(`[edge] invoke skipped (no session): ${functionName}`);
      }
      throw new ApiUnauthorizedError("Not signed in");
    }
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const headers: Record<string, string> = requireAuth
      ? { ...edgeFunctionAuthHeaders(accessToken!), ...extraHeaders }
      : { ...edgeFunctionAnonApiKeyHeader(), ...extraHeaders };

    const { data, error } = await supabase.functions.invoke<T>(functionName, {
      body,
      headers,
    });

    if (!error) {
      return data as T;
    }

    const shouldRetry =
      attempt === 0 &&
      requireAuth &&
      error instanceof FunctionsHttpError &&
      error.context?.status === 401 &&
      (await responseLooksLikeInvalidJwt(error.context));

    if (shouldRetry) {
      const { data: refreshed, error: refErr } = await supabase.auth.refreshSession();
      if (!refErr && refreshed.session?.access_token) {
        accessToken = refreshed.session.access_token;
        continue;
      }
    }

    throw normalizeEdgeInvokeError(error);
  }

  throw new ApiUnauthorizedError("Unauthorized");
}
