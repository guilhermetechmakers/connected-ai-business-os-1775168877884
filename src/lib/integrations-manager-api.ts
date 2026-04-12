/**
 * IntegrationsManagerAPI — typed facade over `integrations-api` Edge Function ops.
 * Mirrors REST resource names conceptually; transport is `supabase.functions.invoke`.
 * Company setup suggestions use `tenants-api`.
 */
import { fetchOnboardingIntegrationSuggestions } from "@/api/tenants";
import { integrationsClient } from "@/lib/integrations-client";
import type { OnboardingIntegrationSuggestion } from "@/types/onboarding-domain";
import type {
  ConnectorRow,
  ConnectorSyncLogEntry,
  ConnectorSyncRun,
  FieldMappingRow,
  IntegrationProviderKey,
  IntegrationToolDefinition,
  ProviderCatalogItem,
  ToolExecuteResult,
} from "@/types/integrations";

const PROVIDER_KEYS: IntegrationProviderKey[] = [
  "slack",
  "google_drive",
  "gmail",
  "google_calendar",
  "zoom",
  "hubspot",
  "quickbooks",
  "stripe",
  "notion",
  "clickup",
  "monday",
  "trello",
];

function toProviderKey(value: string): IntegrationProviderKey {
  if (PROVIDER_KEYS.includes(value as IntegrationProviderKey)) {
    return value as IntegrationProviderKey;
  }
  throw new Error(`Unsupported provider: ${value}`);
}

function safeCatalog(raw: unknown): ProviderCatalogItem[] {
  if (!raw || typeof raw !== "object") return [];
  const c = (raw as { catalog?: unknown }).catalog;
  if (!Array.isArray(c)) return [];
  return c.filter(
    (x): x is ProviderCatalogItem =>
      x !== null &&
      typeof x === "object" &&
      typeof (x as ProviderCatalogItem).id === "string" &&
      typeof (x as ProviderCatalogItem).name === "string",
  );
}

function safeConnectors(raw: unknown): ConnectorRow[] {
  if (!raw || typeof raw !== "object") return [];
  const list = (raw as { connectors?: unknown }).connectors;
  return Array.isArray(list) ? (list as ConnectorRow[]) : [];
}

function safeTools(raw: unknown): IntegrationToolDefinition[] {
  if (!raw || typeof raw !== "object") return [];
  const list = (raw as { tools?: unknown }).tools;
  return Array.isArray(list) ? (list as IntegrationToolDefinition[]) : [];
}

export const integrationsManagerApi = {
  async fetchCompanySetupSuggestions(): Promise<OnboardingIntegrationSuggestion[]> {
    const list = await fetchOnboardingIntegrationSuggestions();
    return Array.isArray(list) ? list : [];
  },

  async fetchCatalog(): Promise<ProviderCatalogItem[]> {
    const res = await integrationsClient.invoke<{ catalog?: ProviderCatalogItem[] }>({
      op: "catalog.list",
    });
    return safeCatalog(res);
  },

  async fetchTenantIntegrations(): Promise<ConnectorRow[]> {
    const res = await integrationsClient.invoke<{ connectors?: ConnectorRow[] }>({
      op: "connectors.list",
    });
    return safeConnectors(res);
  },

  async createOrUpdateIntegration(input: {
    providerKey: string;
    displayName?: string;
  }): Promise<ConnectorRow | null> {
    const providerKey = toProviderKey(input.providerKey);
    const res = await integrationsClient.invoke<{ connector?: ConnectorRow }>({
      op: "connectors.create",
      providerKey,
      displayName: input.displayName,
    });
    return res?.connector ?? null;
  },

  async startOAuth(input: {
    providerKey: string;
    connectorId?: string;
  }): Promise<{
    connectorId: string;
    authUrl: string;
    state: string;
    providerKey: IntegrationProviderKey;
    expiresAt: string;
  }> {
    const providerKey = toProviderKey(input.providerKey);
    return integrationsClient.invoke({
      op: "oauth.start",
      providerKey,
      connectorId: input.connectorId,
    });
  },

  async completeOAuthCallback(input: {
    code: string;
    state: string;
  }): Promise<{ ok: true; providerKey: IntegrationProviderKey; connectorIds: string[] }> {
    return integrationsClient.invoke({
      op: "oauth.callback",
      code: input.code,
      state: input.state,
    });
  },

  async listTools(): Promise<IntegrationToolDefinition[]> {
    const res = await integrationsClient.invoke<{ tools?: IntegrationToolDefinition[] }>({
      op: "tools.list",
    });
    return safeTools(res);
  },

  async executeTool(input: {
    toolId: string;
    args?: Record<string, unknown>;
    confirmed?: boolean;
    conversationId?: string;
    workflowRunId?: string;
  }): Promise<ToolExecuteResult> {
    return integrationsClient.invoke<ToolExecuteResult>({
      op: "tools.execute",
      toolId: input.toolId,
      args: input.args,
      confirmed: input.confirmed,
      conversationId: input.conversationId,
      workflowRunId: input.workflowRunId,
    });
  },

  async patchIntegration(input: {
    integrationId: string;
    status?: string;
    syncIntervalMinutes?: number;
    config?: Record<string, unknown>;
  }): Promise<ConnectorRow | null> {
    const res = await integrationsClient.invoke<{ connector?: ConnectorRow }>({
      op: "connectors.update",
      connectorId: input.integrationId,
      status: input.status,
      syncIntervalMinutes: input.syncIntervalMinutes,
      config: input.config,
    });
    return res?.connector ?? null;
  },

  async saveMapping(input: {
    integrationId: string;
    mappings: {
      sourceField: string;
      targetEntity: string;
      targetField: string;
      dataType?: string;
    }[];
  }): Promise<boolean> {
    const res = await integrationsClient.invoke<{ ok?: boolean }>({
      op: "mappings.replace",
      connectorId: input.integrationId,
      mappings: input.mappings,
    });
    return Boolean(res?.ok);
  },

  async testConnection(integrationId: string): Promise<{
    ok: boolean;
    message?: string;
    remediation?: string;
  }> {
    const res = await integrationsClient.invoke<{
      ok?: boolean;
      message?: string;
      remediation?: string;
      error?: string;
    }>({
      op: "connection.test",
      connectorId: integrationId,
    });
    if (res && typeof res === "object" && "error" in res && res.error) {
      return { ok: false, message: String(res.error) };
    }
    return {
      ok: Boolean(res?.ok),
      message: typeof res?.message === "string" ? res.message : undefined,
      remediation: typeof res?.remediation === "string" ? res.remediation : undefined,
    };
  },

  async runSync(integrationId: string, idempotencyKey?: string): Promise<unknown> {
    return integrationsClient.invoke({
      op: "sync.trigger",
      connectorId: integrationId,
      idempotencyKey,
    });
  },

  async fetchSyncLogs(integrationId: string, limit = 80): Promise<ConnectorSyncLogEntry[]> {
    const res = await integrationsClient.invoke<{ logs?: ConnectorSyncLogEntry[] }>({
      op: "logs.list",
      connectorId: integrationId,
      limit,
    });
    return Array.isArray(res?.logs) ? res.logs : [];
  },

  async fetchSyncRuns(integrationId: string, limit = 25): Promise<ConnectorSyncRun[]> {
    const res = await integrationsClient.invoke<{ runs?: ConnectorSyncRun[] }>({
      op: "sync.list",
      connectorId: integrationId,
      limit,
    });
    return Array.isArray(res?.runs) ? res.runs : [];
  },

  async fetchMappings(integrationId: string): Promise<FieldMappingRow[]> {
    const res = await integrationsClient.invoke<{ mappings?: FieldMappingRow[] }>({
      op: "mappings.list",
      connectorId: integrationId,
    });
    return Array.isArray(res?.mappings) ? res.mappings : [];
  },

  async removeIntegration(integrationId: string): Promise<boolean> {
    const res = await integrationsClient.invoke<{ ok?: boolean }>({
      op: "connectors.remove",
      connectorId: integrationId,
    });
    return Boolean(res?.ok);
  },
};

