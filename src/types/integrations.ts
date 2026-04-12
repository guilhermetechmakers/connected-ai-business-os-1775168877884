export type ConnectorCapability =
  | "oauth2"
  | "api_key"
  | "webhooks"
  | "rate_limited"
  | "read"
  | "write";

export type IntegrationProviderKey =
  | "slack"
  | "google_drive"
  | "gmail"
  | "google_calendar"
  | "hubspot"
  | "quickbooks"
  | "notion";

export type ConnectorRow = {
  id: string;
  company_id: string;
  provider_key: IntegrationProviderKey | string;
  display_name: string | null;
  capabilities: unknown;
  config: Record<string, unknown>;
  config_hash: string | null;
  status: string;
  last_sync_at: string | null;
  last_error_message?: string | null;
  last_error_remediation?: string | null;
  sync_interval_minutes: number;
  created_at: string;
  updated_at: string;
};

/** Catalog entry for onboarding / settings (maps to REST catalog concept). */
export type ProviderCatalogItem = {
  id: IntegrationProviderKey;
  name: string;
  description: string;
  logoUrl: string | null;
  supportsOAuth: boolean;
  supportsApiKey: boolean;
  linkedGroup?: "google_workspace" | null;
};

/** Field mapping rule with optional transform (persisted as connector_field_mappings). */
export type MappingRule = {
  sourceField: string;
  targetField: string;
  targetEntity: string;
  transformation?: string;
  required: boolean;
  sampleValue?: string;
};

/** Sync job shape (connector_sync_runs + log summary). */
export type SyncJob = {
  id: string;
  integrationId: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  rowsProcessed: number;
  errors: unknown;
};

export type ConnectorSyncRun = {
  id: string;
  company_id: string;
  connector_id: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  result_summary: Record<string, unknown>;
  idempotency_key: string | null;
  created_at: string;
};

export type ConnectorSyncLogEntry = {
  id: string;
  sync_run_id: string;
  level: string;
  message: string;
  error_details: Record<string, unknown> | null;
  created_at: string;
};

export type FieldMappingRow = {
  id: string;
  company_id: string;
  connector_id: string;
  source_field: string;
  target_entity: string;
  target_field: string;
  data_type: string;
  created_at: string;
};

export type IntegrationToolDefinition = {
  id: string;
  label: string;
  description?: string;
  providerKey: IntegrationProviderKey;
  accessLevel: "read" | "write";
  riskTier?: "low" | "medium" | "high" | "critical";
  requiresConfirmation: boolean;
  argsShape?: Record<string, unknown>;
};

export type ToolExecuteResult = {
  ok?: boolean;
  pendingConfirmation?: boolean;
  actionId?: string;
  providerKey?: IntegrationProviderKey;
  preview?: Record<string, unknown>;
  result?: Record<string, unknown>;
  citations?: Array<Record<string, unknown>>;
};

export type IntegrationOp =
  | { op: "connectors.list" }
  | { op: "catalog.list" }
  | {
      op: "connectors.create";
      providerKey: IntegrationProviderKey;
      displayName?: string;
    }
  | {
      op: "connectors.remove";
      connectorId: string;
    }
  | {
      op: "connectors.update";
      connectorId: string;
      status?: string;
      config?: Record<string, unknown>;
      syncIntervalMinutes?: number;
    }
  | {
      op: "connection.test";
      connectorId: string;
    }
  | {
      op: "oauth.start";
      providerKey: IntegrationProviderKey;
      connectorId?: string;
    }
  | {
      op: "oauth.callback";
      code: string;
      state: string;
    }
  | {
      op: "credentials.upsert";
      connectorId: string;
      credentials: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    }
  | { op: "credentials.meta"; connectorId: string }
  | {
      op: "sync.trigger";
      connectorId: string;
      idempotencyKey?: string;
    }
  | { op: "sync.list"; connectorId: string; limit?: number }
  | { op: "logs.list"; connectorId: string; limit?: number }
  | { op: "health.tenant" }
  | {
      op: "mappings.replace";
      connectorId: string;
      mappings: {
        sourceField: string;
        targetEntity: string;
        targetField: string;
        dataType?: string;
      }[];
    }
  | { op: "mappings.list"; connectorId: string }
  | { op: "tools.list" }
  | {
      op: "tools.execute";
      toolId: string;
      args?: Record<string, unknown>;
      confirmed?: boolean;
      conversationId?: string;
      workflowRunId?: string;
    }
  | { op: "admin.tenants" }
  | { op: "admin.integrationOverview" };

export type ProviderDefinition = {
  key: IntegrationProviderKey;
  label: string;
  description: string;
  capabilities: ConnectorCapability[];
  auth: "oauth2" | "api_key" | "both";
  defaultMappings: {
    sourceField: string;
    targetEntity: string;
    targetField: string;
    dataType: string;
  }[];
};
