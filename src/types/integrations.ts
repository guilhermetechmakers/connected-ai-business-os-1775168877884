export type ConnectorCapability =
  | "oauth2"
  | "api_key"
  | "webhooks"
  | "rate_limited"
  | "read"
  | "write";

export type ConnectorRow = {
  id: string;
  company_id: string;
  provider_key: string;
  display_name: string | null;
  capabilities: unknown;
  config: Record<string, unknown>;
  config_hash: string | null;
  status: string;
  last_sync_at: string | null;
  sync_interval_minutes: number;
  created_at: string;
  updated_at: string;
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

export type IntegrationOp =
  | { op: "connectors.list" }
  | {
      op: "connectors.create";
      providerKey: string;
      displayName?: string;
    }
  | {
      op: "connectors.update";
      connectorId: string;
      status?: string;
      config?: Record<string, unknown>;
      syncIntervalMinutes?: number;
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
  | { op: "admin.tenants" }
  | { op: "admin.integrationOverview" };

export type ProviderDefinition = {
  key: string;
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
