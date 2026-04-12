/**
 * Department-scoped AI generation — OpenAI chat with tenant + department context, audit log.
 * Client: supabase.functions.invoke('department-ai-generate', { body: { departmentId, prompt, ... } }).
 * Secrets: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";
import { corsHeaders } from "../_shared/cors.ts";
import { resolveOpenAiModel } from "../_shared/openai-models.ts";

const bodySchema = z.object({
  departmentId: z.string().uuid(),
  prompt: z.string().min(1).max(8000),
  departmentName: z.string().max(200).optional(),
  contextSummary: z.string().max(12000).optional(),
  mode: z.enum(["ask", "analyze", "report", "action"]).optional(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const raw = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid request", details: parsed.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { departmentId, prompt, departmentName, contextSummary, mode } = parsed.data;

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .maybeSingle();
    if (pErr) throw pErr;
    const companyId = profile?.company_id as string | null | undefined;
    if (!companyId) {
      return new Response(JSON.stringify({ error: "No tenant context" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: dept, error: dErr } = await supabase
      .from("departments")
      .select("id, name, company_id")
      .eq("id", departmentId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (dErr) throw dErr;
    if (!dept) {
      return new Response(JSON.stringify({ error: "Department not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const deptLabel =
      departmentName?.trim() ||
      (typeof dept.name === "string" ? dept.name : "Department");

    const systemParts = [
      "You are the Connected AI Business OS assistant for a single department.",
      `Tenant is isolated; department id: ${departmentId}. Department name: ${deptLabel}.`,
      `Interaction mode: ${mode ?? "ask"}.`,
      "Use only the provided context for factual claims about this tenant; say when data is missing.",
      contextSummary?.trim()
        ? `Unified context (truncated):\n${contextSummary.trim().slice(0, 6000)}`
        : "No unified entity context was attached.",
    ];

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    let reply: string;
    const citations: Array<{ type: string; id: string }> = [
      { type: "department", id: departmentId },
    ];

    if (!apiKey) {
      reply =
        `[Offline] Received your question for “${deptLabel}”. Configure OPENAI_API_KEY on the project for live answers. Preview: ${prompt.slice(0, 120)}${prompt.length > 120 ? "…" : ""}`;
    } else {
      const model = resolveOpenAiModel(null, "fast");
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemParts.join("\n") },
            { role: "user", content: prompt },
          ],
        }),
      });
      const json = await res.json();
      reply =
        json?.choices?.[0]?.message?.content ??
        "The model did not return a response.";
    }

    await supabase.from("activity_logs").insert({
      company_id: companyId,
      event_type: "department.ai.generate",
      actor_user_id: user.id,
      department_id: departmentId,
      payload: {
        mode: mode ?? "ask",
        promptPreview: prompt.slice(0, 240),
        departmentName: deptLabel,
      },
      metadata: { source: "department-ai-generate" },
    });

    return new Response(JSON.stringify({ reply, citations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
