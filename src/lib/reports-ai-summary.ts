import { edgeFunctionAuthHeaders } from "@/lib/edge-gateway-headers";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type ReportsAiSummaryPayload = {
  reportName: string;
  highlights?: string[];
  kpiNames?: string[];
};

export type ReportsAiSummaryResponse = {
  summary: string;
  source?: string;
};

/**
 * Optional richer narrative via `reports-ai-summary` Edge Function (OpenAI when configured).
 */
export async function invokeReportsAiSummary(
  payload: ReportsAiSummaryPayload,
): Promise<{ data: ReportsAiSummaryResponse | null; error: string | null }> {
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
    "reports-ai-summary",
    {
      body: {
        reportName: payload.reportName,
        highlights: payload.highlights ?? [],
        kpiNames: payload.kpiNames ?? [],
      },
      headers: edgeFunctionAuthHeaders(token),
    },
  );

  if (error) {
    return { data: null, error: error.message };
  }

  if (data && typeof data === "object" && "error" in data) {
    const err = (data as { error?: unknown }).error;
    if (err !== undefined && err !== null) {
      return { data: null, error: String(err) };
    }
  }

  if (
    data &&
    typeof data === "object" &&
    "data" in data &&
    (data as { data?: unknown }).data &&
    typeof (data as { data: unknown }).data === "object"
  ) {
    const inner = (data as { data: ReportsAiSummaryResponse }).data;
    return { data: inner, error: null };
  }

  return { data: null, error: "Unexpected response" };
}
