import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type DepartmentAiGenerateParams = {
  departmentId: string;
  prompt: string;
  departmentName?: string;
  contextSummary?: string;
  mode?: "ask" | "analyze" | "report" | "action";
};

export type DepartmentAiCitation = { type: string; id: string };

export type DepartmentAiGenerateResult = {
  reply: string;
  citations: DepartmentAiCitation[];
};

export async function invokeDepartmentAiGenerate(
  params: DepartmentAiGenerateParams,
): Promise<{ data: DepartmentAiGenerateResult | null; error: string | null }> {
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
    "department-ai-generate",
    {
      body: {
        departmentId: params.departmentId,
        prompt: params.prompt,
        departmentName: params.departmentName,
        contextSummary: params.contextSummary,
        mode: params.mode,
      },
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (error) {
    return { data: null, error: error.message };
  }

  if (data && typeof data === "object") {
    const root = data as Record<string, unknown>;
    if (typeof root.error === "string") {
      return { data: null, error: root.error };
    }
    const reply = typeof root.reply === "string" ? root.reply : null;
    if (reply) {
      const rawCitations = root.citations ?? root.sources;
      const citations: DepartmentAiCitation[] = [];
      if (Array.isArray(rawCitations)) {
        for (const c of rawCitations) {
          if (!c || typeof c !== "object") continue;
          const row = c as Record<string, unknown>;
          const type = typeof row.type === "string" ? row.type : "";
          const id = typeof row.id === "string" ? row.id : "";
          if (type && id) citations.push({ type, id });
        }
      }
      return { data: { reply, citations }, error: null };
    }
  }

  return { data: null, error: "Unexpected response from department-ai-generate" };
}
