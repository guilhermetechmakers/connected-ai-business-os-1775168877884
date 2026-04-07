export type AiChatMode = "Ask" | "Analyze" | "Report" | "Action";

/** RAG / provenance citation (stored in `ai_messages.citations` JSONB). */
export type AiSourceCitation = {
  source: string;
  reference?: string;
  retrievedAt?: string;
  /** Indexed document id when `source` is `documents`. */
  docId?: string;
  snippet?: string;
  sourceProvider?: string;
};

export type AiConversationRow = {
  id: string;
  mode: AiChatMode;
  title: string | null;
  created_at: string;
  updated_at: string;
};

export type AiMessageRow = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: AiSourceCitation[] | null;
  token_usage: Record<string, unknown> | null;
  created_at: string;
};

export type AiPromptTemplateRow = {
  id: string;
  name: string;
  department: string | null;
  purpose: string;
  template_text: string;
  slots: unknown;
  is_active: boolean;
  /** DB column `workspace_mode` — maps to AI Workspace mode tabs. */
  workspace_mode?: AiChatMode;
  version?: number;
};

export type AiPermittedAction = {
  id: string;
  label: string;
  requiresConfirmation: boolean;
};

export type AiDashboardSummary = {
  tokenTotals7d: {
    prompt: number;
    completion: number;
    samples: number;
  };
  recentActions: {
    id: string;
    action_name: string;
    status: string;
    created_at: string;
    details: Record<string, unknown>;
  }[];
  recentPermissionDenials: {
    id: string;
    action_name: string;
    created_at: string;
  }[];
};

/** Single AI output row for global dashboard (`dashboard.insights` op). */
export type AiDashboardInsightOutput = {
  id: string;
  type: "summary" | "insight" | "action";
  content: string;
  citations: string[];
  allowedActions: string[];
};

/** A single tool the AI agent invoked (shown live during streaming). */
export type AiAgentToolCall = {
  id: string;
  name: string;
  args?: Record<string, unknown>;
  preview?: string;
  status: "running" | "done";
};

export type AiStreamEvent =
  | { citations: AiSourceCitation[] }
  | { c: string }
  | { tool_call: { id: string; name: string; args?: Record<string, unknown> } }
  | { tool_result: { id: string; name: string; preview: string } }
  | { suggestedActions: (AiPermittedAction | string)[] }
  | { done: true; usage?: Record<string, unknown> }
  | { error: string };

/** Indexed tenant document row (RAG source). */
export type AiIndexedDocumentRow = {
  id: string;
  source_provider: string;
  external_id: string | null;
  text_content: string | null;
  metadata: Record<string, unknown> | null;
  updated_at: string;
};

/** Edge op `workspace.documents.list` item. */
export type AiWorkspaceDocumentItem = {
  kind: "indexed" | "document";
  id: string;
  sourceProvider: string;
  externalId: string;
  title: string;
  snippet: string;
  metadata: Record<string, unknown>;
  departmentId: string | null;
  updatedAt: string;
};
