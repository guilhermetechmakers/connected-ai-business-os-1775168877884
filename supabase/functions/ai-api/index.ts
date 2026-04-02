/**
 * AI Assistant & Agent API — conversations, RAG context, prompt assembly, streaming chat,
 * permitted actions, telemetry, audit logs. Secrets: OPENAI_API_KEY.
 * Client: supabase.functions.invoke('ai-api', { body: { op, ... } }) or fetch + SSE for stream.chat.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";
import { corsHeaders } from "../_shared/cors.ts";

const citationSchema = z.object({
  source: z.string(),
  reference: z.string().optional(),
  retrievedAt: z.string().optional(),
});

const jsonOpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("conversations.create"),
    mode: z.enum(["Ask", "Analyze", "Report", "Action"]).optional(),
    title: z.string().max(200).optional(),
  }),
  z.object({
    op: z.literal("conversations.get"),
    conversationId: z.string().uuid(),
  }),
  z.object({
    op: z.literal("conversations.list"),
    limit: z.number().int().positive().max(100).optional(),
  }),
  z.object({
    op: z.literal("conversations.update"),
    conversationId: z.string().uuid(),
    mode: z.enum(["Ask", "Analyze", "Report", "Action"]).optional(),
    title: z.string().max(200).optional(),
  }),
  z.object({
    op: z.literal("messages.add"),
    conversationId: z.string().uuid(),
    role: z.enum(["user", "assistant", "system"]),
    content: z.string().min(0).max(32000),
    citations: z.array(citationSchema).optional(),
    tokenUsage: z.record(z.unknown()).optional(),
  }),
  z.object({
    op: z.literal("prompts.assemble"),
    templateId: z.string().uuid(),
    slotValues: z.record(z.string()).optional(),
  }),
  z.object({
    op: z.literal("prompts.templates.list"),
    includeInactive: z.boolean().optional(),
  }),
  z.object({
    op: z.literal("actions.permissions"),
  }),
  z.object({
    op: z.literal("actions.execute"),
    actionId: z.string().min(1).max(120),
    confirmed: z.boolean(),
    conversationId: z.string().uuid().optional(),
    payload: z.record(z.unknown()).optional(),
  }),
  z.object({
    op: z.literal("contexts.fetch"),
    workspaceId: z.string().max(120).default("global"),
    query: z.string().max(500).optional(),
    limit: z.number().int().positive().max(50).optional(),
  }),
  z.object({
    op: z.literal("dashboard.aiSummary"),
  }),
  z.object({
    op: z.literal("complete.chat"),
    conversationId: z.string().uuid().optional(),
    mode: z.enum(["Ask", "Analyze", "Report", "Action"]).optional(),
    messages: z.array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      }),
    ).min(1),
    model: z.string().optional(),
    workspaceId: z.string().max(120).optional(),
  }),
]);

const streamOpSchema = z.object({
  op: z.literal("stream.chat"),
  conversationId: z.string().uuid(),
  userMessage: z.string().min(1).max(32000),
  mode: z.enum(["Ask", "Analyze", "Report", "Action"]),
  model: z.string().optional(),
  workspaceId: z.string().max(120).optional().default("global"),
});

type ProfileRow = { company_id: string | null; roles: string[] | null };

const SENSITIVE_ACTIONS = new Set([
  "advance_deal_stage",
  "send_slack_digest",
  "export_tenant_data",
]);

const ACTION_DEFS = [
  { id: "run_integration_sync", label: "Trigger integration sync", roles: ["admin", "manager"] },
  { id: "draft_status_update", label: "Draft status update", roles: ["admin", "manager", "member"] },
  { id: "advance_deal_stage", label: "Advance deal stage", roles: ["admin", "manager"] },
  { id: "send_slack_digest", label: "Send Slack digest", roles: ["admin"] },
  { id: "export_tenant_data", label: "Export tenant snapshot", roles: ["admin"] },
] as const;

function normalizeRoles(roles: string[] | null | undefined): string[] {
  const r = Array.isArray(roles) ? roles : [];
  return r.map((x) => String(x).toLowerCase());
}

function roleMatches(defRoles: readonly string[], userRoles: string[]): boolean {
  return defRoles.some((dr) =>
    userRoles.some((ur) => ur.includes(dr) || dr.includes(ur))
  );
}

function permittedActionsForRoles(userRoles: string[]) {
  return ACTION_DEFS.filter((a) => roleMatches(a.roles, userRoles)).map((a) => ({
    id: a.id,
    label: a.label,
    requiresConfirmation: SENSITIVE_ACTIONS.has(a.id),
  }));
}

async function getProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ profile: ProfileRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("company_id, roles")
    .eq("id", userId)
    .maybeSingle();
  if (error) return { profile: null, error: error.message };
  return { profile: data as ProfileRow | null, error: null };
}

async function retrieveRagContext(
  supabase: SupabaseClient,
  companyId: string,
  workspaceId: string,
  query: string,
  limit: number,
): Promise<{ contextText: string; citations: z.infer<typeof citationSchema>[] }> {
  const citations: z.infer<typeof citationSchema>[] = [];
  const parts: string[] = [];
  const q = query.trim().slice(0, 200);

  const { data: docs } = await supabase
    .from("documents")
    .select("id, source_provider, text_content, metadata")
    .eq("company_id", companyId)
    .limit(limit);

  const docList = Array.isArray(docs) ? docs : [];
  for (const d of docList.slice(0, 8)) {
    const text = typeof d.text_content === "string" ? d.text_content : "";
    const snippet = q
      ? text.split(/\n/).find((line) => line.toLowerCase().includes(q.toLowerCase())) ??
        text.slice(0, 1200)
      : text.slice(0, 1200);
    if (!snippet.trim()) continue;
    parts.push(`[Document ${d.source_provider}] ${snippet.slice(0, 1200)}`);
    citations.push({
      source: "documents",
      reference: String(d.id),
      retrievedAt: new Date().toISOString(),
    });
  }

  const { data: entities } = await supabase
    .from("unified_entities")
    .select("id, entity_type, payload, source_references")
    .eq("company_id", companyId)
    .eq("is_deleted", false)
    .limit(limit);

  const entList = Array.isArray(entities) ? entities : [];
  for (const e of entList) {
    const payload = e.payload && typeof e.payload === "object" ? JSON.stringify(e.payload).slice(0, 800) : "";
    if (!payload) continue;
    parts.push(`[${e.entity_type}] ${payload}`);
    citations.push({
      source: "unified_entities",
      reference: String(e.id),
      retrievedAt: new Date().toISOString(),
    });
  }

  const { data: chunks } = await supabase
    .from("ai_context_chunks")
    .select("id, source_type, content, metadata")
    .eq("company_id", companyId)
    .eq("workspace_id", workspaceId)
    .limit(limit);

  const chunkList = Array.isArray(chunks) ? chunks : [];
  for (const c of chunkList) {
    const content = typeof c.content === "string" ? c.content : "";
    if (!content) continue;
    parts.push(`[Chunk ${c.source_type}] ${content.slice(0, 1000)}`);
    citations.push({
      source: "ai_context_chunks",
      reference: String(c.id),
      retrievedAt: new Date().toISOString(),
    });
  }

  return {
    contextText: parts.slice(0, 12).join("\n\n"),
    citations: citations.slice(0, 20),
  };
}

function assembleTemplateText(template: string, slots: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(slots)) {
    out = out.replaceAll(new RegExp(`\\{\\{\\s*${k}\\s*\\}}`, "g"), v);
  }
  return out;
}

function sseData(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const streamParsed = streamOpSchema.safeParse(raw);
  if (streamParsed.success) {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { profile, error: pErr } = await getProfile(supabase, user.id);
    if (pErr || !profile?.company_id) {
      return new Response(JSON.stringify({ error: "Profile not ready" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyId = profile.company_id;
    const body = streamParsed.data;
    const workspaceId = body.workspaceId ?? "global";
    const model = body.model ?? "gpt-4o-mini";

    const { data: conv, error: convErr } = await supabase
      .from("ai_conversations")
      .select("id, user_id, company_id")
      .eq("id", body.conversationId)
      .maybeSingle();
    if (convErr || !conv || conv.user_id !== user.id || conv.company_id !== companyId) {
      return new Response(JSON.stringify({ error: "Conversation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { contextText, citations } = await retrieveRagContext(
      supabase,
      companyId,
      workspaceId,
      body.userMessage,
      8,
    );

    const started = performance.now();
    const systemPreamble =
      `You are the Connected AI Business OS assistant. Mode: ${body.mode}. Tenant-scoped; cite provided context. Be concise. If unsure, say so.`;

    const ctxBlock = contextText
      ? `\n\n--- Retrieved context (tenant) ---\n${contextText}\n--- End context ---`
      : "";

    const messagesForModel = [
      { role: "system" as const, content: systemPreamble + ctxBlock },
    ];

    const { data: prior } = await supabase
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", body.conversationId)
      .order("created_at", { ascending: true })
      .limit(40);

    const priorList = Array.isArray(prior) ? prior : [];
    for (const m of priorList) {
      if (m.role === "user" || m.role === "assistant" || m.role === "system") {
        messagesForModel.push({
          role: m.role,
          content: String(m.content ?? ""),
        });
      }
    }

    messagesForModel.push({ role: "user", content: body.userMessage });

    const { error: insUserErr } = await supabase.from("ai_messages").insert({
      conversation_id: body.conversationId,
      company_id: companyId,
      role: "user",
      content: body.userMessage,
      citations: [],
    });
    if (insUserErr) {
      return new Response(JSON.stringify({ error: insUserErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("ai_conversations")
      .update({
        mode: body.mode,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.conversationId);

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: messagesForModel,
        stream: true,
      }),
    });

    if (!openaiRes.ok || !openaiRes.body) {
      const errText = await openaiRes.text();
      return new Response(JSON.stringify({ error: "Upstream LLM error", detail: errText.slice(0, 500) }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let assistantBuffer = "";
    let promptTokens: number | undefined;
    let completionTokens: number | undefined;

    const reader = openaiRes.body.getReader();
    const decoder = new TextDecoder();
    let carry = "";

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(sseData({ citations }));
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            carry += decoder.decode(value, { stream: true });
            const lines = carry.split("\n");
            carry = lines.pop() ?? "";
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const payload = trimmed.slice(5).trim();
              if (payload === "[DONE]") continue;
              try {
                const json = JSON.parse(payload) as {
                  choices?: { delta?: { content?: string } }[];
                  usage?: { prompt_tokens?: number; completion_tokens?: number };
                };
                if (json.usage) {
                  promptTokens = json.usage.prompt_tokens ?? promptTokens;
                  completionTokens = json.usage.completion_tokens ?? completionTokens;
                }
                const token = json.choices?.[0]?.delta?.content ?? "";
                if (token) {
                  assistantBuffer += token;
                  controller.enqueue(sseData({ c: token }));
                }
              } catch {
                /* partial JSON line */
              }
            }
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : "stream error";
          controller.enqueue(sseData({ error: msg }));
        }

        const latency = Math.round(performance.now() - started);

        const { error: insAsstErr } = await supabase.from("ai_messages").insert({
          conversation_id: body.conversationId,
          company_id: companyId,
          role: "assistant",
          content: assistantBuffer || "(empty)",
          citations,
          token_usage: { promptTokens, completionTokens, model },
        });

        if (insAsstErr) {
          controller.enqueue(sseData({ error: insAsstErr.message }));
        }

        await supabase.from("ai_usage_telemetry").insert({
          company_id: companyId,
          user_id: user.id,
          model,
          prompt_tokens: promptTokens ?? null,
          completion_tokens: completionTokens ?? null,
          latency_ms: latency,
          conversation_id: body.conversationId,
        });

        await supabase.from("activity_logs").insert({
          company_id: companyId,
          event_type: "ai.message.completed",
          actor_user_id: user.id,
          payload: {
            conversationId: body.conversationId,
            mode: body.mode,
            tokens: { promptTokens, completionTokens },
            latencyMs: latency,
          },
        });

        controller.enqueue(
          sseData({
            done: true,
            usage: { promptTokens, completionTokens, latencyMs: latency, model },
          }),
        );
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  const parsed = jsonOpSchema.safeParse(raw);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid body", issues: parsed.error.flatten() }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const op = parsed.data;
  const { profile, error: pErr } = await getProfile(supabase, user.id);
  if (pErr || !profile?.company_id) {
    return new Response(JSON.stringify({ error: "Profile not ready" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const companyId = profile.company_id;
  const userRoles = normalizeRoles(profile.roles);

  try {
    switch (op.op) {
      case "conversations.create": {
        const { data, error } = await supabase
          .from("ai_conversations")
          .insert({
            company_id: companyId,
            user_id: user.id,
            mode: op.mode ?? "Ask",
            title: op.title ?? null,
            messages: [],
            actions: [],
          })
          .select("id, mode, title, created_at, updated_at")
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "conversations.get": {
        const { data: conv, error: e1 } = await supabase
          .from("ai_conversations")
          .select("id, mode, title, metadata, created_at, updated_at")
          .eq("id", op.conversationId)
          .eq("company_id", companyId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (e1 || !conv) throw new Error("Not found");
        const { data: msgs, error: e2 } = await supabase
          .from("ai_messages")
          .select("id, role, content, citations, token_usage, created_at")
          .eq("conversation_id", op.conversationId)
          .order("created_at", { ascending: true });
        if (e2) throw e2;
        return new Response(
          JSON.stringify({
            data: {
              conversation: conv,
              messages: Array.isArray(msgs) ? msgs : [],
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      case "conversations.list": {
        const lim = op.limit ?? 30;
        const { data, error } = await supabase
          .from("ai_conversations")
          .select("id, mode, title, created_at, updated_at")
          .eq("company_id", companyId)
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(lim);
        if (error) throw error;
        return new Response(JSON.stringify({ data: Array.isArray(data) ? data : [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "conversations.update": {
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (op.mode) patch.mode = op.mode;
        if (op.title !== undefined) patch.title = op.title;
        const { data, error } = await supabase
          .from("ai_conversations")
          .update(patch)
          .eq("id", op.conversationId)
          .eq("company_id", companyId)
          .eq("user_id", user.id)
          .select("id, mode, title, updated_at")
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "messages.add": {
        const cites = Array.isArray(op.citations) ? op.citations : [];
        const { data, error } = await supabase
          .from("ai_messages")
          .insert({
            conversation_id: op.conversationId,
            company_id: companyId,
            role: op.role,
            content: op.content,
            citations: cites,
            token_usage: op.tokenUsage ?? null,
          })
          .select("id, created_at")
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "prompts.templates.list": {
        let rq = supabase
          .from("ai_prompt_templates")
          .select("id, name, department, purpose, template_text, slots, is_active")
          .eq("company_id", companyId);
        if (!op.includeInactive) {
          rq = rq.eq("is_active", true);
        }
        const { data, error } = await rq.order("name", { ascending: true });
        if (error) throw error;
        const list = Array.isArray(data) ? data : [];
        return new Response(JSON.stringify({ data: list }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "prompts.assemble": {
        const { data: tpl, error } = await supabase
          .from("ai_prompt_templates")
          .select("template_text, slots")
          .eq("id", op.templateId)
          .eq("company_id", companyId)
          .maybeSingle();
        if (error || !tpl) throw new Error("Template not found");
        const slots = op.slotValues ?? {};
        const assembled = assembleTemplateText(String(tpl.template_text), slots);
        return new Response(JSON.stringify({ data: { assembled, templateId: op.templateId } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "actions.permissions": {
        const actions = permittedActionsForRoles(userRoles);
        return new Response(JSON.stringify({ data: { actions } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "actions.execute": {
        const allowed = permittedActionsForRoles(userRoles);
        const found = allowed.find((a) => a.id === op.actionId);
        if (!found) {
          await supabase.from("ai_action_logs").insert({
            company_id: companyId,
            user_id: user.id,
            action_name: op.actionId,
            status: "denied",
            details: { reason: "not_permitted" },
            conversation_id: op.conversationId ?? null,
          });
          return new Response(JSON.stringify({ error: "Action not permitted" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (found.requiresConfirmation && !op.confirmed) {
          return new Response(
            JSON.stringify({ error: "Confirmation required", requiresConfirmation: true }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        const { data: logRow, error: logErr } = await supabase
          .from("ai_action_logs")
          .insert({
            company_id: companyId,
            user_id: user.id,
            action_name: op.actionId,
            status: "completed",
            details: { payload: op.payload ?? {}, simulated: true },
            conversation_id: op.conversationId ?? null,
          })
          .select("id, created_at")
          .single();
        if (logErr) throw logErr;
        await supabase.from("activity_logs").insert({
          company_id: companyId,
          event_type: "ai.action.executed",
          actor_user_id: user.id,
          payload: { actionId: op.actionId, logId: logRow?.id },
        });
        return new Response(JSON.stringify({ data: { ok: true, log: logRow } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "contexts.fetch": {
        const lim = op.limit ?? 20;
        const { contextText, citations } = await retrieveRagContext(
          supabase,
          companyId,
          op.workspaceId,
          op.query ?? "",
          lim,
        );
        return new Response(JSON.stringify({ data: { snippets: contextText, citations } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "dashboard.aiSummary": {
        const since = new Date(Date.now() - 7 * 864e5).toISOString();
        const { data: usageRows } = await supabase
          .from("ai_usage_telemetry")
          .select("prompt_tokens, completion_tokens, latency_ms, model, created_at")
          .eq("company_id", companyId)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(200);
        const usage = Array.isArray(usageRows) ? usageRows : [];
        let promptSum = 0;
        let completionSum = 0;
        for (const u of usage) {
          promptSum += typeof u.prompt_tokens === "number" ? u.prompt_tokens : 0;
          completionSum += typeof u.completion_tokens === "number" ? u.completion_tokens : 0;
        }
        const { data: actRows } = await supabase
          .from("ai_action_logs")
          .select("id, action_name, status, created_at, details")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(12);
        const { data: denyRows } = await supabase
          .from("ai_action_logs")
          .select("id, action_name, created_at")
          .eq("company_id", companyId)
          .eq("status", "denied")
          .order("created_at", { ascending: false })
          .limit(5);
        return new Response(
          JSON.stringify({
            data: {
              tokenTotals7d: { prompt: promptSum, completion: completionSum, samples: usage.length },
              recentActions: Array.isArray(actRows) ? actRows : [],
              recentPermissionDenials: Array.isArray(denyRows) ? denyRows : [],
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      case "complete.chat": {
        const apiKey = Deno.env.get("OPENAI_API_KEY");
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "Server misconfigured" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const workspaceId = op.workspaceId ?? "global";
        const lastUser = [...op.messages].reverse().find((m) => m.role === "user");
        const q = lastUser?.content ?? "";
        const { contextText, citations } = await retrieveRagContext(
          supabase,
          companyId,
          workspaceId,
          q,
          6,
        );
        const mode = op.mode ?? "Ask";
        const sys =
          `You are the Connected AI Business OS assistant. Mode: ${mode}. Use tenant context; be concise.\n\nContext:\n${contextText || "(none)"}`;
        const model = op.model ?? "gpt-4o-mini";
        const started = performance.now();
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "system", content: sys }, ...op.messages],
          }),
        });
        const data = await res.json() as {
          choices?: { message?: { content?: string } }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const text = data?.choices?.[0]?.message?.content ?? "";
        const latency = Math.round(performance.now() - started);

        if (op.conversationId) {
          await supabase.from("ai_messages").insert({
            conversation_id: op.conversationId,
            company_id: companyId,
            role: "assistant",
            content: text,
            citations,
            token_usage: { ...data.usage, model },
          });
        }

        await supabase.from("ai_usage_telemetry").insert({
          company_id: companyId,
          user_id: user.id,
          model,
          prompt_tokens: data.usage?.prompt_tokens ?? null,
          completion_tokens: data.usage?.completion_tokens ?? null,
          latency_ms: latency,
          conversation_id: op.conversationId ?? null,
        });

        return new Response(
          JSON.stringify({
            data: {
              message: text,
              citations,
              usage: { ...data.usage, latencyMs: latency, model },
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      default:
        return new Response(JSON.stringify({ error: "Unsupported op" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
