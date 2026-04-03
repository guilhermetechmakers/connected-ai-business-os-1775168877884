import { CONNECTOR_PROVIDERS } from "@/lib/connector-registry";
import { integrationsMock } from "@/lib/integrations-mock";
import { supabase } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { IntegrationOp, ProviderCatalogItem } from "@/types/integrations";

function mockCatalogList(): { catalog: ProviderCatalogItem[] } {
  const raw = Array.isArray(CONNECTOR_PROVIDERS) ? CONNECTOR_PROVIDERS : [];
  const catalog: ProviderCatalogItem[] = raw.map((p) => ({
    id: p.key,
    name: p.label,
    description: p.description,
    logoUrl: null,
    supportsOAuth: p.auth === "oauth2" || p.auth === "both",
    supportsApiKey: p.auth === "api_key" || p.auth === "both",
  }));
  return { catalog };
}

type InvokeResult<T> = T & { error?: string };

async function invokeIntegrations<T>(body: IntegrationOp): Promise<T> {
  if (!isSupabaseConfigured) {
    return simulateIntegrations<T>(body);
  }

  const { data, error } = await supabase.functions.invoke<
    InvokeResult<T>
  >("integrations-api", { body });

  if (error) {
    throw new Error(error.message);
  }
  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new Error(String(data.error));
  }
  return data as T;
}

function simulateIntegrations<T>(body: IntegrationOp): T {
  switch (body.op) {
    case "catalog.list":
      return mockCatalogList() as T;
    case "connectors.list":
      return integrationsMock.connectorsList() as T;
    case "health.tenant":
      return integrationsMock.healthTenant() as T;
    case "sync.list":
      return integrationsMock.syncList(body.connectorId) as T;
    case "mappings.list":
      return integrationsMock.mappingsList() as T;
    case "admin.integrationOverview":
      return integrationsMock.adminOverview() as T;
    case "admin.tenants":
      return integrationsMock.adminTenants() as T;
    case "connectors.remove":
      return { ok: true } as T;
    case "connection.test":
      return {
        ok: true,
        checkedAt: new Date().toISOString(),
        note: "Local mock — credentials accepted",
      } as T;
    case "connectors.create":
      return {
        connector: {
          id: crypto.randomUUID(),
          company_id: "local",
          provider_key: body.providerKey,
          display_name: body.displayName ?? body.providerKey,
          capabilities: [],
          config: {},
          config_hash: null,
          status: "disconnected",
          last_sync_at: null,
          last_error_message: null,
          last_error_remediation: null,
          sync_interval_minutes: 360,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      } as T;
    case "credentials.upsert":
      return { ok: true, masked: { note: "Local mock — no persistence" } } as T;
    case "sync.trigger":
      return {
        run: {
          id: crypto.randomUUID(),
          company_id: "local",
          connector_id: body.connectorId,
          started_at: new Date().toISOString(),
          ended_at: new Date().toISOString(),
          status: "completed",
          result_summary: { stub: true },
          idempotency_key: body.idempotencyKey ?? null,
          created_at: new Date().toISOString(),
        },
        stub: {
          recordsProcessed: 6,
          unifiedEntitiesUpserted: 4,
          notes: ["Mock sync completed"],
        },
      } as T;
    case "mappings.replace":
      return { ok: true, count: body.mappings.length } as T;
    case "connectors.update":
      return {
        connector: {
          id: body.connectorId,
          company_id: "local",
          provider_key: "mock",
          display_name: "Mock",
          capabilities: [],
          config: body.config ?? {},
          config_hash: null,
          status: body.status ?? "connected",
          last_sync_at: null,
          last_error_message: null,
          last_error_remediation: null,
          sync_interval_minutes: body.syncIntervalMinutes ?? 360,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      } as T;
    case "credentials.meta":
      return { meta: { hasClientId: true, hasApiKey: false } } as T;
    case "logs.list":
      return { logs: [] } as T;
    default:
      return {} as T;
  }
}

export const integrationsClient = {
  invoke: invokeIntegrations,
};
