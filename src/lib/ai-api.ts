import { ApiUnauthorizedError } from "@/lib/edge-auth-errors";
import { edgeFunctionAuthHeaders } from "@/lib/edge-gateway-headers";
import { supabase, supabaseUrl } from "@/lib/supabase";
import type {
  AiActionExecutionResult,
  AiChatMode,
  AiConversationRow,
  AiDiagnosticsSummary,
  AiDashboardInsightOutput,
  AiDashboardSummary,
  AiMessageRow,
  AiPermittedAction,
  AiPromptTemplateRow,
  AiSourceCitation,
  AiStreamEvent,
  AiWorkspaceDocumentItem,
} from "@/types/ai";
import type { ExecutiveBriefResult } from "@/types/dashboard";

const fnUrl = (name: string) => {
  const base = supabaseUrl.replace(/\/$/, "");
  return `${base}/functions/v1/${name}`;
};

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiUnauthorizedError("Not signed in");
  return {
    "Content-Type": "application/json",
    ...edgeFunctionAuthHeaders(token),
  };
}

function isGatewayInvalidJwtJson(
  json: { message?: string } | undefined,
  status: number,
): boolean {
  const msg = json && typeof json.message === "string" ? json.message : "";
  return status === 401 && msg.toLowerCase().includes("invalid jwt");
}

function normalizePromptTemplateRow(raw: unknown): AiPromptTemplateRow {
  if (!raw || typeof raw !== "object") {
    return {
      id: "",
      name: "",
      department: null,
      purpose: "",
      template_text: "",
      slots: [],
      is_active: true,
      workspace_mode: "Ask",
      version: 1,
    };
  }
  const r = raw as Record<string, unknown>;
  const wm = r.workspace_mode;
  const mode: AiChatMode =
    wm === "Ask" || wm === "Analyze" || wm === "Report" || wm === "Action" ? wm : "Ask";
  return {
    id: String(r.id ?? ""),
    name: String(r.name ?? ""),
    department: typeof r.department === "string" ? r.department : null,
    purpose: String(r.purpose ?? ""),
    template_text: String(r.template_text ?? ""),
    slots: r.slots ?? [],
    is_active: Boolean(r.is_active ?? true),
    workspace_mode: mode,
    version: typeof r.version === "number" ? r.version : 1,
  };
}

async function postAiJson<T>(body: Record<string, unknown>): Promise<T> {
  const doFetch = async () => {
    const headers = await authHeaders();
    const res = await fetch(fnUrl("ai-api"), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as {
      data?: T;
      error?: string;
      message?: string;
      requiresConfirmation?: boolean;
    };
    return { res, json };
  };

  let { res, json } = await doFetch();

  if (isGatewayInvalidJwtJson(json, res.status)) {
    await supabase.auth.refreshSession();
    ({ res, json } = await doFetch());
  }

  if (!res.ok) {
    if (res.status === 401) {
      throw new ApiUnauthorizedError(json.error ?? json.message ?? "Unauthorized");
    }
    throw new Error(json.error ?? `AI API ${res.status}`);
  }
  if (json.data === undefined) {
    throw new Error(json.error ?? "Invalid AI response");
  }
  return json.data;
}

export async function createAiConversation(params?: {
  mode?: AiChatMode;
  title?: string;
}): Promise<AiConversationRow> {
  const data = await postAiJson<AiConversationRow>({
    op: "conversations.create",
    mode: params?.mode,
    title: params?.title,
  });
  return data;
}

export async function listAiConversations(limit?: number): Promise<AiConversationRow[]> {
  const data = await postAiJson<AiConversationRow[]>({
    op: "conversations.list",
    limit,
  });
  return Array.isArray(data) ? data : [];
}

export async function getAiConversation(conversationId: string): Promise<{
  conversation: AiConversationRow & { metadata?: unknown };
  messages: AiMessageRow[];
}> {
  const data = await postAiJson<{
    conversation: AiConversationRow & { metadata?: unknown };
    messages: AiMessageRow[];
  }>({
    op: "conversations.get",
    conversationId,
  });
  const messages = Array.isArray(data?.messages) ? data.messages : [];
  return { conversation: data.conversation, messages };
}

export async function updateAiConversation(
  conversationId: string,
  patch: { mode?: AiChatMode; title?: string },
): Promise<AiConversationRow> {
  return postAiJson<AiConversationRow>({
    op: "conversations.update",
    conversationId,
    ...patch,
  });
}

export async function listPromptTemplates(params?: {
  includeInactive?: boolean;
  workspaceMode?: AiChatMode;
}): Promise<AiPromptTemplateRow[]> {
  const data = await postAiJson<unknown[]>({
    op: "prompts.templates.list",
    includeInactive: params?.includeInactive,
    workspaceMode: params?.workspaceMode,
  });
  const list = Array.isArray(data) ? data : [];
  return list.map((row) => normalizePromptTemplateRow(row));
}

export async function upsertPromptTemplate(params: {
  templateId?: string;
  name: string;
  templateText: string;
  workspaceMode: AiChatMode;
  department?: string | null;
  purpose?: string;
  slots?: unknown;
  isActive?: boolean;
  version?: number;
}): Promise<AiPromptTemplateRow> {
  const data = await postAiJson<unknown>({
    op: "prompts.templates.upsert",
    templateId: params.templateId,
    name: params.name,
    templateText: params.templateText,
    workspaceMode: params.workspaceMode,
    department: params.department,
    purpose: params.purpose,
    slots: params.slots ?? [],
    isActive: params.isActive,
    version: params.version,
  });
  return normalizePromptTemplateRow(data);
}

export async function fetchWorkspaceDocuments(params?: {
  workspaceId?: string;
  limit?: number;
  sourceFilter?: string;
}): Promise<AiWorkspaceDocumentItem[]> {
  const data = await postAiJson<{ items: AiWorkspaceDocumentItem[] }>({
    op: "workspace.documents.list",
    workspaceId: params?.workspaceId ?? "global",
    limit: params?.limit,
    sourceFilter: params?.sourceFilter,
  });
  const items = data?.items;
  if (!Array.isArray(items)) return [];
  return items.filter(
    (x): x is AiWorkspaceDocumentItem =>
      Boolean(x && typeof x === "object" && "id" in x && "sourceProvider" in x),
  );
}

export async function assemblePrompt(
  templateId: string,
  slotValues: Record<string, string>,
): Promise<string> {
  const data = await postAiJson<{ assembled: string }>({
    op: "prompts.assemble",
    templateId,
    slotValues,
  });
  return data.assembled ?? "";
}

export async function fetchAiPermissions(): Promise<AiPermittedAction[]> {
  const data = await postAiJson<{ actions: AiPermittedAction[] }>({
    op: "actions.permissions",
  });
  const actions = data?.actions;
  return Array.isArray(actions) ? actions : [];
}

export async function runAiToolsDiagnostics(): Promise<AiDiagnosticsSummary> {
  return postAiJson<AiDiagnosticsSummary>({
    op: "tools.diagnostics.run",
  });
}

export async function executeAiAction(params: {
  actionId: string;
  confirmed: boolean;
  conversationId?: string;
  payload?: Record<string, unknown>;
}): Promise<AiActionExecutionResult> {
  const data = await postAiJson<AiActionExecutionResult>({
    op: "actions.execute",
    actionId: params.actionId,
    confirmed: params.confirmed,
    conversationId: params.conversationId,
    payload: params.payload,
  });
  return {
    ok: Boolean(data?.ok),
    actionId: typeof data?.actionId === "string" ? data.actionId : params.actionId,
    providerKey: typeof data?.providerKey === "string" ? data.providerKey : undefined,
    pendingConfirmation: Boolean(data?.pendingConfirmation),
    preview: data?.preview && typeof data.preview === "object" ? data.preview : undefined,
    result: data?.result && typeof data.result === "object" ? data.result : undefined,
    citations: Array.isArray(data?.citations) ? data.citations : [],
  };
}

export async function fetchAiDashboardSummary(): Promise<AiDashboardSummary> {
  return postAiJson<AiDashboardSummary>({ op: "dashboard.aiSummary" });
}

/** Tenant-scoped dashboard insights with citations + permission-filtered action ids (Edge Function `ai-api`). */
export async function fetchAiDashboardInsights(params?: {
  roleView?: string;
  datePreset?: "7d" | "30d" | "90d";
}): Promise<AiDashboardInsightOutput[]> {
  const data = await postAiJson<{ outputs: AiDashboardInsightOutput[] }>({
    op: "dashboard.insights",
    roleView: params?.roleView,
    datePreset: params?.datePreset,
  });
  const outputs = data?.outputs;
  return Array.isArray(outputs) ? outputs : [];
}

export async function fetchExecutiveBrief(params?: {
  timeframe?: "7d" | "30d" | "90d";
}): Promise<ExecutiveBriefResult> {
  return postAiJson<ExecutiveBriefResult>({
    op: "dashboard.executiveBrief",
    timeframe: params?.timeframe,
  });
}

export async function completeAiChat(params: {
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  mode?: AiChatMode;
  conversationId?: string;
  workspaceId?: string;
  model?: string;
}): Promise<{
  message: string;
  citations: AiSourceCitation[];
  actions: AiPermittedAction[];
  usage: Record<string, unknown>;
}> {
  const raw = await postAiJson<{
    message: string;
    citations: AiSourceCitation[];
    actions?: AiPermittedAction[];
    usage: Record<string, unknown>;
  }>({
    op: "complete.chat",
    messages: params.messages,
    mode: params.mode,
    conversationId: params.conversationId,
    workspaceId: params.workspaceId ?? "global",
    model: params.model,
  });
  const actions = Array.isArray(raw.actions)
    ? raw.actions
        .filter((a): a is AiPermittedAction =>
          Boolean(a && typeof a === "object" && typeof a.id === "string"),
        )
    : [];
  return {
    message: typeof raw.message === "string" ? raw.message : "",
    citations: Array.isArray(raw.citations) ? raw.citations : [],
    actions,
    usage: raw.usage && typeof raw.usage === "object" ? raw.usage : {},
  };
}

export async function fetchAiContexts(params: {
  workspaceId?: string;
  query?: string;
  limit?: number;
}): Promise<{ snippets: string; citations: AiSourceCitation[] }> {
  return postAiJson<{ snippets: string; citations: AiSourceCitation[] }>({
    op: "contexts.fetch",
    workspaceId: params.workspaceId ?? "global",
    query: params.query,
    limit: params.limit,
  });
}

export async function streamAiChat(params: {
  conversationId: string;
  userMessage: string;
  mode: AiChatMode;
  model?: string;
  workspaceId?: string;
  onCitations: (c: AiSourceCitation[]) => void;
  onChunk: (text: string) => void;
  onSuggestedActions?: (actionIds: string[]) => void;
  onDone: (usage?: Record<string, unknown>) => void;
  onError: (message: string) => void;
}): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(fnUrl("ai-api"), {
    method: "POST",
    headers,
    body: JSON.stringify({
      op: "stream.chat",
      conversationId: params.conversationId,
      userMessage: params.userMessage,
      mode: params.mode,
      model: params.model,
      workspaceId: params.workspaceId ?? "global",
    }),
  });

  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    params.onError(j.error ?? `Stream failed (${res.status})`);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    params.onError("No response body");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  const parseEvent = (line: string) => {
    if (!line.startsWith("data:")) return;
    const raw = line.slice(5).trim();
    if (!raw) return;
    try {
      const ev = JSON.parse(raw) as AiStreamEvent;
      if ("citations" in ev && Array.isArray(ev.citations)) {
        params.onCitations(ev.citations);
      } else if ("c" in ev && typeof ev.c === "string") {
        params.onChunk(ev.c);
      } else if ("suggestedActions" in ev && Array.isArray(ev.suggestedActions)) {
        const ids = ev.suggestedActions
          .map((x) => {
            if (typeof x === "string") return x;
            if (x && typeof x === "object" && "id" in x && typeof (x as { id: unknown }).id === "string") {
              return (x as { id: string }).id;
            }
            return null;
          })
          .filter((x): x is string => Boolean(x));
        params.onSuggestedActions?.(ids);
      } else if ("done" in ev && ev.done) {
        params.onDone("usage" in ev ? (ev.usage as Record<string, unknown>) : undefined);
      } else if ("error" in ev && typeof ev.error === "string") {
        params.onError(ev.error);
      }
    } catch {
      /* ignore partial */
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        parseEvent(part.replace(/\r$/, "").trim());
      }
    }
    if (buffer.trim()) parseEvent(buffer.replace(/\r$/, "").trim());
  } catch (e) {
    params.onError(e instanceof Error ? e.message : "Stream read error");
  }
}
