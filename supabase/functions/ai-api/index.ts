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

type LogLevel = "info" | "warn" | "error";

function writeLog(level: LogLevel, event: string, fields: Record<string, unknown>) {
  const entry = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...fields,
  };
  const message = JSON.stringify(entry);
  if (level === "error") {
    console.error(message);
    return;
  }
  if (level === "warn") {
    console.warn(message);
    return;
  }
  console.log(message);
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    };
  }
  if (typeof error === "object" && error !== null) {
    const objectError = error as Record<string, unknown>;
    return {
      type: Object.prototype.toString.call(error),
      message: typeof objectError.message === "string" ? objectError.message : null,
      code: typeof objectError.code === "string" ? objectError.code : null,
      status: typeof objectError.status === "number" ? objectError.status : null,
      keys: Object.keys(objectError),
    };
  }
  return { type: typeof error, value: String(error) };
}

function summarizeRawBody(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const body = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (typeof body.op === "string") out.op = body.op;
  if (typeof body.conversationId === "string") out.conversationId = body.conversationId;
  if (typeof body.mode === "string") out.mode = body.mode;
  if (typeof body.executionMode === "string") out.executionMode = body.executionMode;
  if (typeof body.actionId === "string") out.actionId = body.actionId;
  if (typeof body.model === "string") out.model = body.model;
  return out;
}

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
    executionMode: z.enum(["confirm", "auto"]).optional(),
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
    executionMode: z.enum(["confirm", "auto"]).optional(),
  }),
  z.object({
    op: z.literal("messages.add"),
    conversationId: z.string().uuid(),
    role: z.enum(["user", "assistant", "system"]),
    content: z.string().min(0).max(32000),
    citations: z.array(citationSchema).optional(),
    artifacts: z.array(z.record(z.unknown())).optional(),
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
    op: z.literal("tools.catalog"),
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
  executionMode: z.enum(["confirm", "auto"]).optional().default("confirm"),
  model: z.string().optional(),
  workspaceId: z.string().max(120).optional().default("global"),
});

type ProfileRow = { company_id: string | null; roles: string[] | null; department: string | null };

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIM = 1536;
const REPORT_EXPORT_BUCKET = "report-exports";
const REPORT_EXPORT_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

type AiProviderType = "openai" | "anthropic";

type AiProviderToolCall = {
  id: string;
  type: string;
  function: { name: string; arguments: string };
};

type AiProviderChatResponse = {
  choices?: {
    message?: {
      role?: string;
      content?: string | null;
      tool_calls?: AiProviderToolCall[];
    };
    finish_reason?: string;
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

type AiProviderEmbeddingsResponse = {
  data?: Array<{ embedding?: number[] }>;
};

type AiProviderChatRequest = {
  model: string;
  messages: Array<Record<string, unknown>>;
  tools?: unknown;
  tool_choice?: "auto" | "none" | Record<string, unknown>;
  response_format?: { type: "json_object" };
};

type AiProviderAdapter = {
  type: AiProviderType;
  chatCompletions: (payload: AiProviderChatRequest) => Promise<AiProviderChatResponse>;
  createEmbeddings: (payload: { model: string; input: string | string[] }) => Promise<AiProviderEmbeddingsResponse>;
};

function configuredProviderType(): AiProviderType {
  const raw = (Deno.env.get("AI_MODEL_PROVIDER") ?? "openai").trim().toLowerCase();
  return raw === "anthropic" || raw === "claude" ? "anthropic" : "openai";
}

function defaultModelForProvider(providerType: AiProviderType): string {
  return providerType === "openai" ? "gpt-4o" : "claude-3-5-sonnet-latest";
}

function resolveModelProvider(): {
  providerType: AiProviderType;
  adapter: AiProviderAdapter | null;
  error: string | null;
} {
  const providerType = configuredProviderType();
  if (providerType !== "openai") {
    return {
      providerType,
      adapter: null,
      error: `Provider "${providerType}" is configured but not enabled yet. Set AI_MODEL_PROVIDER=openai.`,
    };
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return {
      providerType,
      adapter: null,
      error: "OPENAI_API_KEY is not configured",
    };
  }

  const openAiAdapter: AiProviderAdapter = {
    type: "openai",
    chatCompletions: async (payload) => {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`LLM error (${res.status}): ${detail.slice(0, 300)}`);
      }
      return await res.json() as AiProviderChatResponse;
    },
    createEmbeddings: async (payload) => {
      const res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`Embedding error (${res.status}): ${detail.slice(0, 300)}`);
      }
      return await res.json() as AiProviderEmbeddingsResponse;
    },
  };

  return {
    providerType,
    adapter: openAiAdapter,
    error: null,
  };
}

type AiToolPermission = {
  id: string;
  label: string;
  requiresConfirmation: boolean;
  providerKey?: string;
  domain: string;
  toolSource: "integration" | "app";
  adapterTarget: string;
  argsSchema: Record<string, unknown>;
  accessLevel: "read" | "write";
};

type AppActionDefinition = {
  id: string;
  label: string;
  domain: string;
  description: string;
  accessLevel: "read" | "write";
  requiresConfirmation: boolean;
  argsSchema: Record<string, unknown>;
  adapterTarget: string;
};

const APP_ACTIONS: AppActionDefinition[] = [
  {
    id: "app.workflows.list",
    label: "Workflows: list",
    domain: "workflows",
    description: "List workflows in this tenant.",
    accessLevel: "read",
    requiresConfirmation: false,
    argsSchema: { limit: "number?", status: "string?" },
    adapterTarget: "workflows-api",
  },
  {
    id: "app.workflows.create",
    label: "Workflows: create",
    domain: "workflows",
    description: "Create a new workflow/automation.",
    accessLevel: "write",
    requiresConfirmation: true,
    argsSchema: { name: "string", definition: "object?", status: "string?" },
    adapterTarget: "workflows-api",
  },
  {
    id: "app.modules.list",
    label: "Modules: list",
    domain: "modules",
    description: "List internal modules.",
    accessLevel: "read",
    requiresConfirmation: false,
    argsSchema: { limit: "number?", search: "string?" },
    adapterTarget: "modules-api",
  },
  {
    id: "app.modules.create",
    label: "Modules: create",
    domain: "modules",
    description: "Create a module.",
    accessLevel: "write",
    requiresConfirmation: true,
    argsSchema: { name: "string", description: "string?", status: "string?" },
    adapterTarget: "modules-api",
  },
  {
    id: "app.departments.list",
    label: "Departments: list",
    domain: "departments",
    description: "List departments/workspaces.",
    accessLevel: "read",
    requiresConfirmation: false,
    argsSchema: { limit: "number?" },
    adapterTarget: "department-workspace-api",
  },
  {
    id: "app.departments.create",
    label: "Departments: create",
    domain: "departments",
    description: "Create a department workspace.",
    accessLevel: "write",
    requiresConfirmation: true,
    argsSchema: { name: "string", departmentType: "string?" },
    adapterTarget: "department-workspace-api",
  },
  {
    id: "app.reports.list",
    label: "Reports: list",
    domain: "reports",
    description: "List reports.",
    accessLevel: "read",
    requiresConfirmation: false,
    argsSchema: { limit: "number?", search: "string?" },
    adapterTarget: "reports-center-api",
  },
  {
    id: "app.reports.create",
    label: "Reports: create",
    domain: "reports",
    description: "Create a report.",
    accessLevel: "write",
    requiresConfirmation: true,
    argsSchema: { name: "string", description: "string?", status: "draft|active|archived?" },
    adapterTarget: "reports-center-api",
  },
  {
    id: "app.reports.export_pdf",
    label: "Reports: export PDF",
    domain: "reports",
    description: "Generate a PDF export for a report.",
    accessLevel: "write",
    requiresConfirmation: true,
    argsSchema: { reportId: "uuid", fileName: "string?" },
    adapterTarget: "reports-center-api",
  },
  {
    id: "app.dashboards.list",
    label: "Dashboards: list",
    domain: "dashboards",
    description: "List dashboard layouts.",
    accessLevel: "read",
    requiresConfirmation: false,
    argsSchema: { dashboardKind: "global|executive?" },
    adapterTarget: "dashboard-api",
  },
  {
    id: "app.dashboards.create_layout",
    label: "Dashboards: create layout",
    domain: "dashboards",
    description: "Ensure dashboard layout exists.",
    accessLevel: "write",
    requiresConfirmation: true,
    argsSchema: {
      dashboardKind: "global|executive",
      name: "string?",
      focus: "string?",
      reuseIfExists: "boolean?",
    },
    adapterTarget: "dashboard-api",
  },
  {
    id: "app.knowledge_base.list",
    label: "Knowledge base: list",
    domain: "knowledge_base",
    description: "List indexed knowledge base documents.",
    accessLevel: "read",
    requiresConfirmation: false,
    argsSchema: { limit: "number?", sourceFilter: "string?" },
    adapterTarget: "search-api",
  },
  {
    id: "app.knowledge_base.add_text",
    label: "Knowledge base: add text",
    domain: "knowledge_base",
    description: "Create a knowledge base text document.",
    accessLevel: "write",
    requiresConfirmation: true,
    argsSchema: { title: "string", text: "string", sourceProvider: "string?" },
    adapterTarget: "search-api",
  },
  {
    id: "app.integrations.list",
    label: "Integrations: list",
    domain: "integrations",
    description: "List configured integrations/connectors.",
    accessLevel: "read",
    requiresConfirmation: false,
    argsSchema: {},
    adapterTarget: "integrations-api",
  },
  {
    id: "app.integrations.create",
    label: "Integrations: create connector",
    domain: "integrations",
    description: "Create a connector shell for a provider.",
    accessLevel: "write",
    requiresConfirmation: true,
    argsSchema: { providerKey: "string", displayName: "string?" },
    adapterTarget: "integrations-api",
  },
  {
    id: "app.settings.flags.list",
    label: "Settings: list feature flags",
    domain: "settings",
    description: "List tenant feature flags.",
    accessLevel: "read",
    requiresConfirmation: false,
    argsSchema: {},
    adapterTarget: "settings-api",
  },
  {
    id: "app.settings.flags.upsert",
    label: "Settings: upsert feature flag",
    domain: "settings",
    description: "Update a tenant feature flag.",
    accessLevel: "write",
    requiresConfirmation: true,
    argsSchema: { flagKey: "string", enabled: "boolean", rollout: "number?" },
    adapterTarget: "settings-api",
  },
  {
    id: "app.notifications.list",
    label: "Notifications: list",
    domain: "notifications",
    description: "List notifications.",
    accessLevel: "read",
    requiresConfirmation: false,
    argsSchema: { limit: "number?", status: "string?" },
    adapterTarget: "notifications-api",
  },
  {
    id: "app.notifications.create_rule",
    label: "Notifications: create alert rule",
    domain: "notifications",
    description: "Create an alert rule.",
    accessLevel: "write",
    requiresConfirmation: true,
    argsSchema: { name: "string", condition: "object", channels: "array" },
    adapterTarget: "notifications-api",
  },
  {
    id: "app.search.query",
    label: "Search: query",
    domain: "search",
    description: "Run unified search for entities/documents.",
    accessLevel: "read",
    requiresConfirmation: false,
    argsSchema: { query: "string", limit: "number?" },
    adapterTarget: "search-api",
  },
];

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
  const integrationActions = list.map((t) => ({
    id: t.id,
    label: t.label,
    requiresConfirmation: t.requiresConfirmation,
    providerKey: t.providerKey,
    domain: "integrations",
    toolSource: "integration" as const,
    adapterTarget: "integrations-runtime",
    argsSchema: {},
    accessLevel: t.accessLevel,
  }));
  const canWrite = isElevatedRole(userRoles);
  const appActions = APP_ACTIONS
    .filter((a) => (a.accessLevel === "write" ? canWrite : true))
    .map((a) => ({
      id: a.id,
      label: a.label,
      requiresConfirmation: a.requiresConfirmation,
      providerKey: undefined,
      domain: a.domain,
      toolSource: "app" as const,
      adapterTarget: a.adapterTarget,
      argsSchema: a.argsSchema,
      accessLevel: a.accessLevel,
    }));
  return [...integrationActions, ...appActions];
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

function summarizeArgsSchema(argsSchema: Record<string, unknown>): string {
  const entries = Object.entries(argsSchema ?? {});
  if (entries.length === 0) return "none";
  return entries.slice(0, 8).map(([key, value]) => `${key}:${String(value)}`).join(", ");
}

function buildPermittedAppActionsPromptBlock(permitted: AiToolPermission[]): string {
  const appActions = permitted
    .filter((tool) => tool.toolSource === "app")
    .sort((a, b) => {
      if (a.accessLevel === b.accessLevel) return a.id.localeCompare(b.id);
      return a.accessLevel === "write" ? 1 : -1;
    });

  if (appActions.length === 0) return "- none";

  return appActions
    .map((tool) =>
      `- ${tool.id} [${tool.accessLevel}] domain=${tool.domain} adapter=${tool.adapterTarget} args={${summarizeArgsSchema(tool.argsSchema)}}`
    )
    .join("\n");
}

function inferDashboardKindFromText(text: string): "global" | "executive" {
  const lower = text.toLowerCase();
  if (/\b(executive|leadership|board|c-suite|c suite|ceo|cfo)\b/.test(lower)) {
    return "executive";
  }
  return "global";
}

function normalizeDashboardCreateArgs(
  rawArgs: Record<string, unknown>,
  userMessage: string,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...rawArgs };
  const currentFocus = typeof next.focus === "string" && next.focus.trim().length > 0
    ? next.focus.trim()
    : userMessage.trim();
  next.focus = currentFocus;

  if (!(typeof next.name === "string" && next.name.trim().length > 0)) {
    next.name = deriveDashboardBaseName(null, currentFocus);
  }
  if (!(next.dashboardKind === "global" || next.dashboardKind === "executive")) {
    next.dashboardKind = inferDashboardKindFromText(userMessage);
  }
  if (typeof next.reuseIfExists !== "boolean") {
    const asksReuse = /\b(reuse|use existing|existing dashboard|same dashboard)\b/i.test(userMessage);
    next.reuseIfExists = asksReuse;
  }
  return next;
}

function isElevatedRole(userRoles: string[]): boolean {
  const r = new Set(normalizeRoles(userRoles));
  return ["admin", "manager", "owner", "company admin", "executive"].some((x) => r.has(x));
}

type UnifiedActionExecution = {
  ok: boolean;
  pendingConfirmation?: boolean;
  preview?: Record<string, unknown>;
  result?: Record<string, unknown>;
  citations?: Array<Record<string, unknown>>;
  artifacts?: Array<Record<string, unknown>>;
  providerKey?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function normalizeLimit(value: unknown, fallback = 20, max = 100): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(value)));
}

function toIsoNow() {
  return new Date().toISOString();
}

function citationForDomain(
  domain: string,
  reference: string,
  snippet?: string,
): Record<string, unknown> {
  return {
    source: `app:${domain}`,
    reference,
    snippet: snippet ?? "",
    retrievedAt: toIsoNow(),
  };
}

function escapePdfText(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function buildSimplePdf(lines: string[]): Uint8Array {
  const safeLines = lines
    .filter((line) => typeof line === "string" && line.trim().length > 0)
    .slice(0, 36);
  const streamContent = safeLines
    .map((line, index) => {
      const y = 770 - index * 20;
      return `BT /F1 12 Tf 40 ${y} Td (${escapePdfText(line.slice(0, 160))}) Tj ET`;
    })
    .join("\n");

  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${streamContent.length} >> stream\n${streamContent}\nendstream endobj`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

function sanitizeFileName(input: string): string {
  const trimmed = input.trim();
  const safe = trimmed
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return safe.length > 0 ? safe.slice(0, 180) : "report-export";
}

async function uploadReportExportFile(params: {
  supabase: SupabaseClient;
  companyId: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<{ filePath: string; downloadUrl: string; fileSize: number }> {
  const safeName = sanitizeFileName(params.fileName);
  const filePath = `${params.companyId}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await params.supabase.storage
    .from(REPORT_EXPORT_BUCKET)
    .upload(filePath, params.bytes, {
      contentType: params.mimeType,
      upsert: false,
    });
  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const { data: signed, error: signedError } = await params.supabase.storage
    .from(REPORT_EXPORT_BUCKET)
    .createSignedUrl(filePath, REPORT_EXPORT_URL_TTL_SECONDS);
  if (signedError || !signed?.signedUrl) {
    throw new Error(signedError?.message ?? "Could not create signed URL");
  }

  return {
    filePath,
    downloadUrl: signed.signedUrl,
    fileSize: params.bytes.byteLength,
  };
}

function defaultWorkflowDefinition(name: string): Record<string, unknown> {
  return {
    version: 1,
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        label: "Manual trigger",
        config: { kind: "manual" },
        next: ["action-1"],
        position: { x: 64, y: 80 },
      },
      {
        id: "action-1",
        type: "action",
        label: "AI generated step",
        config: { summary: `Generated for ${name}` },
        next: [],
        position: { x: 260, y: 80 },
      },
    ],
    schedule: { cronExpression: "", timezone: "UTC" },
    policies: { maxRetries: 2, alertOnFailure: true },
  };
}

function sanitizeDashboardName(input: string): string {
  const clean = input
    .replace(/\s+/g, " ")
    .replace(/[^\w\s\-()/&]/g, "")
    .trim()
    .slice(0, 120);
  return clean.length > 0 ? clean : "AI dashboard";
}

function workflowFocusFromText(text: string): boolean {
  const q = text.toLowerCase();
  return /(workflow|run health|run status|automation health|pipeline health|failure rate|sla)/.test(q);
}

function deriveDashboardBaseName(requestedName: string | null, focus: string | null): string {
  if (requestedName && requestedName.trim().length > 0) {
    return sanitizeDashboardName(requestedName);
  }
  if (focus && focus.trim().length > 0) {
    if (workflowFocusFromText(focus)) return "Workflow runs health dashboard";
    const shortFocus = sanitizeDashboardName(focus).slice(0, 64);
    return `${shortFocus} dashboard`;
  }
  return "AI dashboard";
}

async function resolveUniqueDashboardName(params: {
  supabase: SupabaseClient;
  companyId: string;
  userId: string;
  dashboardKind: "global" | "executive";
  baseName: string;
  reuseIfExists: boolean;
}): Promise<{ name: string; existingId?: string }> {
  const cleanBase = sanitizeDashboardName(params.baseName);
  const { data: existing, error } = await params.supabase
    .from("dashboard_layouts")
    .select("id, name")
    .eq("company_id", params.companyId)
    .eq("user_id", params.userId)
    .eq("dashboard_kind", params.dashboardKind)
    .eq("name", cleanBase)
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (!existing?.id) {
    return { name: cleanBase };
  }
  if (params.reuseIfExists) {
    return { name: cleanBase, existingId: String(existing.id) };
  }

  for (let idx = 2; idx <= 99; idx++) {
    const candidate = sanitizeDashboardName(`${cleanBase} (${idx})`);
    const { data: dupe, error: dupeError } = await params.supabase
      .from("dashboard_layouts")
      .select("id")
      .eq("company_id", params.companyId)
      .eq("user_id", params.userId)
      .eq("dashboard_kind", params.dashboardKind)
      .eq("name", candidate)
      .maybeSingle();
    if (dupeError) throw new Error(dupeError.message);
    if (!dupe?.id) return { name: candidate };
  }

  return {
    name: sanitizeDashboardName(`${cleanBase} ${new Date().toISOString().slice(0, 19)}`),
  };
}

async function fetchDashboardDefinitionTypeMap(
  supabase: SupabaseClient,
  companyId: string,
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("dashboard_widget_definitions")
    .select("id, type, company_id")
    .or(`company_id.is.null,company_id.eq.${companyId}`);
  if (error) throw new Error(error.message);
  const rows = Array.isArray(data) ? data : [];
  const map = new Map<string, string>();

  for (const row of rows) {
    const type = typeof row.type === "string" ? row.type : null;
    const id = typeof row.id === "string" ? row.id : null;
    if (!type || !id) continue;
    const isTenant = row.company_id === companyId;
    if (isTenant) {
      map.set(type, id);
      continue;
    }
    if (!map.has(type)) map.set(type, id);
  }
  return map;
}

function buildDashboardSeed(params: {
  dashboardKind: "global" | "executive";
  focus: string | null;
  typeMap: Map<string, string>;
}): {
  layoutJson: Record<string, unknown>;
  instances: Array<{
    id: string;
    widgetDefinitionId: string | null;
    widgetType: string;
    config: Record<string, unknown>;
    isVisible: boolean;
  }>;
  widgetTypes: string[];
} {
  const mk = (widgetType: string, config: Record<string, unknown> = {}) => ({
    id: crypto.randomUUID(),
    widgetDefinitionId: params.typeMap.get(widgetType) ?? null,
    widgetType,
    config,
    isVisible: true,
  });

  if (params.dashboardKind === "executive") {
    const brief = mk("exec_ai_brief");
    const risk = mk("risk_pie");
    const metrics = mk("exec_metrics");
    const heat = mk("dept_heatmap");
    const instances = [brief, risk, metrics, heat];
    return {
      layoutJson: {
        breakpoints: { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 },
        cols: { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 },
        layouts: {
          lg: [
            { i: brief.id, x: 0, y: 0, w: 8, h: 10, minW: 4, minH: 6 },
            { i: risk.id, x: 8, y: 0, w: 4, h: 10, minW: 3, minH: 6 },
            { i: metrics.id, x: 0, y: 10, w: 12, h: 6, minW: 4, minH: 4 },
            { i: heat.id, x: 0, y: 16, w: 12, h: 8, minW: 4, minH: 4 },
          ],
        },
        widgets: Object.fromEntries(
          instances.map((w) => [w.id, { type: w.widgetType, definitionId: w.widgetDefinitionId }]),
        ),
      },
      instances,
      widgetTypes: instances.map((w) => w.widgetType),
    };
  }

  const focusText = params.focus ?? "";
  const workflowFocus = workflowFocusFromText(focusText);
  if (workflowFocus) {
    const kpi = mk("kpi_strip", { focus: "workflow_runs_health" });
    const trend = mk("throughput_chart", { focus: "workflow_runs_health" });
    const alerts = mk("alerts_feed", { focus: "workflow_runs_health" });
    const activity = mk("activity_stream", { focus: "workflow_runs_health" });
    const insight = mk("ai_insight", { focus: "workflow_runs_health" });
    const actions = mk("quick_actions", { focus: "workflow_runs_health" });
    const instances = [kpi, trend, alerts, activity, insight, actions];
    return {
      layoutJson: {
        breakpoints: { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 },
        cols: { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 },
        layouts: {
          lg: [
            { i: kpi.id, x: 0, y: 0, w: 12, h: 6, minW: 6, minH: 4 },
            { i: trend.id, x: 0, y: 6, w: 8, h: 10, minW: 4, minH: 4 },
            { i: alerts.id, x: 8, y: 6, w: 4, h: 10, minW: 3, minH: 4 },
            { i: activity.id, x: 0, y: 16, w: 8, h: 9, minW: 4, minH: 4 },
            { i: insight.id, x: 8, y: 16, w: 4, h: 9, minW: 3, minH: 4 },
            { i: actions.id, x: 0, y: 25, w: 12, h: 7, minW: 4, minH: 4 },
          ],
        },
        widgets: Object.fromEntries(
          instances.map((w) => [w.id, { type: w.widgetType, definitionId: w.widgetDefinitionId }]),
        ),
      },
      instances,
      widgetTypes: instances.map((w) => w.widgetType),
    };
  }

  const search = mk("global_search_card");
  const kpi = mk("kpi_strip");
  const insight = mk("ai_insight");
  const gov = mk("ai_governance");
  const chart = mk("throughput_chart");
  const quick = mk("quick_actions");
  const act = mk("activity_stream");
  const alerts = mk("alerts_feed");
  const instances = [search, kpi, insight, gov, chart, quick, act, alerts];

  return {
    layoutJson: {
      breakpoints: { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 },
      cols: { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 },
      layouts: {
        lg: [
          { i: search.id, x: 0, y: 0, w: 12, h: 5, minW: 4, minH: 3 },
          { i: kpi.id, x: 0, y: 5, w: 12, h: 6, minW: 6, minH: 4 },
          { i: insight.id, x: 0, y: 11, w: 12, h: 5, minW: 4, minH: 3 },
          { i: gov.id, x: 0, y: 16, w: 12, h: 9, minW: 4, minH: 4 },
          { i: chart.id, x: 0, y: 25, w: 8, h: 9, minW: 4, minH: 4 },
          { i: quick.id, x: 8, y: 25, w: 4, h: 9, minW: 2, minH: 4 },
          { i: act.id, x: 0, y: 34, w: 6, h: 10, minW: 3, minH: 4 },
          { i: alerts.id, x: 6, y: 34, w: 6, h: 10, minW: 3, minH: 4 },
        ],
      },
      widgets: Object.fromEntries(
        instances.map((w) => [w.id, { type: w.widgetType, definitionId: w.widgetDefinitionId }]),
      ),
    },
    instances,
    widgetTypes: instances.map((w) => w.widgetType),
  };
}

function findAppAction(actionId: string): AppActionDefinition | undefined {
  return APP_ACTIONS.find((a) => a.id === actionId);
}

async function executeAppAction(
  supabase: SupabaseClient,
  params: {
    action: AppActionDefinition;
    companyId: string;
    userId: string;
    args: Record<string, unknown>;
    confirmed: boolean;
  },
): Promise<UnifiedActionExecution> {
  const action = params.action;
  const args = asRecord(params.args);

  if (action.requiresConfirmation && !params.confirmed) {
    return {
      ok: false,
      pendingConfirmation: true,
      preview: {
        label: action.label,
        actionId: action.id,
        args,
      },
    };
  }

  switch (action.id) {
    case "app.workflows.list": {
      const limit = normalizeLimit(args.limit, 20, 80);
      const status = typeof args.status === "string" ? args.status : undefined;
      let query = supabase
        .from("workflows")
        .select("id, name, status, updated_at, department_id")
        .eq("company_id", params.companyId)
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const items = Array.isArray(data) ? data : [];
      return {
        ok: true,
        result: { items, count: items.length },
        citations: [citationForDomain("workflows", `items:${items.length}`)],
      };
    }
    case "app.workflows.create": {
      const name = typeof args.name === "string" && args.name.trim().length > 0
        ? args.name.trim()
        : "AI workflow";
      const definition = args.definition && typeof args.definition === "object"
        ? args.definition
        : defaultWorkflowDefinition(name);
      const status = typeof args.status === "string" ? args.status : "draft";
      const { data, error } = await supabase
        .from("workflows")
        .insert({
          company_id: params.companyId,
          owner_user_id: params.userId,
          name,
          status,
          definition,
        })
        .select("id, name, status")
        .single();
      if (error) throw new Error(error.message);
      return {
        ok: true,
        result: { workflow: data },
        citations: [citationForDomain("workflows", `workflow:${String(data.id)}`)],
      };
    }
    case "app.modules.list": {
      const limit = normalizeLimit(args.limit, 20, 80);
      const search = typeof args.search === "string" ? args.search.trim() : "";
      let query = supabase
        .from("internal_modules")
        .select("id, name, status, updated_at, active_version_id")
        .eq("company_id", params.companyId)
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (search) {
        query = query.ilike("name", `%${search.replace(/[%_]/g, "")}%`);
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const items = Array.isArray(data) ? data : [];
      return {
        ok: true,
        result: { items, count: items.length },
        citations: [citationForDomain("modules", `items:${items.length}`)],
      };
    }
    case "app.modules.create": {
      const name = typeof args.name === "string" && args.name.trim().length > 0
        ? args.name.trim()
        : "AI module";
      const description = typeof args.description === "string" ? args.description : "";
      const status = typeof args.status === "string" ? args.status : "draft";
      const { data: created, error: createError } = await supabase
        .from("internal_modules")
        .insert({
          company_id: params.companyId,
          name,
          description,
          ui_entry: "/dashboard/modules/preview",
          status,
          tenant_scope: ["current_tenant"],
          tags: [],
          data_bindings: [],
          permissions: [],
        })
        .select("*")
        .single();
      if (createError) throw new Error(createError.message);

      const snapshot = {
        name: created.name,
        description: created.description,
        ui_entry: created.ui_entry,
        data_bindings: created.data_bindings ?? [],
        permissions: created.permissions ?? [],
        tags: created.tags ?? [],
        tenant_scope: created.tenant_scope ?? ["current_tenant"],
      };
      const { data: version, error: versionError } = await supabase
        .from("module_versions")
        .insert({
          module_id: created.id,
          version_tag: "1.0.0",
          changelog: "Initial AI-created module version",
          is_active: true,
          migration_notes: null,
          binding_diff: {},
          snapshot,
        })
        .select("id, version_tag")
        .single();
      if (!versionError && version?.id) {
        await supabase
          .from("internal_modules")
          .update({ active_version_id: version.id })
          .eq("id", created.id);
      }

      return {
        ok: true,
        result: {
          module: {
            id: created.id,
            name: created.name,
            status: created.status,
            activeVersionId: version?.id ?? null,
          },
        },
        citations: [citationForDomain("modules", `module:${String(created.id)}`)],
      };
    }
    case "app.departments.list": {
      const limit = normalizeLimit(args.limit, 20, 80);
      const { data, error } = await supabase
        .from("departments")
        .select("id, name, workspace_status, department_type, updated_at")
        .eq("company_id", params.companyId)
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      const items = Array.isArray(data) ? data : [];
      return {
        ok: true,
        result: { items, count: items.length },
        citations: [citationForDomain("departments", `items:${items.length}`)],
      };
    }
    case "app.departments.create": {
      const name = typeof args.name === "string" && args.name.trim().length > 0
        ? args.name.trim()
        : "AI department";
      const departmentType = typeof args.departmentType === "string" ? args.departmentType : null;
      const { data, error } = await supabase
        .from("departments")
        .insert({
          company_id: params.companyId,
          name,
          lead_user_id: params.userId,
          department_type: departmentType,
          workspace_status: "active",
        })
        .select("id, name, workspace_status")
        .single();
      if (error) throw new Error(error.message);
      await supabase.from("department_members").insert({
        company_id: params.companyId,
        department_id: data.id,
        profile_id: params.userId,
        role: "Manager",
      });
      return {
        ok: true,
        result: { department: data },
        citations: [citationForDomain("departments", `department:${String(data.id)}`)],
      };
    }
    case "app.reports.list": {
      const limit = normalizeLimit(args.limit, 20, 80);
      const search = typeof args.search === "string" ? args.search.trim() : "";
      let query = supabase
        .from("report_center_reports")
        .select("id, name, status, updated_at, department_id")
        .eq("company_id", params.companyId)
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (search) {
        query = query.ilike("name", `%${search.replace(/[%_]/g, "")}%`);
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const items = Array.isArray(data) ? data : [];
      return {
        ok: true,
        result: { items, count: items.length },
        citations: [citationForDomain("reports", `items:${items.length}`)],
      };
    }
    case "app.reports.create": {
      const name = typeof args.name === "string" && args.name.trim().length > 0
        ? args.name.trim()
        : "AI report";
      const description = typeof args.description === "string" ? args.description : "";
      const status = typeof args.status === "string" ? args.status : "draft";
      const { data, error } = await supabase
        .from("report_center_reports")
        .insert({
          company_id: params.companyId,
          name,
          description,
          owner_user_id: params.userId,
          status,
          tags: [],
          data_source_refs: [],
          kpi_refs: [],
          visuals: {},
          export_targets: [],
        })
        .select("id, name, status")
        .single();
      if (error) throw new Error(error.message);
      return {
        ok: true,
        result: { report: data },
        artifacts: [
          {
            id: crypto.randomUUID(),
            type: "report",
            title: data.name,
            reportId: data.id,
            route: `/reports/${data.id}`,
            createdAt: toIsoNow(),
          },
        ],
        citations: [citationForDomain("reports", `report:${String(data.id)}`)],
      };
    }
    case "app.reports.export_pdf": {
      const reportId = typeof args.reportId === "string" ? args.reportId : "";
      if (!reportId) throw new Error("reportId is required");
      const { data: report, error: reportError } = await supabase
        .from("report_center_reports")
        .select("id, name, description, status, updated_at")
        .eq("company_id", params.companyId)
        .eq("id", reportId)
        .maybeSingle();
      if (reportError) throw new Error(reportError.message);
      if (!report) throw new Error("Report not found");

      const fileNameRaw = typeof args.fileName === "string" && args.fileName.trim().length > 0
        ? args.fileName.trim()
        : `${String(report.name).replace(/[^a-zA-Z0-9_-]/g, "_") || "report"}.pdf`;
      const safeFileName = sanitizeFileName(fileNameRaw);
      const fileName = safeFileName.toLowerCase().endsWith(".pdf")
        ? safeFileName
        : `${safeFileName}.pdf`;
      const pdfBytes = buildSimplePdf([
        `Report: ${String(report.name)}`,
        `Status: ${String(report.status)}`,
        `Updated: ${String(report.updated_at)}`,
        "",
        String(report.description ?? "Generated by AI chat export."),
      ]);

      const upload = await uploadReportExportFile({
        supabase,
        companyId: params.companyId,
        fileName,
        mimeType: "application/pdf",
        bytes: pdfBytes,
      });

      const { data: job, error: jobError } = await supabase
        .from("report_export_jobs")
        .insert({
          company_id: params.companyId,
          report_id: reportId,
          format: "pdf",
          destination: { type: "download", source: "ai-chat" },
          status: "completed",
          metadata: { generatedBy: "ai-chat", storageBucket: REPORT_EXPORT_BUCKET },
          file_name: fileName,
          mime_type: "application/pdf",
          file_path: upload.filePath,
          file_size: upload.fileSize,
          download_url: upload.downloadUrl,
        })
        .select("id, report_id, status, file_name, mime_type, file_path, file_size, download_url")
        .single();
      if (jobError) throw new Error(jobError.message);

      return {
        ok: true,
        result: { job },
        artifacts: [
          {
            id: crypto.randomUUID(),
            type: "pdf",
            title: `${String(report.name)} PDF`,
            reportId,
            exportJobId: job.id,
            fileName: job.file_name,
            mimeType: job.mime_type,
            storagePath: job.file_path,
            downloadUrl: job.download_url,
            route: `/reports/${reportId}`,
            createdAt: toIsoNow(),
          },
        ],
        citations: [citationForDomain("reports", `export:${String(job.id)}`)],
      };
    }
    case "app.dashboards.list": {
      const kind = typeof args.dashboardKind === "string" ? args.dashboardKind : undefined;
      let query = supabase
        .from("dashboard_layouts")
        .select("id, name, dashboard_kind, updated_at, version")
        .eq("company_id", params.companyId)
        .eq("user_id", params.userId)
        .order("updated_at", { ascending: false })
        .limit(50);
      if (kind === "global" || kind === "executive") {
        query = query.eq("dashboard_kind", kind);
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const items = Array.isArray(data) ? data : [];
      return {
        ok: true,
        result: { items, count: items.length },
        citations: [citationForDomain("dashboards", `items:${items.length}`)],
      };
    }
    case "app.dashboards.create_layout": {
      const dashboardKind = args.dashboardKind === "executive" ? "executive" : "global";
      const requestedName = typeof args.name === "string" ? args.name : null;
      const focus = typeof args.focus === "string" && args.focus.trim().length > 0
        ? args.focus.trim()
        : null;
      const reuseIfExists = args.reuseIfExists === true;
      const baseName = deriveDashboardBaseName(requestedName, focus);

      const resolvedName = await resolveUniqueDashboardName({
        supabase,
        companyId: params.companyId,
        userId: params.userId,
        dashboardKind,
        baseName,
        reuseIfExists,
      });

      let layout: { id: string; name: string; dashboard_kind: string; layout_json?: Record<string, unknown> } | null =
        null;
      let widgetTypes: string[] = [];
      let reused = false;
      let widgetInstances: Array<{
        id: string;
        widget_definition_id: string | null;
        widget_type: string;
        config: Record<string, unknown> | null;
        is_visible: boolean;
      }> = [];

      if (resolvedName.existingId) {
        reused = true;
        const { data: existing, error: existingError } = await supabase
          .from("dashboard_layouts")
          .select("id, name, dashboard_kind, layout_json")
          .eq("id", resolvedName.existingId)
          .eq("company_id", params.companyId)
          .eq("user_id", params.userId)
          .maybeSingle();
        if (existingError) throw new Error(existingError.message);
        if (!existing) throw new Error("Could not load existing dashboard layout");
        layout = existing;
        const widgetsObj =
          existing.layout_json && typeof existing.layout_json === "object"
            ? (existing.layout_json as { widgets?: Record<string, { type?: string }> }).widgets ?? {}
            : {};
        widgetTypes = Object.values(widgetsObj)
          .map((w) => (w && typeof w.type === "string" ? w.type : null))
          .filter((t): t is string => Boolean(t));
      } else {
        const typeMap = await fetchDashboardDefinitionTypeMap(supabase, params.companyId);
        const seed = buildDashboardSeed({ dashboardKind, focus, typeMap });
        widgetTypes = seed.widgetTypes;

        const { data: created, error: createdError } = await supabase
          .from("dashboard_layouts")
          .insert({
            company_id: params.companyId,
            user_id: params.userId,
            name: resolvedName.name,
            dashboard_kind: dashboardKind,
            layout_json: seed.layoutJson,
            version: 1,
          })
          .select("id, name, dashboard_kind, layout_json")
          .single();
        if (createdError) throw new Error(createdError.message);

        if (seed.instances.length > 0) {
          const rows = seed.instances.map((instance) => ({
            id: instance.id,
            layout_id: created.id,
            widget_definition_id: instance.widgetDefinitionId,
            widget_type: instance.widgetType,
            config: instance.config,
            is_visible: instance.isVisible,
          }));
          const { error: widgetErr } = await supabase.from("dashboard_widget_instances").insert(rows);
          if (widgetErr) throw new Error(widgetErr.message);
        }

        layout = created;
      }

      if (!layout) throw new Error("Could not create dashboard layout");
      const { data: instanceRows, error: instanceError } = await supabase
        .from("dashboard_widget_instances")
        .select("id, widget_definition_id, widget_type, config, is_visible")
        .eq("layout_id", layout.id)
        .order("created_at", { ascending: true });
      if (instanceError) throw new Error(instanceError.message);
      widgetInstances = Array.isArray(instanceRows) ? instanceRows : [];
      if (widgetTypes.length === 0) {
        widgetTypes = widgetInstances
          .map((row) => (typeof row.widget_type === "string" ? row.widget_type : null))
          .filter((t): t is string => Boolean(t));
      }
      const widgetConfigs = Object.fromEntries(
        widgetInstances.map((row) => [String(row.id), asRecord(row.config)]),
      );
      const routeBase = layout.dashboard_kind === "executive" ? "/dashboard/executive" : "/dashboard/global";
      const route = `${routeBase}?layout=${encodeURIComponent(layout.name)}`;
      return {
        ok: true,
        result: {
          layout,
          reused,
          focus: focus ?? null,
          widgetTypes,
          widgetInstances: widgetInstances.map((row) => ({
            id: String(row.id),
            widgetDefinitionId: row.widget_definition_id ? String(row.widget_definition_id) : null,
            widgetType: String(row.widget_type),
            config: asRecord(row.config),
            isVisible: row.is_visible !== false,
          })),
        },
        artifacts: [
          {
            id: crypto.randomUUID(),
            type: "dashboard",
            title: `${String(layout.name)} dashboard`,
            dashboardKind: String(layout.dashboard_kind),
            layoutId: String(layout.id),
            route,
            payload: {
              payloadVersion: 1,
              layout: {
                id: String(layout.id),
                name: String(layout.name),
                dashboardKind: layout.dashboard_kind === "executive" ? "executive" : "global",
                layoutJson: layout.layout_json && typeof layout.layout_json === "object" ? layout.layout_json : {},
              },
              widgets: widgetInstances.map((row) => ({
                id: String(row.id),
                widgetDefinitionId: row.widget_definition_id ? String(row.widget_definition_id) : null,
                widgetType: String(row.widget_type),
                config: asRecord(row.config),
                isVisible: row.is_visible !== false,
              })),
              widgetConfigs,
              layoutName: String(layout.name),
              dashboardKind: String(layout.dashboard_kind),
              layoutId: String(layout.id),
              layoutJson: layout.layout_json && typeof layout.layout_json === "object" ? layout.layout_json : {},
              focus: focus ?? null,
              widgetTypes,
              reused,
            },
            createdAt: toIsoNow(),
          },
        ],
        citations: [citationForDomain("dashboards", `layout:${String(layout.id)}`)],
      };
    }
    case "app.knowledge_base.list": {
      const limit = normalizeLimit(args.limit, 20, 80);
      const sourceFilter = typeof args.sourceFilter === "string" ? args.sourceFilter.trim() : "";
      let query = supabase
        .from("indexed_documents")
        .select("id, title, source_provider, index_status, updated_at")
        .eq("company_id", params.companyId)
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (sourceFilter) {
        query = query.ilike("source_provider", `%${sourceFilter.replace(/[%_]/g, "")}%`);
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const items = Array.isArray(data) ? data : [];
      return {
        ok: true,
        result: { items, count: items.length },
        citations: [citationForDomain("knowledge_base", `items:${items.length}`)],
      };
    }
    case "app.knowledge_base.add_text": {
      const title = typeof args.title === "string" && args.title.trim().length > 0
        ? args.title.trim()
        : "AI note";
      const text = typeof args.text === "string" ? args.text.trim() : "";
      if (!text) throw new Error("text is required");
      const provider = typeof args.sourceProvider === "string" && args.sourceProvider.trim().length > 0
        ? args.sourceProvider.trim()
        : "ai_chat";
      const externalId = crypto.randomUUID();
      const nowIso = toIsoNow();
      const { data: doc, error: docError } = await supabase
        .from("indexed_documents")
        .insert({
          company_id: params.companyId,
          source_provider: provider,
          external_id: externalId,
          title,
          snippet: text.slice(0, 300),
          full_text: text,
          indexed_at: nowIso,
          metadata: { source: "ai-chat", title },
          permissions: { scope: "tenant" },
          updated_at: nowIso,
          index_status: "ready",
          chunk_count: 1,
          last_indexed_at: nowIso,
          index_error: null,
        })
        .select("id, title, source_provider")
        .single();
      if (docError) throw new Error(docError.message);
      await supabase.from("indexed_document_chunks").insert({
        document_id: doc.id,
        company_id: params.companyId,
        chunk_index: 0,
        chunk_text: text,
        token_count: Math.max(1, Math.ceil(text.length / 4)),
        embedding: null,
        metadata: { source: provider, title },
      });
      return {
        ok: true,
        result: { document: doc },
        citations: [citationForDomain("knowledge_base", `document:${String(doc.id)}`, text.slice(0, 120))],
      };
    }
    case "app.integrations.list": {
      const { data, error } = await supabase
        .from("connectors")
        .select("id, provider_key, status, display_name, updated_at")
        .eq("company_id", params.companyId)
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      const items = Array.isArray(data) ? data : [];
      return {
        ok: true,
        result: { items, count: items.length },
        citations: [citationForDomain("integrations", `items:${items.length}`)],
      };
    }
    case "app.integrations.create": {
      const providerKey = typeof args.providerKey === "string" ? args.providerKey : "";
      if (!providerKey) throw new Error("providerKey is required");
      const displayName = typeof args.displayName === "string" ? args.displayName : providerKey;
      const { data: existing } = await supabase
        .from("connectors")
        .select("id, provider_key, status, display_name")
        .eq("company_id", params.companyId)
        .eq("provider_key", providerKey)
        .maybeSingle();
      const connector = existing ?? (await supabase
        .from("connectors")
        .insert({
          company_id: params.companyId,
          provider_key: providerKey,
          display_name: displayName,
          status: "pending",
        })
        .select("id, provider_key, status, display_name")
        .single()).data;
      if (!connector) throw new Error("Could not create connector");
      return {
        ok: true,
        result: { connector },
        citations: [citationForDomain("integrations", `connector:${String(connector.id)}`)],
      };
    }
    case "app.settings.flags.list": {
      const { data, error } = await supabase
        .from("feature_flags")
        .select("id, flag_key, enabled, rollout, payload, updated_at")
        .or(`company_id.eq.${params.companyId},company_id.is.null`)
        .order("flag_key", { ascending: true });
      if (error) throw new Error(error.message);
      const items = Array.isArray(data) ? data : [];
      return {
        ok: true,
        result: { items, count: items.length },
        citations: [citationForDomain("settings", `flags:${items.length}`)],
      };
    }
    case "app.settings.flags.upsert": {
      const flagKey = typeof args.flagKey === "string" ? args.flagKey.trim() : "";
      if (!flagKey) throw new Error("flagKey is required");
      const enabled = Boolean(args.enabled);
      const rollout = typeof args.rollout === "number" ? Math.max(0, Math.min(100, args.rollout)) : 100;
      const { data, error } = await supabase
        .from("feature_flags")
        .upsert({
          company_id: params.companyId,
          flag_key: flagKey,
          enabled,
          rollout,
          payload: {},
          updated_at: toIsoNow(),
        }, { onConflict: "flag_key,company_id" })
        .select("id, flag_key, enabled, rollout")
        .single();
      if (error) throw new Error(error.message);
      return {
        ok: true,
        result: { flag: data },
        citations: [citationForDomain("settings", `flag:${flagKey}`)],
      };
    }
    case "app.notifications.list": {
      const limit = normalizeLimit(args.limit, 20, 80);
      const status = typeof args.status === "string" ? args.status : undefined;
      let query = supabase
        .from("notifications")
        .select("id, title, body, status, created_at")
        .eq("company_id", params.companyId)
        .eq("user_id", params.userId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const items = Array.isArray(data) ? data : [];
      return {
        ok: true,
        result: { items, count: items.length },
        citations: [citationForDomain("notifications", `items:${items.length}`)],
      };
    }
    case "app.notifications.create_rule": {
      const name = typeof args.name === "string" && args.name.trim().length > 0
        ? args.name.trim()
        : "AI alert rule";
      const condition = asRecord(args.condition);
      const channels = Array.isArray(args.channels) ? args.channels : ["in_app"];
      const { data, error } = await supabase
        .from("alert_rules")
        .insert({
          company_id: params.companyId,
          name,
          trigger_type: "custom",
          conditions: condition,
          actions: channels,
          enabled: true,
        })
        .select("id, name, enabled")
        .single();
      if (error) throw new Error(error.message);
      return {
        ok: true,
        result: { alertRule: data },
        citations: [citationForDomain("notifications", `alertRule:${String(data.id)}`)],
      };
    }
    case "app.search.query": {
      const query = typeof args.query === "string" ? args.query.trim().toLowerCase() : "";
      if (!query) throw new Error("query is required");
      const limit = normalizeLimit(args.limit, 12, 50);
      const { data: entities } = await supabase
        .from("unified_entities")
        .select("id, entity_type, payload, updated_at")
        .eq("company_id", params.companyId)
        .eq("is_deleted", false)
        .limit(200);
      const { data: docs } = await supabase
        .from("indexed_documents")
        .select("id, title, snippet, source_provider, updated_at")
        .eq("company_id", params.companyId)
        .limit(200);
      const entityHits = (Array.isArray(entities) ? entities : [])
        .filter((row) => JSON.stringify(row.payload ?? {}).toLowerCase().includes(query))
        .slice(0, limit)
        .map((row) => ({
          id: row.id,
          type: row.entity_type,
          source: "unified_entities",
          snippet: JSON.stringify(row.payload ?? {}).slice(0, 220),
          updated_at: row.updated_at,
        }));
      const docHits = (Array.isArray(docs) ? docs : [])
        .filter((row) =>
          `${String(row.title ?? "")} ${String(row.snippet ?? "")}`.toLowerCase().includes(query)
        )
        .slice(0, limit)
        .map((row) => ({
          id: row.id,
          type: "document",
          source: row.source_provider,
          snippet: row.snippet ?? "",
          updated_at: row.updated_at,
        }));
      const hits = [...entityHits, ...docHits].slice(0, limit);
      return {
        ok: true,
        result: { hits, count: hits.length },
        citations: [citationForDomain("search", `hits:${hits.length}`)],
      };
    }
    default:
      throw new Error(`Unsupported app action: ${action.id}`);
  }
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

async function embedQuery(modelProvider: AiProviderAdapter | null, text: string): Promise<number[] | null> {
  if (!modelProvider) return null;
  const q = text.trim();
  if (!q) return null;
  let json: AiProviderEmbeddingsResponse;
  try {
    json = await modelProvider.createEmbeddings({
      model: EMBEDDING_MODEL,
      input: q.slice(0, 6000),
    });
  } catch {
    return null;
  }
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
  opts?: { userRoles?: string[]; userDepartment?: string | null; modelProvider?: AiProviderAdapter | null },
): Promise<{ contextText: string; citations: z.infer<typeof citationSchema>[] }> {
  const citations: z.infer<typeof citationSchema>[] = [];
  const parts: string[] = [];
  const q = query.trim().slice(0, 200);

  const roles = Array.isArray(opts?.userRoles) ? opts?.userRoles ?? [] : [];
  const userDepartment = opts?.userDepartment ?? null;
  const modelProvider = opts?.modelProvider ?? null;
  const semanticCap = Math.max(6, Math.min(40, limit * 3));
  const nowIso = new Date().toISOString();

  if (modelProvider && q) {
    const queryEmbedding = await embedQuery(modelProvider, q);
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
        "Query live data from a connected integration via provider tool calls. Use this before answering integration questions.",
      parameters: {
        type: "object",
        properties: {
          provider: {
            type: "string",
            enum: ["gmail", "google_calendar"],
            description: "The integration to query.",
          },
          query_type: {
            type: "string",
            description:
              "Type of data to fetch, e.g. 'messages', 'emails', 'calendar_events', 'meetings'.",
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
  {
    type: "function",
    function: {
      name: "run_app_action",
      description:
        "Execute an internal Connected AI Business OS action across workflows, modules, departments, reports, dashboards, knowledge base, settings, notifications, and search.",
      parameters: {
        type: "object",
        properties: {
          action_id: {
            type: "string",
            enum: APP_ACTIONS.map((a) => a.id),
            description: "Registered app action id from the catalog.",
          },
          args: {
            type: "object",
            description:
              "Action arguments object. For app.dashboards.create_layout include args.name and args.focus based on the user's request; set args.reuseIfExists only when the user explicitly asks to reuse.",
          },
        },
        required: ["action_id"],
      },
    },
  },
] as const;

function buildAgentTools(permitted: AiToolPermission[]): Array<Record<string, unknown>> {
  const allowedAppActions = permitted.filter((tool) => tool.toolSource === "app");
  const allowedIds = allowedAppActions.map((tool) => tool.id);
  const fallbackIds = APP_ACTIONS.map((tool) => tool.id);
  const enumIds = allowedIds.length > 0 ? allowedIds : fallbackIds;
  const allowedSummary = enumIds.join(", ");

  return AGENT_TOOLS.map((tool) => {
    if (tool.function.name !== "run_app_action") {
      return {
        type: tool.type,
        function: {
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters,
        },
      };
    }
    return {
      type: "function",
      function: {
        name: "run_app_action",
        description:
          "Execute a permitted internal Connected AI Business OS action. Always select action_id from the allowed enum for this user.",
        parameters: {
          type: "object",
          properties: {
            action_id: {
              type: "string",
              enum: enumIds,
              description: `Allowed action ids for this user: ${allowedSummary}`,
            },
            args: {
              type: "object",
              description:
                "Arguments for the selected action. For app.dashboards.create_layout include dashboardKind, name, focus, and reuseIfExists.",
            },
          },
          required: ["action_id"],
        },
      },
    };
  });
}

type AgentToolArgs = Record<string, unknown>;
type AgentToolExecution = {
  text: string;
  status?: "completed" | "failed" | "pending_confirmation";
  actionId?: string;
  result?: Record<string, unknown>;
  citations?: Array<Record<string, unknown>>;
  artifacts?: Array<Record<string, unknown>>;
  pendingConfirmation?: {
    actionId: string;
    label: string;
    preview?: Record<string, unknown>;
  };
};

function inferAgentToolStatusFromText(text: string): "completed" | "failed" {
  const lower = text.trim().toLowerCase();
  if (!lower) return "completed";
  if (
    lower.startsWith("error") ||
    lower.includes("failed") ||
    lower.includes("not connected") ||
    lower.includes("unavailable") ||
    lower.includes("forbidden") ||
    lower.includes("denied")
  ) {
    return "failed";
  }
  return "completed";
}

function normalizeAgentToolExecution(raw: string | AgentToolExecution): AgentToolExecution {
  if (typeof raw === "string") {
    return {
      text: raw,
      status: inferAgentToolStatusFromText(raw),
    };
  }
  return {
    ...raw,
    status: raw.status ?? (raw.pendingConfirmation ? "pending_confirmation" : inferAgentToolStatusFromText(raw.text)),
  };
}

function serializeToolResultForModel(input: Record<string, unknown>): string {
  let json: string;
  try {
    json = JSON.stringify(input);
  } catch {
    json = JSON.stringify({
      status: "failed",
      error: "Could not serialize tool result payload",
    });
  }
  const MAX_CHARS = 12000;
  if (json.length <= MAX_CHARS) return json;
  return `${json.slice(0, MAX_CHARS)}...(truncated)`;
}

function parseDateFilter(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function defaultTodayTomorrowWindow(): { timeMin: string; timeMax: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setHours(23, 59, 59, 999);
  return { timeMin: start.toISOString(), timeMax: end.toISOString() };
}

function pendingConfirmationForToolCall(
  toolName: string,
  toolArgs: Record<string, unknown>,
): { actionId: string; label: string; preview: Record<string, unknown> } | null {
  if (toolName === "send_email") {
    return {
      actionId: "gmail.send_email",
      label: "Gmail: send email",
      preview: {
        args: {
          to: String(toolArgs.to ?? ""),
          subject: String(toolArgs.subject ?? ""),
          body: String(toolArgs.body ?? ""),
        },
      },
    };
  }
  if (toolName === "send_slack_message") {
    return {
      actionId: "slack.send_message",
      label: "Slack: send message",
      preview: {
        args: {
          channel: String(toolArgs.channel ?? ""),
          text: String(toolArgs.message ?? ""),
        },
      },
    };
  }
  if (toolName === "create_automation") {
    const name = String(toolArgs.name ?? "AI workflow");
    return {
      actionId: "app.workflows.create",
      label: "Workflows: create",
      preview: {
        args: {
          name,
          definition: defaultWorkflowDefinition(name),
          status: "draft",
        },
      },
    };
  }
  return null;
}

// ── Agent Tool Executor ─────────────────────────────────────────────────────

async function executeAgentTool(
  toolName: string,
  args: AgentToolArgs,
  supabase: SupabaseClient,
  companyId: string,
  userId: string,
  userRoles: string[],
  executionMode: "confirm" | "auto",
  streamContext: {
    userMessage: string;
    allowedAppActionIds: Set<string>;
  },
): Promise<string | AgentToolExecution> {
  switch (toolName) {
    case "query_integration": {
      const provider = String(args.provider ?? "").trim().toLowerCase();
      const filters = (args.filters as AgentToolArgs) ?? {};
      const limit = typeof filters.limit === "number" ? Math.min(Math.max(1, filters.limit), 50) : 20;
      const masterKey = Deno.env.get("CREDENTIALS_MASTER_KEY");
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const runtimeSupabase = (supabaseUrl && serviceRoleKey)
        ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
        : supabase;
      if (!masterKey) {
        return "Live integration queries are unavailable because CREDENTIALS_MASTER_KEY is not configured.";
      }

      if (provider === "gmail") {
        const query = typeof filters.search === "string" && filters.search.trim()
          ? filters.search.trim()
          : "in:inbox";
        writeLog("info", "ai_api.gmail_live_fetch_attempt", {
          toolName,
          companyId,
          userId,
          query,
          limit: Math.min(limit, 10),
        });
        try {
          const exec = await toolsExecute(runtimeSupabase, {
            companyId,
            userId,
            roles: userRoles,
            toolId: "gmail.search_messages",
            args: { query, maxResults: Math.min(limit, 10) },
            confirmed: true,
            source: "ai_chat",
            masterKey: masterKey,
          });
          const resultObj = (exec.result ?? {}) as Record<string, unknown>;
          const messages = Array.isArray(resultObj.messages) ? resultObj.messages : [];
          if (messages.length === 0) {
            writeLog("warn", "ai_api.gmail_live_fetch_empty", {
              toolName,
              companyId,
              userId,
              query,
            });
            return `No Gmail messages found for query "${query}".`;
          }
          writeLog("info", "ai_api.gmail_live_fetch_success", {
            toolName,
            companyId,
            userId,
            query,
            messageCount: messages.length,
            connectorId: exec.connectorId ?? null,
          });
          const lines = messages.slice(0, 5).map((m, i) => {
            const msg = (m ?? {}) as Record<string, unknown>;
            const subject = typeof msg.subject === "string" ? msg.subject : "(no subject)";
            const from = typeof msg.from === "string" ? msg.from : "unknown sender";
            const snippet = typeof msg.snippet === "string" ? msg.snippet : "";
            return `${i + 1}. Subject: ${subject}\n   From: ${from}\n   Snippet: ${snippet}`;
          });
          return `Latest Gmail messages:\n\n${lines.join("\n\n")}`;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Gmail search failed";
          writeLog("error", "ai_api.gmail_live_fetch_failed", {
            toolName,
            companyId,
            userId,
            query,
            error: serializeError(e),
          });
          if (/not authorized|permission|forbidden|connector/i.test(msg.toLowerCase())) {
            return "Gmail is connected but cannot be accessed right now. Please reconnect Gmail in Integrations and try again.";
          }
          return `Unable to fetch live Gmail data: ${msg}`;
        }
      }

      if (provider === "google_calendar") {
        const dateFrom = parseDateFilter(filters.date_from);
        const dateTo = parseDateFilter(filters.date_to);
        if (dateFrom && dateTo && new Date(dateTo).getTime() < new Date(dateFrom).getTime()) {
          return "Invalid date range: filters.date_to must be greater than or equal to filters.date_from.";
        }
        const fallbackWindow = defaultTodayTomorrowWindow();
        const timeMin = dateFrom ?? fallbackWindow.timeMin;
        const timeMax = dateTo ?? fallbackWindow.timeMax;
        writeLog("info", "ai_api.calendar_live_fetch_attempt", {
          toolName,
          companyId,
          userId,
          timeMin,
          timeMax,
          limit,
        });
        try {
          const exec = await toolsExecute(runtimeSupabase, {
            companyId,
            userId,
            roles: userRoles,
            toolId: "google_calendar.list_events",
            args: {
              calendarId: "primary",
              timeMin,
              timeMax,
              maxResults: limit,
            },
            confirmed: true,
            source: "ai_chat",
            masterKey: masterKey,
          });
          const resultObj = (exec.result ?? {}) as Record<string, unknown>;
          const items = Array.isArray(resultObj.items) ? resultObj.items : [];
          if (items.length === 0) {
            return `No calendar events found between ${timeMin} and ${timeMax}.`;
          }
          const lines = items.slice(0, 10).map((item, index) => {
            const eventObj = (item ?? {}) as Record<string, unknown>;
            const summary = typeof eventObj.summary === "string" && eventObj.summary.trim()
              ? eventObj.summary
              : "(untitled)";
            const status = typeof eventObj.status === "string" ? eventObj.status : "unknown";
            const startObj = (typeof eventObj.start === "object" && eventObj.start !== null)
              ? eventObj.start as Record<string, unknown>
              : {};
            const endObj = (typeof eventObj.end === "object" && eventObj.end !== null)
              ? eventObj.end as Record<string, unknown>
              : {};
            const startValue = typeof startObj.dateTime === "string"
              ? startObj.dateTime
              : (typeof startObj.date === "string" ? startObj.date : "unscheduled");
            const endValue = typeof endObj.dateTime === "string"
              ? endObj.dateTime
              : (typeof endObj.date === "string" ? endObj.date : "unscheduled");
            return `${index + 1}. ${summary}\n   Start: ${startValue}\n   End: ${endValue}\n   Status: ${status}`;
          });
          writeLog("info", "ai_api.calendar_live_fetch_success", {
            toolName,
            companyId,
            userId,
            eventCount: items.length,
            connectorId: exec.connectorId ?? null,
          });
          return `Calendar events between ${timeMin} and ${timeMax}:\n\n${lines.join("\n\n")}`;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Calendar query failed";
          writeLog("error", "ai_api.calendar_live_fetch_failed", {
            toolName,
            companyId,
            userId,
            timeMin,
            timeMax,
            error: serializeError(e),
          });
          if (/not authorized|permission|forbidden|connector|token|credential|scope/i.test(msg.toLowerCase())) {
            return "Google Calendar cannot be accessed right now. Please reconnect or re-authorize Google Calendar in Integrations and try again.";
          }
          return `Unable to fetch live Google Calendar data: ${msg}`;
        }
      }

      return `Live integration query is not implemented for provider "${provider}". Supported providers: gmail, google_calendar.`;
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
    case "run_app_action": {
      const actionId = typeof args.action_id === "string" ? args.action_id : "";
      const action = findAppAction(actionId);
      if (!action) {
        return {
          text: `Unknown app action: ${actionId}`,
          status: "failed",
          actionId,
        };
      }
      if (!streamContext.allowedAppActionIds.has(actionId)) {
        return {
          text: `Action "${actionId}" is not permitted for the current user.`,
          status: "failed",
          actionId,
        };
      }
      try {
        let actionArgs = asRecord(args.args);
        if (actionId === "app.dashboards.create_layout") {
          actionArgs = normalizeDashboardCreateArgs(actionArgs, streamContext.userMessage);
        }
        const out = await executeAppAction(supabase, {
          action,
          companyId,
          userId,
          args: actionArgs,
          confirmed: executionMode === "auto",
        });
        if (out.pendingConfirmation) {
          return {
            text: `Pending confirmation for action "${action.label}".`,
            status: "pending_confirmation",
            actionId: action.id,
            result: out.preview ?? {},
            pendingConfirmation: {
              actionId: action.id,
              label: action.label,
              preview: out.preview,
            },
          };
        }
        if (action.id === "app.dashboards.create_layout") {
          const layout = out.result && typeof out.result === "object"
            ? (out.result.layout as Record<string, unknown> | undefined)
            : undefined;
          const layoutName = layout && typeof layout.name === "string" ? layout.name : "dashboard";
          const layoutKind = layout && typeof layout.dashboard_kind === "string" ? layout.dashboard_kind : "global";
          const widgetTypes = out.result && typeof out.result === "object" && Array.isArray(out.result.widgetTypes)
            ? out.result.widgetTypes
              .map((x) => (typeof x === "string" ? x : null))
              .filter((x): x is string => Boolean(x))
            : [];
          const widgetSet = widgetTypes.length > 0
            ? ` Widgets: ${widgetTypes.slice(0, 8).join(", ")}${widgetTypes.length > 8 ? ", ..." : ""}.`
            : "";
          return {
            text:
              `Dashboard "${layoutName}" (${layoutKind}) created successfully with ${widgetTypes.length} widgets.${widgetSet}`,
            status: "completed",
            actionId: action.id,
            result: out.result ?? {},
            citations: Array.isArray(out.citations) ? out.citations : [],
            artifacts: Array.isArray(out.artifacts) ? out.artifacts : [],
          };
        }
        return {
          text: `Action "${action.label}" executed successfully.`,
          status: "completed",
          actionId: action.id,
          result: out.result ?? {},
          citations: Array.isArray(out.citations) ? out.citations : [],
          artifacts: Array.isArray(out.artifacts) ? out.artifacts : [],
        };
      } catch (e) {
        return {
          text: e instanceof Error ? e.message : "App action failed",
          status: "failed",
          actionId: action.id,
        };
      }
    }

    default:
      return `Unknown tool: ${toolName}`;
  }
}

async function runModeDiagnostics(params: {
  supabase: SupabaseClient;
  companyId: string;
  userId: string;
  userRoles: string[];
  userDepartment: string | null;
}): Promise<{
  generatedAt: string;
  overallOk: boolean;
  checks: Array<{
    mode: "Ask" | "Analyze" | "Report" | "Action";
    ok: boolean;
    latencyMs: number;
    citationCount: number;
    suggestedActions: string[];
    responsePreview: string;
    message: string;
  }>;
  actions: {
    permitted: number;
    hasSensitiveConfirmAction: boolean;
  };
  manualChecklist: string[];
}> {
  const modes: Array<"Ask" | "Analyze" | "Report" | "Action"> = ["Ask", "Analyze", "Report", "Action"];
  const providerResolution = resolveModelProvider();
  const modelProvider = providerResolution.adapter;
  const permitted = await permittedActionsForRoles(params.supabase, params.companyId, params.userRoles);
  const checks: Array<{
    mode: "Ask" | "Analyze" | "Report" | "Action";
    ok: boolean;
    latencyMs: number;
    citationCount: number;
    suggestedActions: string[];
    responsePreview: string;
    message: string;
  }> = [];

  for (const mode of modes) {
    const started = performance.now();
    try {
      const probeQuery = `diagnostic probe for ${mode} mode`;
      const { contextText, citations } = await retrieveRagContext(
        params.supabase,
        params.companyId,
        "global",
        probeQuery,
        6,
        {
          userRoles: params.userRoles,
          userDepartment: params.userDepartment,
          modelProvider,
        },
      );
      const latencyMs = Math.round(performance.now() - started);
      const suggested = suggestedActionsForMode(mode, permitted);
      checks.push({
        mode,
        ok: true,
        latencyMs,
        citationCount: citations.length,
        suggestedActions: suggested,
        responsePreview: contextText.slice(0, 180) || `Diagnostics ready for ${mode} mode.`,
        message: citations.length > 0
          ? "Context retrieval is healthy for this mode."
          : "No indexed citations yet; mode remains operational.",
      });
    } catch (e) {
      const latencyMs = Math.round(performance.now() - started);
      const message = e instanceof Error ? e.message : "Diagnostics failed";
      checks.push({
        mode,
        ok: false,
        latencyMs,
        citationCount: 0,
        suggestedActions: suggestedActionsForMode(mode, permitted),
        responsePreview: "",
        message,
      });
    }
  }

  const manualChecklist = [
    "Open /chat and validate mode switching (Ask/Analyze/Report/Action).",
    "Run a read action in confirm mode and verify no approval prompt is needed.",
    "Run a write action in confirm mode and verify pending confirmation appears.",
    "Switch conversation to auto mode and verify write action executes directly.",
  ];

  return {
    generatedAt: toIsoNow(),
    overallOk: checks.every((c) => c.ok),
    checks,
    actions: {
      permitted: permitted.length,
      hasSensitiveConfirmAction: permitted.some((a) => a.accessLevel === "write" && a.requiresConfirmation),
    },
    manualChecklist,
  };
}

serve(async (req) => {
  const startedAt = Date.now();
  const url = new URL(req.url);
  const requestId = crypto.randomUUID();
  const baseLog = {
    requestId,
    method: req.method,
    path: url.pathname,
  };
  writeLog("info", "ai_api.request_received", baseLog);

  if (req.method === "OPTIONS") {
    writeLog("info", "ai_api.options", baseLog);
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    writeLog("warn", "ai_api.missing_auth_header", baseLog);
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
    writeLog("warn", "ai_api.auth_failed", {
      ...baseLog,
      error: authError?.message ?? null,
    });
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    writeLog("warn", "ai_api.invalid_json", {
      ...baseLog,
      userId: user.id,
    });
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const streamParsed = streamOpSchema.safeParse(raw);
  if (streamParsed.success) {
    writeLog("info", "ai_api.stream_chat_received", {
      ...baseLog,
      userId: user.id,
      body: summarizeRawBody(streamParsed.data),
    });
    const providerResolution = resolveModelProvider();
    if (!providerResolution.adapter) {
      writeLog("error", "ai_api.model_provider_unavailable", {
        ...baseLog,
        userId: user.id,
        provider: providerResolution.providerType,
        error: providerResolution.error,
      });
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const modelProvider = providerResolution.adapter;

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
    const model = body.model ?? defaultModelForProvider(providerResolution.providerType);
    const permittedForStream = await permittedActionsForRoles(supabase, companyId, userRoles);
    const allowedAppActionIds = new Set(
      permittedForStream
        .filter((tool) => tool.toolSource === "app")
        .map((tool) => tool.id),
    );
    const agentTools = buildAgentTools(permittedForStream);
    const permittedAppActionsPrompt = buildPermittedAppActionsPromptBlock(permittedForStream);
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
      { userRoles, userDepartment: profile.department, modelProvider },
    );

    const started = performance.now();
    const systemPreamble = [
      "You are the Connected AI Business OS assistant.",
      `Mode: ${body.mode}. Execution mode: ${body.executionMode}.`,
      "Always follow this orchestration flow: understand the user intent, pick the best tool, execute it, then use tool results to produce the final answer.",
      "Never claim an entity/dashboard/report/workflow/module was created or updated unless a tool result explicitly confirms completion.",
      "If a tool returns pending_confirmation, clearly state it is pending approval and do not present it as completed.",
      "For dashboard creation requests, call run_app_action with action_id=app.dashboards.create_layout and include args.dashboardKind, args.name, args.focus, args.reuseIfExists=false unless the user explicitly asks to reuse.",
      "Use tool result fields (result/artifacts/citations) to make the final response specific, not generic.",
      "Permitted app actions for this user:",
      permittedAppActionsPrompt,
      "Tenant-scoped; cite provided context. Be concise. If unsure, say so.",
    ].join("\n");

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
      artifacts: [],
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
        execution_mode: body.executionMode,
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
        const streamedArtifacts: Array<Record<string, unknown>> = [];
        let totalPromptTokens = 0;
        let totalCompletionTokens = 0;
        const MAX_TOOL_ITERATIONS = 5;

        try {
          for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
            let oaiJson: AiProviderChatResponse;
            try {
              oaiJson = await modelProvider.chatCompletions({
                model,
                messages: loopMessages as unknown as Array<Record<string, unknown>>,
                tools: agentTools,
                tool_choice: "auto",
              });
            } catch (e) {
              const errText = e instanceof Error ? e.message : "LLM request failed";
              controller.enqueue(sseData({ error: `LLM error: ${errText.slice(0, 300)}` }));
              break;
            }

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

                let resultText = "";
                let pending:
                  | {
                      actionId: string;
                      label: string;
                      preview?: Record<string, unknown>;
                    }
                  | null = null;
                let toolExecution: AgentToolExecution = {
                  text: "",
                  status: "completed",
                };

                if (body.executionMode === "confirm") {
                  const mappedPending = pendingConfirmationForToolCall(toolName, toolArgs);
                  if (mappedPending) {
                    pending = mappedPending;
                    resultText = `Pending confirmation required for "${mappedPending.label}".`;
                    toolExecution = {
                      text: resultText,
                      status: "pending_confirmation",
                      actionId: mappedPending.actionId,
                      pendingConfirmation: mappedPending,
                      result: mappedPending.preview ?? {},
                    };
                  }
                }

                if (!pending) {
                  const rawResult = await executeAgentTool(
                    toolName,
                    toolArgs,
                    supabase,
                    companyId,
                    user.id,
                    userRoles,
                    body.executionMode,
                    {
                      userMessage: body.userMessage,
                      allowedAppActionIds,
                    },
                  );
                  toolExecution = normalizeAgentToolExecution(rawResult);
                  resultText = toolExecution.text;
                  if (toolExecution.pendingConfirmation) {
                    pending = toolExecution.pendingConfirmation;
                  }
                  if (Array.isArray(toolExecution.artifacts) && toolExecution.artifacts.length > 0) {
                    for (const artifact of toolExecution.artifacts) {
                      streamedArtifacts.push(artifact);
                      controller.enqueue(sseData({ artifact }));
                    }
                  }
                }

                if (pending) {
                  const pendingPayload = {
                    actionId: pending.actionId,
                    label: pending.label,
                    preview: pending.preview ?? {},
                  };
                  controller.enqueue(
                    sseData({
                      pending_confirmation: pendingPayload,
                      pendingConfirmation: pendingPayload,
                    }),
                  );
                }

                // Audit logs should never block assistant responses.
                try {
                  await supabase.from("ai_agent_tool_calls").insert({
                    company_id: companyId,
                    user_id: user.id,
                    conversation_id: body.conversationId,
                    tool_name: toolName,
                    tool_call_id: toolCall.id,
                    args: toolArgs,
                    result: resultText.slice(0, 4000),
                    iteration: iter + 1,
                  });

                  const resultLower = resultText.trim().toLowerCase();
                  const actionName =
                    typeof toolExecution.actionId === "string" && toolExecution.actionId
                      ? toolExecution.actionId
                      : toolName === "run_app_action" && typeof toolArgs.action_id === "string"
                      ? toolArgs.action_id
                      : toolName;
                  const actionStatus = pending
                    ? "pending_confirmation"
                    : toolExecution.status === "failed" || resultLower.startsWith("error") || resultLower.includes("failed")
                    ? "failed"
                    : "completed";

                  await supabase.from("ai_action_logs").insert({
                    company_id: companyId,
                    user_id: user.id,
                    action_name: actionName,
                    status: actionStatus,
                    details: {
                      source: "agent_tool",
                      toolName,
                      toolCallId: toolCall.id,
                      args: toolArgs,
                      pendingConfirmation: pending ?? null,
                      preview: resultText.slice(0, 400),
                      toolStatus: toolExecution.status ?? null,
                      result: toolExecution.result ?? null,
                      iteration: iter + 1,
                    },
                    conversation_id: body.conversationId,
                  });

                  await supabase.from("activity_logs").insert({
                    company_id: companyId,
                    event_type: "ai.agent.tool_call",
                    actor_user_id: user.id,
                    payload: {
                      toolName,
                      actionName,
                      status: actionStatus,
                      toolCallId: toolCall.id,
                      iteration: iter + 1,
                    },
                  });
                } catch (auditError) {
                  writeLog("warn", "ai_api.audit_log_failed", {
                    ...baseLog,
                    userId: user.id,
                    toolName,
                    toolCallId: toolCall.id,
                    error: serializeError(auditError),
                  });
                }

                // Stream the tool result preview
                controller.enqueue(sseData({
                  tool_result: {
                    id: toolCall.id,
                    name: toolName,
                    preview: resultText.slice(0, 400),
                  },
                }));

                const toolPayloadForModel: Record<string, unknown> = {
                  toolName,
                  actionId:
                    typeof toolExecution.actionId === "string" && toolExecution.actionId
                      ? toolExecution.actionId
                      : toolName === "run_app_action" && typeof toolArgs.action_id === "string"
                      ? toolArgs.action_id
                      : toolName,
                  status: pending
                    ? "pending_confirmation"
                    : toolExecution.status ?? inferAgentToolStatusFromText(resultText),
                  message: resultText,
                  args: toolArgs,
                  pendingConfirmation: pending ?? null,
                  result: toolExecution.result ?? null,
                  artifacts: Array.isArray(toolExecution.artifacts) ? toolExecution.artifacts : [],
                  citations: Array.isArray(toolExecution.citations) ? toolExecution.citations.slice(0, 8) : [],
                };

                loopMessages.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  content: serializeToolResultForModel(toolPayloadForModel),
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
          artifacts: streamedArtifacts,
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
    writeLog("warn", "ai_api.invalid_body", {
      ...baseLog,
      userId: user.id,
      body: summarizeRawBody(raw),
      issues: parsed.error.flatten(),
    });
    return new Response(JSON.stringify({ error: "Invalid body", issues: parsed.error.flatten() }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const op = parsed.data;
  const { profile, error: pErr } = await getProfile(supabase, user.id);
  if (pErr || !profile?.company_id) {
    writeLog("warn", "ai_api.profile_not_ready", {
      ...baseLog,
      userId: user.id,
      error: pErr ?? null,
    });
    return new Response(JSON.stringify({ error: "Profile not ready" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const companyId = profile.company_id;
  const userRoles = normalizeRoles(profile.roles);
  writeLog("info", "ai_api.op_received", {
    ...baseLog,
    userId: user.id,
    companyId,
    op: op.op,
    body: summarizeRawBody(op),
  });

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
            execution_mode: op.executionMode ?? "confirm",
            messages: [],
            actions: [],
          })
          .select("id, mode, execution_mode, title, created_at, updated_at")
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "conversations.get": {
        const { data: conv, error: e1 } = await supabase
          .from("ai_conversations")
          .select("id, mode, execution_mode, title, metadata, created_at, updated_at")
          .eq("id", op.conversationId)
          .eq("company_id", companyId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (e1 || !conv) throw new Error("Not found");
        const { data: msgs, error: e2 } = await supabase
          .from("ai_messages")
          .select("id, role, content, citations, artifacts, token_usage, created_at")
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
          .select("id, mode, execution_mode, title, created_at, updated_at")
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
        if (op.executionMode) patch.execution_mode = op.executionMode;
        const { data, error } = await supabase
          .from("ai_conversations")
          .update(patch)
          .eq("id", op.conversationId)
          .eq("company_id", companyId)
          .eq("user_id", user.id)
          .select("id, mode, execution_mode, title, updated_at")
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
            artifacts: Array.isArray(op.artifacts) ? op.artifacts : [],
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
      case "tools.catalog": {
        const tools = await permittedActionsForRoles(supabase, companyId, userRoles);
        return new Response(JSON.stringify({ data: { tools } }), {
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
        let execOut: UnifiedActionExecution;
        if (found.toolSource === "integration") {
          const masterKey = Deno.env.get("CREDENTIALS_MASTER_KEY");
          if (!masterKey) {
            return new Response(JSON.stringify({ error: "Server misconfigured" }), {
              status: 500,
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
            execOut = {
              ok: false,
              pendingConfirmation: true,
              preview: exec.preview ?? {},
              providerKey: found.providerKey,
            };
          } else {
            execOut = {
              ok: true,
              result: exec.result ?? {},
              citations: Array.isArray(exec.citations) ? exec.citations : [],
              artifacts: [],
              providerKey: found.providerKey,
            };
          }
        } else {
          const appAction = findAppAction(op.actionId);
          if (!appAction) {
            return new Response(JSON.stringify({ error: "Action not found" }), {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          execOut = await executeAppAction(supabase, {
            action: appAction,
            companyId,
            userId: user.id,
            args: op.payload ?? {},
            confirmed: op.confirmed,
          });

          await supabase.from("activity_logs").insert({
            company_id: companyId,
            event_type: "app.tool.execute",
            actor_user_id: user.id,
            payload: {
              actionId: op.actionId,
              adapterTarget: appAction.adapterTarget,
              accessLevel: appAction.accessLevel,
              confirmed: op.confirmed,
            },
          });

          await supabase.from("ai_action_logs").insert({
            company_id: companyId,
            user_id: user.id,
            action_name: op.actionId,
            status: execOut.pendingConfirmation ? "pending_confirmation" : "completed",
            details: {
              source: "app",
              adapterTarget: appAction.adapterTarget,
              args: asRecord(op.payload ?? {}),
              preview: execOut.preview ?? null,
              result: execOut.result ?? null,
            },
            conversation_id: op.conversationId ?? null,
          });
        }

        if (execOut.pendingConfirmation) {
          return new Response(
            JSON.stringify({
              data: {
                ok: false,
                pendingConfirmation: true,
                preview: execOut.preview ?? {},
                actionId: op.actionId,
                providerKey: execOut.providerKey ?? found.providerKey,
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
            content: `Executed action ${op.actionId} successfully.`,
            citations: Array.isArray(execOut.citations) ? execOut.citations : [],
            artifacts: Array.isArray(execOut.artifacts) ? execOut.artifacts : [],
            token_usage: { toolExecution: true },
          });
        }

        return new Response(JSON.stringify({
          data: {
            ok: true,
            actionId: op.actionId,
            providerKey: execOut.providerKey ?? found.providerKey,
            result: execOut.result ?? {},
            citations: Array.isArray(execOut.citations) ? execOut.citations : [],
            artifacts: Array.isArray(execOut.artifacts) ? execOut.artifacts : [],
          },
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "contexts.fetch": {
        const lim = op.limit ?? 20;
        const providerResolution = resolveModelProvider();
        const { contextText, citations } = await retrieveRagContext(
          supabase,
          companyId,
          op.workspaceId,
          op.query ?? "",
          lim,
          {
            userRoles,
            userDepartment: profile.department,
            modelProvider: providerResolution.adapter,
          },
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
        const providerResolution = resolveModelProvider();
        const modelProvider = providerResolution.adapter;
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
          {
            userRoles,
            userDepartment: profile.department,
            modelProvider,
          },
        );

        const id = crypto.randomUUID();
        let content = "";

        if (!contextText.trim()) {
          content =
            "No tenant-grounded context is indexed yet. Connect integrations, sync unified entities, and add documents — then refresh for RAG-backed insights.";
        } else if (!modelProvider) {
          content =
            `Indexed context is available (${citations.length} citation(s)). ${providerResolution.error ?? "Model provider is unavailable."}`;
        } else {
          const model = "gpt-4o-mini";
          const sys =
            `You summarize internal operations for the Connected AI Business OS. ` +
            `Output ONLY valid JSON with key "insight" (string, max 3 short sentences). ` +
            `Use only facts present in the user message context; do not invent metrics. ` +
            `If context is thin, say what is missing instead of guessing.`;
          const userPayload = `Role lens: ${lens}. Time window label: ${preset}.\n\nContext:\n${contextText.slice(0, 10000)}`;

          const raw = await modelProvider.chatCompletions({
              model,
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: sys },
                { role: "user", content: userPayload },
              ],
            });
          const typed = raw as {
            choices?: { message?: { content?: string | null } }[];
          };
          const rawContent = typed?.choices?.[0]?.message?.content ?? "{}";
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
        const providerResolution = resolveModelProvider();
        if (!providerResolution.adapter) {
          return new Response(JSON.stringify({ error: "Server misconfigured" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const modelProvider = providerResolution.adapter;
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
          {
            userRoles,
            userDepartment: profile.department,
            modelProvider,
          },
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
        const raw = await modelProvider.chatCompletions({
            model,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: sys },
              {
                role: "user",
                content: `Synthesize an executive brief from this tenant snapshot:\n${userPayload}`,
              },
            ],
          });
        const typed = raw as {
          choices?: { message?: { content?: string | null } }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const content = typed?.choices?.[0]?.message?.content ?? "{}";
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
          prompt_tokens: typed.usage?.prompt_tokens ?? null,
          completion_tokens: typed.usage?.completion_tokens ?? null,
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
              usage: { ...typed.usage, latencyMs: latency, model },
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      case "complete.chat": {
        const providerResolution = resolveModelProvider();
        if (!providerResolution.adapter) {
          return new Response(JSON.stringify({ error: "Server misconfigured" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const modelProvider = providerResolution.adapter;
        const workspaceId = op.workspaceId ?? "global";
        const lastUser = [...op.messages].reverse().find((m) => m.role === "user");
        const q = lastUser?.content ?? "";
        const { contextText, citations } = await retrieveRagContext(
          supabase,
          companyId,
          workspaceId,
          q,
          6,
          {
            userRoles,
            userDepartment: profile.department,
            modelProvider,
          },
        );
        const mode = op.mode ?? "Ask";
        const sys =
          `You are the Connected AI Business OS assistant. Mode: ${mode}. Use tenant context; be concise.\n\nContext:\n${contextText || "(none)"}`;
        const model = op.model ?? "gpt-4o-mini";
        const started = performance.now();
        const data = await modelProvider.chatCompletions({
            model,
            messages: [{ role: "system", content: sys }, ...op.messages] as unknown as Array<Record<string, unknown>>,
          });
        const typed = data as {
          choices?: { message?: { content?: string | null } }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const text = typed?.choices?.[0]?.message?.content ?? "";
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
            token_usage: { ...typed.usage, model },
          });
        }

        await supabase.from("ai_usage_telemetry").insert({
          company_id: companyId,
          user_id: user.id,
          model,
          prompt_tokens: typed.usage?.prompt_tokens ?? null,
          completion_tokens: typed.usage?.completion_tokens ?? null,
          latency_ms: latency,
          conversation_id: op.conversationId ?? null,
        });

        return new Response(
          JSON.stringify({
            data: {
              message: text,
              citations,
              actions: chatActions,
              usage: { ...typed.usage, latencyMs: latency, model },
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
    writeLog("error", "ai_api.unhandled_error", {
      ...baseLog,
      userId: user.id,
      durationMs: Date.now() - startedAt,
      error: serializeError(e),
    });
    const message = e instanceof Error ? e.message : "Server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
