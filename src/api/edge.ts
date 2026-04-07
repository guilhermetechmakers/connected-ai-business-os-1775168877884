import { invokeEdgeFunction } from "@/lib/edge-function-invoke";

export type EdgeInvokeOptions = {
  /** @default true */
  requireAuth?: boolean;
};

/**
 * Typed helper for Edge Function calls (e.g. `llm-proxy`).
 * Defaults to requiring a signed-in user to avoid 401 storms from anon invokes.
 */
export const edgeApi = {
  invoke: async <TRes>(
    name: string,
    body: Record<string, unknown>,
    options?: EdgeInvokeOptions,
  ): Promise<TRes> => {
    return invokeEdgeFunction<TRes>(name, body, {
      requireAuth: options?.requireAuth ?? true,
    });
  },
};
