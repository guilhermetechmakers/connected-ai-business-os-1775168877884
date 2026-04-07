import { FunctionsHttpError } from "@supabase/supabase-js";

/** Stable code for client-side unauthorized failures (missing session or 401 from Edge Functions). */
export const UNAUTHORIZED_CODE = "UNAUTHORIZED" as const;

/**
 * Thrown when a protected Edge Function is called without a valid session,
 * or when the function responds with HTTP 401.
 */
export class ApiUnauthorizedError extends Error {
  readonly status = 401;
  readonly code: typeof UNAUTHORIZED_CODE = UNAUTHORIZED_CODE;

  constructor(message = "Unauthorized") {
    super(message);
    this.name = "ApiUnauthorizedError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function isApiUnauthorizedError(error: unknown): error is ApiUnauthorizedError {
  return error instanceof ApiUnauthorizedError;
}

function httpStatusFromFunctionsError(error: unknown): number | undefined {
  if (error instanceof FunctionsHttpError) {
    const res = error.context as Response | undefined;
    return typeof res?.status === "number" ? res.status : undefined;
  }
  return undefined;
}

/**
 * Maps Supabase `functions.invoke` errors into typed errors; 401 → {@link ApiUnauthorizedError}.
 */
export function normalizeEdgeInvokeError(error: unknown): Error {
  if (error instanceof ApiUnauthorizedError) {
    return error;
  }
  const status = httpStatusFromFunctionsError(error);
  if (status === 401) {
    return new ApiUnauthorizedError("Unauthorized");
  }
  return error instanceof Error ? error : new Error(String(error));
}
