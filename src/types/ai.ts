export type AiChatMode = "Ask" | "Analyze" | "Report" | "Action";
export type AiConversationExecutionMode = "confirm" | "auto";

export type AiDashboardArtifactLayoutSnapshot = {
  payloadVersion: number;
  layout: {
    id: string;
    name: string;
    dashboardKind: "global" | "executive";
    layoutJson: Record<string, unknown>;
  };
  widgets: Array<{
    id: string;
    widgetType: string;
    widgetDefinitionId?: string | null;
    config?: Record<string, unknown>;
    isVisible?: boolean;
  }>;
  widgetConfigs?: Record<string, Record<string, unknown>>;
  focus?: string | null;
  widgetTypes?: string[];
  reused?: boolean;
};

export type AiCustomDashboardQueryStep = {
  toolId: string;
  args?: Record<string, unknown>;
  provider?: string;
  label?: string;
};

export type AiCustomDashboardArtifactPayload = {
  payloadVersion: number;
  description?: string;
  codeTsx: string;
  queryPlan: AiCustomDashboardQueryStep[];
  snapshotData: Record<string, unknown>;
  sources: string[];
  integrationSources?: string[];
  visibilityMode?: "private" | "roles" | "company";
  sharedRoles?: string[];
  unsaved?: boolean;
  generatedAt?: string;
  refreshedAt?: string;
};

export type AiChatArtifact =
  | {
      id: string;
      type: "dashboard";
      title: string;
      dashboardKind?: string;
      layoutId?: string;
      route?: string;
      payload?: Record<string, unknown> | AiDashboardArtifactLayoutSnapshot;
      createdAt?: string;
    }
  | {
      id: string;
      type: "report";
      title: string;
      reportId?: string;
      route?: string;
      payload?: Record<string, unknown>;
      createdAt?: string;
    }
  | {
      id: string;
      type: "custom_dashboard";
      title: string;
      description?: string;
      customDashboardId?: string;
      route?: string;
      unsaved?: boolean;
      payload?: Record<string, unknown> | AiCustomDashboardArtifactPayload;
      createdAt?: string;
    }
  | {
      id: string;
      type: "pdf";
      title: string;
      reportId?: string;
      exportJobId?: string;
      route?: string;
      fileName?: string;
      mimeType?: string;
      storagePath?: string;
      downloadUrl?: string;
      payload?: Record<string, unknown>;
      createdAt?: string;
    };

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
  execution_mode?: AiConversationExecutionMode;
  title: string | null;
  created_at: string;
  updated_at: string;
};

export type AiMessageRow = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: AiSourceCitation[] | null;
  artifacts?: AiChatArtifact[] | null;
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
  /** DB column `workspace_mode` - maps to AI chat mode tabs. */
  workspace_mode?: AiChatMode;
  version?: number;
};

export type AiPermittedAction = {
  id: string;
  label: string;
  requiresConfirmation: boolean;
  providerKey?: string;
  accessLevel?: "read" | "write";
  domain?: string;
  toolSource?: "integration" | "app";
  adapterTarget?: string;
  argsSchema?: Record<string, unknown>;
};

export type AiActionExecutionResult = {
  ok: boolean;
  actionId: string;
  providerKey?: string;
  pendingConfirmation?: boolean;
  preview?: Record<string, unknown>;
  result?: Record<string, unknown>;
  citations?: AiSourceCitation[];
  artifacts?: AiChatArtifact[];
};

export type AiModeDiagnosticResult = {
  mode: AiChatMode;
  ok: boolean;
  latencyMs: number;
  citationCount: number;
  suggestedActions: string[];
  responsePreview: string;
  message: string;
};

export type AiDiagnosticsSummary = {
  generatedAt: string;
  overallOk: boolean;
  checks: AiModeDiagnosticResult[];
  actions: {
    permitted: number;
    hasSensitiveConfirmAction: boolean;
  };
  manualChecklist: string[];
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
  | {
      pending_confirmation: {
        actionId: string;
        label: string;
        preview?: Record<string, unknown>;
      };
    }
  | {
      pendingConfirmation: {
        actionId: string;
        label: string;
        preview?: Record<string, unknown>;
      };
    }
  | { artifact: AiChatArtifact }
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
  permissions?: Record<string, unknown>;
  departmentId: string | null;
  updatedAt: string;
  indexStatus?: string;
  chunkCount?: number;
  lastIndexedAt?: string | null;
  indexError?: string | null;
  storagePath?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
};
