/**
 * Reports AI summary — tenant-scoped narrative for report / KPI context.
 * Optional: OPENAI_API_KEY + OPENAI_MODEL/OPENAI_MODEL_FAST (default gpt-5.4-mini). Without key, returns deterministic template.
 * Client: supabase.functions.invoke('reports-ai-summary', { body: { reportName, highlights } }).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";
import { corsHeaders } from "../_shared/cors.ts";
import { resolveOpenAiModel } from "../_shared/openai-models.ts";

const bodySchema = z.object({
  reportName: z.string().min(1).max(400),
  highlights: z.array(z.string().max(500)).max(40).optional(),
  kpiNames: z.array(z.string().max(200)).max(50).optional(),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return json({ error: parsed.error.flatten() }, 422);
    }

    const { reportName, highlights = [], kpiNames = [] } = parsed.data;
    const safeHighlights = Array.isArray(highlights) ? highlights : [];
    const safeKpis = Array.isArray(kpiNames) ? kpiNames : [];

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    const model = resolveOpenAiModel(Deno.env.get("OPENAI_MODEL"), "fast");

    if (apiKey) {
      const sys =
        "You are an analytics assistant. Write 2-3 short paragraphs of executive summary. No markdown headings. Neutral, precise tone.";
      const userMsg = `Report: ${reportName}\nKPIs: ${safeKpis.join(", ") || "n/a"}\nHighlights:\n${safeHighlights.join("\n") || "n/a"}`;
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.4,
          messages: [
            { role: "system", content: sys },
            { role: "user", content: userMsg },
          ],
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        return json({ error: "Upstream model error", detail: t.slice(0, 200) }, 502);
      }
      const completion = await res.json() as {
        choices?: { message?: { content?: string } }[];
      };
      const text = completion?.choices?.[0]?.message?.content?.trim();
      if (text) return json({ data: { summary: text, source: "openai" } });
    }

    const summary =
      `Summary for “${reportName}”: ` +
      (safeKpis.length
        ? `Tracked KPIs include ${safeKpis.slice(0, 8).join(", ")}${safeKpis.length > 8 ? ", …" : ""}. `
        : "") +
      (safeHighlights.length
        ? `Notable signals: ${safeHighlights.slice(0, 5).join(" · ")}${safeHighlights.length > 5 ? " …" : ""}. `
        : "No highlights were supplied. ") +
      "Configure OPENAI_API_KEY on the Edge Function for richer narrative summaries.";

    return json({ data: { summary, source: "template" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return json({ error: msg }, 500);
  }
});
