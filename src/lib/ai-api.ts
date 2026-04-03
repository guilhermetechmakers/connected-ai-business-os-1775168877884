import { supabase } from "@/lib/supabase";
import type {
  AiChatMode,
  AiConversationRow,
  AiDashboardSummary,
  AiMessageRow,
  AiPermittedAction,
  AiPromptTemplateRow,
  AiSourceCitation,
  AiStreamEvent,
} from "@/types/ai";
import type { ExecutiveBriefResult } from "@/types/dashboard";

const fnUrl = (name: string) => {
  const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "") ?? "";
  return `${base}/functions/v1/${name}`;
};

const anonKey = () => import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Unauthorized");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    apikey: anonKey(),
  };
}

async function postAiJson<T>(body: Record<string, unknown>): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(fnUrl("ai-api"), { method: "POST", headers, body: JSON.stringify(body) });
  const json = (await res.json()) as { data?: T; error?: string; requiresConfirmation?: boolean };
  if (!res.ok) {
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

export async function listPromptTemplates(includeInactive?: boolean): Promise<AiPromptTemplateRow[]> {
  const data = await postAiJson<AiPromptTemplateRow[]>({
    op: "prompts.templates.list",
    includeInactive,
  });
  return Array.isArray(data) ? data : [];
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

export async function executeAiAction(params: {
  actionId: string;
  confirmed: boolean;
  conversationId?: string;
  payload?: Record<string, unknown>;
}): Promise<{ ok: boolean; log?: { id: string; created_at: string } }> {
  const data = await postAiJson<{ ok: boolean; log?: { id: string; created_at: string } }>({
    op: "actions.execute",
    actionId: params.actionId,
    confirmed: params.confirmed,
    conversationId: params.conversationId,
    payload: params.payload,
  });
  return data;
}

export async function fetchAiDashboardSummary(): Promise<AiDashboardSummary> {
  return postAiJson<AiDashboardSummary>({ op: "dashboard.aiSummary" });
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
  usage: Record<string, unknown>;
}> {
  return postAiJson<{
    message: string;
    citations: AiSourceCitation[];
    usage: Record<string, unknown>;
  }>({
    op: "complete.chat",
    messages: params.messages,
    mode: params.mode,
    conversationId: params.conversationId,
    workspaceId: params.workspaceId ?? "global",
    model: params.model,
  });
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
