export type AiChatMode = "Ask" | "Analyze" | "Report" | "Action";

export type AiSourceCitation = {
  source: string;
  reference?: string;
  retrievedAt?: string;
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

export type AiStreamEvent =
  | { citations: AiSourceCitation[] }
  | { c: string }
  | { done: true; usage?: Record<string, unknown> }
  | { error: string };
