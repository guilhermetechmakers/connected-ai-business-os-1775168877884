/**
 * IntegrationsManagerAPI — typed facade over `integrations-api` Edge Function ops.
 * Mirrors REST resource names conceptually; transport is `supabase.functions.invoke`.
 * Company setup suggestions use `tenants-api` (GET …/company/setup-suggestions equivalent).
 */
import { fetchOnboardingIntegrationSuggestions } from "@/api/tenants";
import { integrationsClient } from "@/lib/integrations-client";
import type { OnboardingIntegrationSuggestion } from "@/types/onboarding-domain";
import type {
  ConnectorRow,
  ConnectorSyncLogEntry,
  ConnectorSyncRun,
  FieldMappingRow,
  ProviderCatalogItem,
} from "@/types/integrations";

function safeCatalog(
  raw: unknown,
): ProviderCatalogItem[] {
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
    const res = await integrationsClient.invoke<{ connector?: ConnectorRow }>({
      op: "connectors.create",
      providerKey: input.providerKey,
      displayName: input.displayName,
    });
    return res?.connector ?? null;
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
