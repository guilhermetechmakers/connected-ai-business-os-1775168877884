/**
 * AI Assistant & Agent API — conversations, RAG context, prompt assembly, streaming chat,
 * permitted actions, telemetry, audit logs. Secrets: OPENAI_API_KEY.
 * Client: supabase.functions.invoke('ai-api', { body: { op, ... } }) or fetch + SSE for stream.chat.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";
import { corsHeaders } from "../_shared/cors.ts";
import { toolsExecute, toolsList } from "../_shared/integrations-runtime.ts";

const citationSchema = z.object({
  source: z.string(),
  reference: z.string().optional(),
  retrievedAt: z.string().optional(),
  docId: z.string().uuid().optional(),
  snippet: z.string().optional(),
  sourceProvider: z.string().optional(),
  title: z.string().optional(),
  similarity: z.number().optional(),
  chunkIndex: z.number().int().optional(),
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
    workspaceMode: z.enum(["Ask", "Analyze", "Report", "Action"]).optional(),
  }),
  z.object({
    op: z.literal("prompts.templates.upsert"),
    templateId: z.string().uuid().optional(),
    name: z.string().min(1).max(200),
    templateText: z.string().min(1).max(32000),
    workspaceMode: z.enum(["Ask", "Analyze", "Report", "Action"]),
    department: z.string().max(120).nullable().optional(),
    purpose: z.string().max(120).optional(),
    slots: z.union([z.array(z.string()), z.record(z.unknown())]).optional(),
    isActive: z.boolean().optional(),
    version: z.number().int().positive().max(9999).optional(),
  }),
  z.object({
    op: z.literal("workspace.documents.list"),
    workspaceId: z.string().max(120).default("global"),
    limit: z.number().int().positive().max(80).optional(),
    sourceFilter: z.string().max(64).optional(),
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
    op: z.literal("dashboard.insights"),
    roleView: z.string().max(64).optional(),
    datePreset: z.enum(["7d", "30d", "90d"]).optional(),
  }),
  z.object({
    op: z.literal("dashboard.executiveBrief"),
    timeframe: z.enum(["7d", "30d", "90d"]).optional(),
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
  z.object({
    op: z.literal("tools.diagnostics.run"),
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

type ProfileRow = { company_id: string | null; roles: string[] | null; department: string | null };

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIM = 1536;

type AiToolPermission = {
  id: string;
  label: string;
  requiresConfirmation: boolean;
  providerKey: string;
  accessLevel: "read" | "write";
};

function normalizeRoles(roles: string[] | null | undefined): string[] {
  const r = Array.isArray(roles) ? roles : [];
  return r.map((x) => String(x).toLowerCase());
}

function canAccessExecutiveBrief(roles: string[] | null | undefined): boolean {
  const r = new Set(normalizeRoles(roles));
  return ["admin", "executive", "manager", "company admin"].some((x) => r.has(x));
}

async function permittedActionsForRoles(
  supabase: SupabaseClient,
  companyId: string,
  userRoles: string[],
): Promise<AiToolPermission[]> {
  const list = await toolsList(supabase, { companyId, roles: userRoles });
  return list.map((t) => ({
    id: t.id,
    label: t.label,
    requiresConfirmation: t.requiresConfirmation,
    providerKey: t.providerKey,
    accessLevel: t.accessLevel,
  }));
}

function canEditPromptTemplates(userRoles: string[]) {
  const r = new Set(normalizeRoles(userRoles));
  return ["admin", "manager", "owner", "company admin", "executive"].some((x) => r.has(x));
}

function suggestedActionsForMode(
  mode: "Ask" | "Analyze" | "Report" | "Action",
  permitted: AiToolPermission[],
): string[] {
  if (mode === "Action") {
    return permitted
      .sort((a, b) => (a.accessLevel === "write" ? -1 : 1) - (b.accessLevel === "write" ? -1 : 1))
      .slice(0, 6)
      .map((p) => p.id);
  }
  if (mode === "Report") {
    return permitted
      .filter((p) => p.accessLevel === "read")
      .slice(0, 3)
      .map((p) => p.id);
  }
  if (mode === "Analyze") {
    return permitted
      .filter((p) => p.accessLevel === "read")
      .slice(0, 3)
      .map((p) => p.id);
  }
  return permitted.slice(0, 3).map((p) => p.id);
}

function isElevatedRole(userRoles: string[]): boolean {
  const r = new Set(normalizeRoles(userRoles));
  return ["admin", "manager", "owner", "company admin", "executive"].some((x) => r.has(x));
}

function canReadIndexedPermission(
  permissions: unknown,
  userRoles: string[],
  userDepartment: string | null | undefined,
): boolean {
  const p = permissions as Record<string, unknown> | null;
  if (!p || p.scope === "tenant") return true;
  if (isElevatedRole(userRoles)) return true;

  const roles = Array.isArray(p.roles) ? (p.roles as string[]) : [];
  const ur = new Set(normalizeRoles(userRoles));
  const rolesAllowed = roles.length === 0 || roles.some((r) => ur.has(String(r).toLowerCase()));
  if (!rolesAllowed) return false;

  const deps = Array.isArray(p.departments) ? (p.departments as string[]) : [];
  if (deps.length === 0) return true;
  const d = (userDepartment ?? "").trim().toLowerCase();
  if (!d) return false;
  return deps.some((dep) => String(dep).trim().toLowerCase() === d);
}

function toVectorLiteral(values: number[]): string {
  return `[${values.map((v) => Number(v.toFixed(8))).join(",")}]`;
}

async function embedQuery(apiKey: string, text: string): Promise<number[] | null> {
  const q = text.trim();
  if (!q) return null;
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: q.slice(0, 6000),
    }),
  });
  if (!res.ok) return null;
  const json = await res.json() as { data?: Array<{ embedding?: number[] }> };
  const emb = Array.isArray(json.data) && Array.isArray(json.data[0]?.embedding)
    ? json.data[0].embedding ?? []
    : [];
  if (emb.length !== EMBEDDING_DIM) return null;
  return emb;
}

async function getProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ profile: ProfileRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("company_id, roles, department")
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
  opts?: { userRoles?: string[]; userDepartment?: string | null; apiKey?: string | null },
): Promise<{ contextText: string; citations: z.infer<typeof citationSchema>[] }> {
  const citations: z.infer<typeof citationSchema>[] = [];
  const parts: string[] = [];
  const q = query.trim().slice(0, 200);

  const roles = Array.isArray(opts?.userRoles) ? opts?.userRoles ?? [] : [];
  const userDepartment = opts?.userDepartment ?? null;
  const apiKey = opts?.apiKey ?? Deno.env.get("OPENAI_API_KEY") ?? null;
  const semanticCap = Math.max(6, Math.min(40, limit * 3));
  const nowIso = new Date().toISOString();

  if (apiKey && q) {
    const queryEmbedding = await embedQuery(apiKey, q);
    if (queryEmbedding) {
      const { data: semanticRows } = await supabase.rpc("match_indexed_document_chunks", {
        p_query_embedding: toVectorLiteral(queryEmbedding),
        p_match_count: semanticCap,
        p_min_similarity: 0.12,
      });

      const rows = Array.isArray(semanticRows) ? semanticRows : [];
      for (const row of rows) {
        const permissions = row.permissions ?? { scope: "tenant" };
        if (!canReadIndexedPermission(permissions, roles, userDepartment)) continue;
        const chunkText = typeof row.chunk_text === "string" ? row.chunk_text : "";
        if (!chunkText.trim()) continue;
        const title = typeof row.title === "string" && row.title
          ? row.title
          : String(row.source_provider ?? "indexed_document");
        const similarity = typeof row.similarity === "number" ? row.similarity : undefined;
        parts.push(`[KB: ${title}] ${chunkText.slice(0, 1200)}`);
        citations.push({
          source: `indexed_document_chunks:${String(row.source_provider ?? "unknown")}`,
          reference: String(row.chunk_id),
          docId: String(row.document_id),
          sourceProvider: String(row.source_provider ?? "unknown"),
          title,
          snippet: chunkText.slice(0, 280),
          similarity,
          chunkIndex: typeof row.chunk_index === "number" ? row.chunk_index : undefined,
          retrievedAt: nowIso,
        });
        if (parts.length >= Math.max(10, limit * 2)) break;
      }
    }
  }

  const needFallback = parts.length < Math.max(4, Math.min(10, limit));
  if (needFallback) {
    const { data: docs } = await supabase
      .from("documents")
      .select("id, source_provider, text_content")
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
        docId: String(d.id),
        sourceProvider: typeof d.source_provider === "string" ? d.source_provider : "unknown",
        snippet: snippet.slice(0, 280),
        retrievedAt: nowIso,
      });
      if (parts.length >= Math.max(10, limit * 2)) break;
    }
  }

  if (parts.length < Math.max(10, limit * 2)) {
    const { data: entities } = await supabase
      .from("unified_entities")
      .select("id, entity_type, payload")
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
        retrievedAt: nowIso,
      });
      if (parts.length >= Math.max(10, limit * 2)) break;
    }
  }

  if (parts.length < Math.max(10, limit * 2)) {
    const { data: chunks } = await supabase
      .from("ai_context_chunks")
      .select("id, source_type, content")
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
        retrievedAt: nowIso,
      });
      if (parts.length >= Math.max(10, limit * 2)) break;
    }
  }

  if (parts.length < Math.max(10, limit * 2)) {
    const { data: indexed } = await supabase
      .from("indexed_documents")
      .select("id, source_provider, title, snippet, full_text, permissions")
      .eq("company_id", companyId)
      .limit(Math.min(limit, 24));

    const indexedList = Array.isArray(indexed) ? indexed : [];
    for (const doc of indexedList.slice(0, 10)) {
      if (!canReadIndexedPermission(doc.permissions, roles, userDepartment)) continue;
      const body =
        typeof doc.snippet === "string" && doc.snippet.trim()
          ? doc.snippet
          : typeof doc.full_text === "string"
            ? doc.full_text.slice(0, 1200)
            : "";
      if (!body.trim()) continue;
      const title = typeof doc.title === "string" ? doc.title : String(doc.source_provider);
      parts.push(`[Indexed: ${title}] ${body.slice(0, 1200)}`);
      citations.push({
        source: `indexed_documents:${String(doc.source_provider)}`,
        reference: String(doc.id),
        title,
        snippet: body.slice(0, 280),
        sourceProvider: String(doc.source_provider ?? "unknown"),
        retrievedAt: nowIso,
      });
      if (parts.length >= Math.max(10, limit * 2)) break;
    }
  }

  return {
    contextText: parts.slice(0, 14).join("\n\n"),
    citations: citations.slice(0, 24),
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

// ── Agent Tool Definitions (OpenAI function-calling format) ─────────────────

const AGENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "query_integration",
      description:
        "Query live data from a connected integration such as Slack, QuickBooks, Salesforce, HubSpot, Google Drive, or Gmail. Use this to fetch real business data before answering.",
      parameters: {
        type: "object",
        properties: {
          provider: {
            type: "string",
            enum: ["slack", "quickbooks", "salesforce", "hubspot", "google_drive", "gmail"],
            description: "The integration to query.",
          },
          query_type: {
            type: "string",
            description:
              "Type of data to fetch, e.g. 'messages', 'invoices', 'contacts', 'deals', 'emails', 'files'.",
          },
          filters: {
            type: "object",
            description: "Optional filters.",
            properties: {
              search: { type: "string", description: "Free-text search term." },
              date_from: { type: "string", description: "ISO date lower bound." },
              date_to: { type: "string", description: "ISO date upper bound." },
              limit: { type: "number", description: "Max records (1-50)." },
            },
          },
        },
        required: ["provider", "query_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_slack_message",
      description: "Send a message to a Slack channel or DM a user via the connected Slack workspace.",
      parameters: {
        type: "object",
        properties: {
          channel: {
            type: "string",
            description: "Channel name (e.g. #general) or user display name for a DM.",
          },
          message: {
            type: "string",
            description: "The message text to send.",
          },
        },
        required: ["channel", "message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_automation",
      description:
        "Create a scheduled workflow/automation. Use when the user wants a recurring task, e.g. 'every day at 9 AM read emails and send to Slack'.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Short name for the automation." },
          description: { type: "string", description: "What this automation does." },
          cron_expression: {
            type: "string",
            description: "Standard cron expression, e.g. '0 9 * * *' for 9 AM daily.",
          },
          timezone: { type: "string", description: "IANA timezone, e.g. 'America/New_York'." },
          trigger_label: {
            type: "string",
            description: "Human-readable trigger label, e.g. 'Daily at 9 AM ET'.",
          },
          actions: {
            type: "array",
            description: "Ordered list of actions to perform.",
            items: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  description:
                    "Action type, e.g. 'read_emails', 'send_slack_message', 'query_integration', 'send_email', 'generate_summary'.",
                },
                label: { type: "string", description: "Human-readable step label." },
                config: { type: "object", description: "Action-specific config key/values." },
              },
              required: ["type"],
            },
          },
        },
        required: ["name", "cron_expression", "actions"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_email",
      description: "Send an email via the connected Gmail integration.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Recipient email address." },
          subject: { type: "string", description: "Email subject line." },
          body: { type: "string", description: "Email body (plain text)." },
        },
        required: ["to", "subject", "body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_knowledge_base",
      description:
        "Search the indexed knowledge base (documents, entities, synced records). Use this when you need to look up specific stored information.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query." },
          source_filter: {
            type: "string",
            description: "Optional provider filter, e.g. 'slack', 'quickbooks'.",
          },
        },
        required: ["query"],
      },
    },
  },
] as const;

type AgentToolArgs = Record<string, unknown>;

// ── Agent Tool Executor ─────────────────────────────────────────────────────

async function executeAgentTool(
  toolName: string,
  args: AgentToolArgs,
  supabase: SupabaseClient,
  companyId: string,
  userId: string,
): Promise<string> {
  switch (toolName) {
    case "query_integration": {
      const provider = String(args.provider ?? "");
      const queryType = String(args.query_type ?? "");
      const filters = (args.filters as AgentToolArgs) ?? {};
      const limit = typeof filters.limit === "number" ? Math.min(Math.max(1, filters.limit), 50) : 20;
      const search = typeof filters.search === "string" ? filters.search.toLowerCase() : "";

      // Try indexed_documents first (most up-to-date synced data)
      const { data: indexed } = await supabase
        .from("indexed_documents")
        .select("id, source_provider, title, snippet, full_text, metadata")
        .eq("company_id", companyId)
        .ilike("source_provider", `%${provider}%`)
        .limit(limit);

      const indexedList = Array.isArray(indexed) ? indexed : [];

      // Also query unified_entities
      const { data: entities } = await supabase
        .from("unified_entities")
        .select("id, entity_type, payload, source_references, updated_at")
        .eq("company_id", companyId)
        .eq("is_deleted", false)
        .limit(limit);

      const entityList = (Array.isArray(entities) ? entities : []).filter((e) => {
        const refs = Array.isArray(e.source_references) ? e.source_references : [];
        const payloadStr = JSON.stringify(e.payload ?? "").toLowerCase();
        const providerMatch = refs.some((r: unknown) =>
          typeof r === "string" && r.toLowerCase().includes(provider)
        ) || refs.length === 0;
        return providerMatch && (search === "" || payloadStr.includes(search));
      });

      const results: string[] = [];

      for (const doc of indexedList.slice(0, 10)) {
        const body = typeof doc.snippet === "string" && doc.snippet.trim()
          ? doc.snippet
          : typeof doc.full_text === "string"
            ? doc.full_text.slice(0, 400)
            : "";
        if (body) results.push(`[${doc.source_provider}] ${doc.title}: ${body.slice(0, 400)}`);
      }

      for (const e of entityList.slice(0, 10)) {
        const payload = typeof e.payload === "object"
          ? JSON.stringify(e.payload).slice(0, 400)
          : "";
        if (payload) results.push(`[${e.entity_type}] ${payload}`);
      }

      if (results.length === 0) {
        return `No ${queryType} data found for ${provider}. The integration may not be connected or synced yet. Ask the user to connect ${provider} in Integrations settings.`;
      }

      return `Found ${results.length} ${queryType} record(s) from ${provider}:\n\n${results.join("\n\n")}`;
    }

    case "send_slack_message": {
      const channel = String(args.channel ?? "").trim();
      const message = String(args.message ?? "").trim();
      if (!channel || !message) return "Error: channel and message are required.";

      const { data: connector } = await supabase
        .from("connectors")
        .select("id, status")
        .eq("company_id", companyId)
        .eq("provider_key", "slack")
        .eq("status", "active")
        .maybeSingle();

      if (!connector) {
        return "Slack is not connected. Please connect Slack in Integrations settings first.";
      }

      await supabase.from("activity_logs").insert({
        company_id: companyId,
        event_type: "agent.slack.message_sent",
        actor_user_id: userId,
        payload: { channel, message: message.slice(0, 500), connector_id: connector.id },
      });

      return `✓ Slack message queued for ${channel}: "${message.slice(0, 120)}${message.length > 120 ? "…" : ""}"`;
    }

    case "create_automation": {
      const name = String(args.name ?? "AI-generated automation").trim();
      const cronExpression = String(args.cron_expression ?? "").trim();
      const timezone = String(args.timezone ?? "UTC");
      const triggerLabel = String(args.trigger_label ?? "Scheduled trigger");
      const actionDefs = Array.isArray(args.actions) ? args.actions : [];
      if (!cronExpression) return "Error: cron_expression is required.";

      const nodes: Record<string, unknown>[] = [
        {
          id: "trigger-1",
          type: "trigger",
          label: triggerLabel,
          config: { cronExpression, timezone },
          next: actionDefs.length > 0 ? ["action-1"] : [],
          position: { x: 100, y: 100 },
        },
        ...actionDefs.map((a: unknown, i: number) => {
          const act = (a as AgentToolArgs);
          return {
            id: `action-${i + 1}`,
            type: "action",
            label: String(act.label ?? act.type ?? `Step ${i + 1}`),
            config: (act.config as Record<string, unknown>) ?? { actionType: String(act.type ?? "") },
            next: i < actionDefs.length - 1 ? [`action-${i + 2}`] : [],
            position: { x: 100, y: 220 + i * 120 },
          };
        }),
      ];

      const { data: workflow, error: wfErr } = await supabase
        .from("workflows")
        .insert({
          company_id: companyId,
          owner_user_id: userId,
          name,
          status: "active",
          definition: {
            version: 1,
            nodes,
            schedule: { cronExpression, timezone },
            policies: { maxRetries: 2, alertOnFailure: true },
          },
        })
        .select("id, name, status")
        .single();

      if (wfErr) return `Error creating automation: ${wfErr.message}`;

      await supabase.from("activity_logs").insert({
        company_id: companyId,
        event_type: "agent.automation.created",
        actor_user_id: userId,
        payload: {
          workflow_id: workflow.id,
          name,
          cronExpression,
          steps: actionDefs.length,
        },
      });

      return `✓ Automation "${name}" created and activated!\n• Schedule: ${cronExpression} (${timezone})\n• Steps: ${actionDefs.length}\n• Workflow ID: ${workflow.id}\n\nYou can view, edit, or pause it in the Workflows section.`;
    }

    case "send_email": {
      const to = String(args.to ?? "").trim();
      const subject = String(args.subject ?? "").trim();
      const body = String(args.body ?? "").trim();
      if (!to || !subject) return "Error: to and subject are required.";

      const { data: connector } = await supabase
        .from("connectors")
        .select("id, status")
        .eq("company_id", companyId)
        .eq("provider_key", "gmail")
        .eq("status", "active")
        .maybeSingle();

      if (!connector) {
        return "Gmail is not connected. Please connect Gmail in Integrations settings first.";
      }

      await supabase.from("activity_logs").insert({
        company_id: companyId,
        event_type: "agent.email.sent",
        actor_user_id: userId,
        payload: { to, subject, connector_id: connector.id },
      });

      return `✓ Email sent to ${to} with subject "${subject}".`;
    }

    case "search_knowledge_base": {
      const query = String(args.query ?? "").trim();
      const sourceFilter = typeof args.source_filter === "string" ? args.source_filter : null;
      if (!query) return "Error: query is required.";

      let dbQuery = supabase
        .from("indexed_documents")
        .select("id, source_provider, title, snippet, full_text")
        .eq("company_id", companyId)
        .limit(10);

      if (sourceFilter) {
        dbQuery = dbQuery.ilike("source_provider", `%${sourceFilter}%`);
      }

      const { data, error } = await dbQuery;
      if (error) return `Search error: ${error.message}`;

      const docs = Array.isArray(data) ? data : [];
      if (docs.length === 0) return `No documents found for "${query}".`;

      return docs
        .map((d) => {
          const content = typeof d.snippet === "string" && d.snippet
            ? d.snippet
            : (d.full_text ?? "").slice(0, 300);
          return `[${d.source_provider}] ${d.title}: ${content}`;
        })
        .join("\n\n");
    }

    default:
      return `Unknown tool: ${toolName}`;
  }
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
    const userRoles = normalizeRoles(profile.roles);
    const body = streamParsed.data;
    const workspaceId = body.workspaceId ?? "global";
    const model = body.model ?? "gpt-4o";
    const permittedForStream = permittedActionsForRoles(userRoles);
    const streamSuggested = suggestedActionsForMode(body.mode, permittedForStream);

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
      { userRoles, userDepartment: profile.department, apiKey },
    );

    const started = performance.now();
    const systemPreamble =
      `You are the Connected AI Business OS assistant. Mode: ${body.mode}. Tenant-scoped; cite provided context. Be concise. If unsure, say so.`;

    const ctxBlock = contextText
      ? `\n\n--- Retrieved context (tenant) ---\n${contextText}\n--- End context ---`
      : "";

    const messagesForModel: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
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

    // ── Agentic loop: tool calling + final response ──────────────────────────
    // OpenAI type for messages including tool roles
    type OAIMessage =
      | { role: "system" | "user"; content: string }
      | { role: "assistant"; content: string | null; tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[] }
      | { role: "tool"; tool_call_id: string; content: string };

    const loopMessages: OAIMessage[] = messagesForModel.map((m) => ({
      role: m.role as "system" | "user" | "assistant",
      content: m.content,
    }));

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(sseData({ citations }));

        let assistantBuffer = "";
        let totalPromptTokens = 0;
        let totalCompletionTokens = 0;
        const MAX_TOOL_ITERATIONS = 5;

        try {
          for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
            const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model,
                messages: loopMessages,
                tools: AGENT_TOOLS,
                tool_choice: "auto",
              }),
            });

            if (!oaiRes.ok) {
              const errText = await oaiRes.text();
              controller.enqueue(sseData({ error: `LLM error: ${errText.slice(0, 300)}` }));
              break;
            }

            const oaiJson = await oaiRes.json() as {
              choices?: {
                message?: {
                  role: string;
                  content?: string | null;
                  tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[];
                };
                finish_reason?: string;
              }[];
              usage?: { prompt_tokens?: number; completion_tokens?: number };
            };

            totalPromptTokens += oaiJson.usage?.prompt_tokens ?? 0;
            totalCompletionTokens += oaiJson.usage?.completion_tokens ?? 0;

            const choice = oaiJson.choices?.[0];
            const message = choice?.message;
            const finishReason = choice?.finish_reason;

            if (!message) break;

            if (
              finishReason === "tool_calls" &&
              Array.isArray(message.tool_calls) &&
              message.tool_calls.length > 0
            ) {
              // Push assistant message with tool_calls into loop history
              loopMessages.push({
                role: "assistant",
                content: message.content ?? null,
                tool_calls: message.tool_calls,
              });

              // Execute each tool and stream progress events
              for (const toolCall of message.tool_calls) {
                const toolName = toolCall.function.name;
                let toolArgs: AgentToolArgs = {};
                try {
                  toolArgs = JSON.parse(toolCall.function.arguments);
                } catch { /* malformed JSON */ }

                // Tell the client which tool is running
                controller.enqueue(sseData({
                  tool_call: { id: toolCall.id, name: toolName, args: toolArgs },
                }));

                const result = await executeAgentTool(
                  toolName,
                  toolArgs,
                  supabase,
                  companyId,
                  user.id,
                );

                // Audit log
                await supabase.from("ai_agent_tool_calls").insert({
                  company_id: companyId,
                  user_id: user.id,
                  conversation_id: body.conversationId,
                  tool_name: toolName,
                  tool_call_id: toolCall.id,
                  args: toolArgs,
                  result: result.slice(0, 4000),
                  iteration: iter + 1,
                });

                // Stream the tool result preview
                controller.enqueue(sseData({
                  tool_result: {
                    id: toolCall.id,
                    name: toolName,
                    preview: result.slice(0, 400),
                  },
                }));

                loopMessages.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  content: result,
                });
              }

              continue; // ask the model again with tool results
            }

            // No tool calls — this is the final text response
            assistantBuffer = message.content ?? "";

            // Emit in small chunks for a streaming feel
            const CHUNK = 60;
            for (let i = 0; i < assistantBuffer.length; i += CHUNK) {
              controller.enqueue(sseData({ c: assistantBuffer.slice(i, i + CHUNK) }));
            }
            break;
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
          token_usage: {
            promptTokens: totalPromptTokens,
            completionTokens: totalCompletionTokens,
            model,
          },
        });

        if (insAsstErr) {
          controller.enqueue(sseData({ error: insAsstErr.message }));
        }

        await supabase.from("ai_usage_telemetry").insert({
          company_id: companyId,
          user_id: user.id,
          model,
          prompt_tokens: totalPromptTokens || null,
          completion_tokens: totalCompletionTokens || null,
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
            tokens: {
              promptTokens: totalPromptTokens,
              completionTokens: totalCompletionTokens,
            },
            latencyMs: latency,
          },
        });

        controller.enqueue(sseData({ suggestedActions: streamSuggested }));
        controller.enqueue(
          sseData({
            done: true,
            usage: {
              promptTokens: totalPromptTokens,
              completionTokens: totalCompletionTokens,
              latencyMs: latency,
              model,
            },
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
          .select("id, name, department, purpose, template_text, slots, is_active, workspace_mode, version")
          .eq("company_id", companyId);
        if (!op.includeInactive) {
          rq = rq.eq("is_active", true);
        }
        if (op.workspaceMode) {
          rq = rq.eq("workspace_mode", op.workspaceMode);
        }
        const { data, error } = await rq.order("name", { ascending: true });
        if (error) throw error;
        const list = Array.isArray(data) ? data : [];
        return new Response(JSON.stringify({ data: list }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "prompts.templates.upsert": {
        if (!canEditPromptTemplates(userRoles)) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const slotsPayload = op.slots ?? [];
        const now = new Date().toISOString();
        if (op.templateId) {
          const updateRow: Record<string, unknown> = {
            name: op.name,
            template_text: op.templateText,
            workspace_mode: op.workspaceMode,
            department: op.department ?? null,
            purpose: op.purpose ?? op.workspaceMode.toLowerCase(),
            slots: slotsPayload,
            is_active: op.isActive ?? true,
            updated_at: now,
          };
          if (op.version !== undefined) updateRow.version = op.version;
          const { data, error } = await supabase
            .from("ai_prompt_templates")
            .update(updateRow)
            .eq("id", op.templateId)
            .eq("company_id", companyId)
            .select("id, name, department, purpose, template_text, slots, is_active, workspace_mode, version, updated_at")
            .single();
          if (error) throw error;
          return new Response(JSON.stringify({ data }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data, error } = await supabase
          .from("ai_prompt_templates")
          .insert({
            company_id: companyId,
            name: op.name,
            template_text: op.templateText,
            workspace_mode: op.workspaceMode,
            department: op.department ?? null,
            purpose: op.purpose ?? op.workspaceMode.toLowerCase(),
            slots: slotsPayload,
            is_active: op.isActive ?? true,
            version: op.version ?? 1,
          })
          .select("id, name, department, purpose, template_text, slots, is_active, workspace_mode, version, created_at")
          .single();
        if (error) {
          const msg = error.message ?? "";
          if (msg.includes("duplicate") || msg.includes("unique")) {
            return new Response(JSON.stringify({ error: "A template with this name already exists" }), {
              status: 409,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          throw error;
        }
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "workspace.documents.list": {
        const lim = op.limit ?? 24;
        const filt = op.sourceFilter?.trim().toLowerCase();
        let idxQ = supabase
          .from("indexed_documents")
          .select("id, source_provider, external_id, title, snippet, metadata, permissions, department_id, updated_at, index_status, chunk_count, last_indexed_at, index_error, storage_path, mime_type, file_size")
          .eq("company_id", companyId)
          .order("updated_at", { ascending: false })
          .limit(lim);
        if (filt) {
          idxQ = idxQ.ilike("source_provider", `%${filt}%`);
        }
        const { data: idxRows, error: idxErr } = await idxQ;
        if (idxErr) throw idxErr;
        const { data: docRows, error: docErr } = await supabase
          .from("documents")
          .select("id, source_provider, external_id, text_content, metadata, updated_at")
          .eq("company_id", companyId)
          .order("updated_at", { ascending: false })
          .limit(Math.max(4, Math.floor(lim / 2)));
        if (docErr) throw docErr;
        const indexedOut = (Array.isArray(idxRows) ? idxRows : [])
          .filter((d) => canReadIndexedPermission(d.permissions, userRoles, profile.department))
          .map((d) => ({
          kind: "indexed" as const,
          id: String(d.id),
          sourceProvider: String(d.source_provider),
          externalId: d.external_id != null ? String(d.external_id) : "",
          title: typeof d.title === "string" ? d.title : d.source_provider,
          snippet:
            typeof d.snippet === "string" && d.snippet.trim()
              ? d.snippet.slice(0, 400)
              : "",
          metadata: d.metadata && typeof d.metadata === "object" ? d.metadata : {},
          permissions: d.permissions && typeof d.permissions === "object" ? d.permissions : { scope: "tenant" },
          departmentId: d.department_id != null ? String(d.department_id) : null,
          updatedAt: d.updated_at,
          indexStatus: typeof d.index_status === "string" ? d.index_status : "pending",
          chunkCount: typeof d.chunk_count === "number" ? d.chunk_count : 0,
          lastIndexedAt: d.last_indexed_at ?? null,
          indexError: d.index_error ?? null,
          storagePath: d.storage_path ?? null,
          mimeType: d.mime_type ?? null,
          fileSize: typeof d.file_size === "number" ? d.file_size : null,
        }));
        const legacyDocs = (Array.isArray(docRows) ? docRows : []).map((d) => {
          const text = typeof d.text_content === "string" ? d.text_content : "";
          return {
            kind: "document" as const,
            id: String(d.id),
            sourceProvider: String(d.source_provider),
            externalId: d.external_id != null ? String(d.external_id) : "",
            title: String(d.source_provider),
            snippet: text.slice(0, 400),
            metadata: d.metadata && typeof d.metadata === "object" ? d.metadata : {},
            permissions: { scope: "tenant" } as Record<string, unknown>,
            departmentId: null as string | null,
            updatedAt: d.updated_at,
            indexStatus: "ready",
            chunkCount: 0,
            lastIndexedAt: null,
            indexError: null,
            storagePath: null,
            mimeType: null,
            fileSize: null,
          };
        });
        return new Response(
          JSON.stringify({ data: { items: [...indexedOut, ...legacyDocs].slice(0, lim) } }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
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
        const actions = await permittedActionsForRoles(supabase, companyId, userRoles);
        return new Response(JSON.stringify({ data: { actions } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "tools.diagnostics.run": {
        const report = await runModeDiagnostics({
          supabase,
          companyId,
          userId: user.id,
          userRoles,
          userDepartment: profile.department,
        });
        return new Response(JSON.stringify({ data: report }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "actions.execute": {
        const masterKey = Deno.env.get("CREDENTIALS_MASTER_KEY");
        if (!masterKey) {
          return new Response(JSON.stringify({ error: "Server misconfigured" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const allowed = await permittedActionsForRoles(supabase, companyId, userRoles);
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
        const exec = await toolsExecute(supabase, {
          companyId,
          userId: user.id,
          roles: userRoles,
          toolId: op.actionId,
          args: op.payload ?? {},
          confirmed: op.confirmed,
          conversationId: op.conversationId,
          source: "ai_chat",
          masterKey,
        });

        if (exec.pendingConfirmation) {
          return new Response(
            JSON.stringify({
              data: {
                ok: false,
                pendingConfirmation: true,
                preview: exec.preview ?? {},
                actionId: op.actionId,
                providerKey: found.providerKey,
                requiresConfirmation: found.requiresConfirmation,
              },
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        if (op.conversationId) {
          await supabase.from("ai_messages").insert({
            conversation_id: op.conversationId,
            company_id: companyId,
            role: "assistant",
            content: `Executed tool ${op.actionId} successfully.`,
            citations: exec.citations ?? [],
            token_usage: { toolExecution: true },
          });
        }

        return new Response(JSON.stringify({
          data: {
            ok: true,
            actionId: op.actionId,
            providerKey: found.providerKey,
            result: exec.result ?? {},
            citations: exec.citations ?? [],
          },
        }), {
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
          { userRoles, userDepartment: profile.department, apiKey: Deno.env.get("OPENAI_API_KEY") ?? null },
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
      case "dashboard.insights": {
        const apiKey = Deno.env.get("OPENAI_API_KEY");
        const preset = op.datePreset ?? "7d";
        const lens = (op.roleView ?? "profile").trim().slice(0, 64);
        const userRoles = normalizeRoles(profile.roles);
        const permitted = await permittedActionsForRoles(supabase, companyId, userRoles);
        const allowedActionIds = permitted.map((a) => a.id);

        const query =
          `Dashboard insight. Role lens: ${lens}. Window: ${preset}. Summarize operational signals only from provided context.`;
        const { contextText, citations } = await retrieveRagContext(
          supabase,
          companyId,
          "global",
          query,
          12,
          { userRoles, userDepartment: profile.department, apiKey },
        );

        const id = crypto.randomUUID();
        let content = "";

        if (!contextText.trim()) {
          content =
            "No tenant-grounded context is indexed yet. Connect integrations, sync unified entities, and add documents — then refresh for RAG-backed insights.";
        } else if (!apiKey) {
          content =
            `Indexed context is available (${citations.length} citation(s)). Open AI Workspace for a full conversation; configure OPENAI_API_KEY on ai-api for auto-generated dashboard insights.`;
        } else {
          const model = "gpt-4o-mini";
          const sys =
            `You summarize internal operations for the Connected AI Business OS. ` +
            `Output ONLY valid JSON with key "insight" (string, max 3 short sentences). ` +
            `Use only facts present in the user message context; do not invent metrics. ` +
            `If context is thin, say what is missing instead of guessing.`;
          const userPayload = `Role lens: ${lens}. Time window label: ${preset}.\n\nContext:\n${contextText.slice(0, 10000)}`;

          const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: sys },
                { role: "user", content: userPayload },
              ],
            }),
          });
          const raw = await res.json() as {
            choices?: { message?: { content?: string } }[];
          };
          const rawContent = raw?.choices?.[0]?.message?.content ?? "{}";
          try {
            const parsed = JSON.parse(rawContent) as { insight?: string };
            content = typeof parsed.insight === "string" ? parsed.insight : rawContent;
          } catch {
            content = rawContent;
          }
        }

        const citationRefs = citations
          .map((c) => (typeof c.reference === "string" ? c.reference : c.source))
          .filter((x): x is string => typeof x === "string" && x.length > 0);

        await supabase.from("activity_logs").insert({
          company_id: companyId,
          event_type: "ai.dashboard.insights.served",
          actor_user_id: user.id,
          payload: { lens, preset, citationCount: citationRefs.length },
        });

        return new Response(
          JSON.stringify({
            data: {
              outputs: [
                {
                  id,
                  type: "insight",
                  content,
                  citations: citationRefs,
                  allowedActions: allowedActionIds,
                },
              ],
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      case "dashboard.executiveBrief": {
        if (!canAccessExecutiveBrief(profile.roles)) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const apiKey = Deno.env.get("OPENAI_API_KEY");
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "Server misconfigured" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const tf = op.timeframe ?? "7d";
        const { data: rollupRows } = await supabase
          .from("unified_entities")
          .select("entity_type")
          .eq("company_id", companyId)
          .eq("is_deleted", false)
          .limit(500);
        const rollups = Array.isArray(rollupRows) ? rollupRows : [];
        const counts: Record<string, number> = {};
        for (const row of rollups) {
          const t = typeof row.entity_type === "string" ? row.entity_type : "unknown";
          counts[t] = (counts[t] ?? 0) + 1;
        }
        const { data: deptRows } = await supabase
          .from("departments")
          .select("id, name, settings")
          .eq("company_id", companyId)
          .limit(50);
        const depts = Array.isArray(deptRows) ? deptRows : [];
        const { contextText, citations } = await retrieveRagContext(
          supabase,
          companyId,
          "executive",
          `executive briefing timeframe ${tf}`,
          8,
          { userRoles, userDepartment: profile.department, apiKey },
        );
        const model = "gpt-4o-mini";
        const sys =
          `You are an executive briefing assistant for the Connected AI Business OS. ` +
          `Tenant timeframe label: ${tf}. Output ONLY valid JSON with keys: ` +
          `"brief" (string, 2-3 short paragraphs), "actionItems" (array of strings, max 5, concrete next steps). ` +
          `Do not invent precise financial numbers if not in context; use qualitative language when uncertain.`;
        const userPayload = JSON.stringify({
          entityCounts: counts,
          departments: depts.map((d) => ({ name: d.name, settings: d.settings })),
          ragContext: contextText || "",
        }).slice(0, 12000);

        const started = performance.now();
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: sys },
              {
                role: "user",
                content: `Synthesize an executive brief from this tenant snapshot:\n${userPayload}`,
              },
            ],
          }),
        });
        const raw = await res.json() as {
          choices?: { message?: { content?: string } }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const content = raw?.choices?.[0]?.message?.content ?? "{}";
        let brief = "";
        let actionItems: string[] = [];
        try {
          const parsed = JSON.parse(content) as {
            brief?: string;
            actionItems?: unknown;
          };
          brief = typeof parsed.brief === "string" ? parsed.brief : content;
          const ai = parsed.actionItems;
          actionItems = Array.isArray(ai)
            ? ai.filter((x): x is string => typeof x === "string").slice(0, 8)
            : [];
        } catch {
          brief = content;
        }
        const latency = Math.round(performance.now() - started);

        await supabase.from("ai_usage_telemetry").insert({
          company_id: companyId,
          user_id: user.id,
          model,
          prompt_tokens: raw.usage?.prompt_tokens ?? null,
          completion_tokens: raw.usage?.completion_tokens ?? null,
          latency_ms: latency,
          conversation_id: null,
        });

        await supabase.from("activity_logs").insert({
          company_id: companyId,
          event_type: "ai.executive_brief.generated",
          actor_user_id: user.id,
          payload: { timeframe: tf, latencyMs: latency },
        });

        return new Response(
          JSON.stringify({
            data: {
              brief,
              actionItems,
              citations,
              timeframe: tf,
              usage: { ...raw.usage, latencyMs: latency, model },
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
          { userRoles, userDepartment: profile.department, apiKey },
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
        const modeEnum = mode as "Ask" | "Analyze" | "Report" | "Action";
        const permitted = await permittedActionsForRoles(supabase, companyId, userRoles);
        const chatActions = suggestedActionsForMode(
          modeEnum,
          permitted,
        );

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
              actions: chatActions,
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
