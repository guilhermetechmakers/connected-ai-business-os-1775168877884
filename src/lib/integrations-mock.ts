import type {
  ConnectorRow,
  ConnectorSyncRun,
  FieldMappingRow,
} from "@/types/integrations";

const MOCK_CONNECTORS: ConnectorRow[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    company_id: "mock-company",
    provider_key: "slack",
    display_name: "Slack",
    capabilities: [],
    config: { workspace: "acme" },
    config_hash: null,
    status: "healthy",
    last_sync_at: new Date().toISOString(),
    sync_interval_minutes: 120,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    company_id: "mock-company",
    provider_key: "hubspot",
    display_name: "HubSpot",
    capabilities: [],
    config: {},
    config_hash: null,
    status: "connected",
    last_sync_at: null,
    sync_interval_minutes: 360,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const integrationsMock = {
  connectorsList(): { connectors: ConnectorRow[] } {
    return { connectors: MOCK_CONNECTORS };
  },
  healthTenant(): {
    summary: {
      total: number;
      healthy: number;
      errors: number;
      degraded: number;
    };
    connectors: Pick<
      ConnectorRow,
      "id" | "provider_key" | "status" | "last_sync_at"
    >[];
  } {
    const list = MOCK_CONNECTORS.map((c) => ({
      id: c.id,
      provider_key: c.provider_key,
      status: c.status,
      last_sync_at: c.last_sync_at,
    }));
    return {
      summary: {
        total: list.length,
        healthy: list.filter((c) => c.status === "healthy").length,
        errors: list.filter((c) => c.status === "error").length,
        degraded: 0,
      },
      connectors: list,
    };
  },
  syncList(connectorId: string): { runs: ConnectorSyncRun[] } {
    const run: ConnectorSyncRun = {
      id: "00000000-0000-4000-8000-000000000099",
      company_id: "mock-company",
      connector_id: connectorId,
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
      status: "completed",
      result_summary: { recordsProcessed: 10, stub: true },
      idempotency_key: "mock",
      created_at: new Date().toISOString(),
    };
    return { runs: [run] };
  },
  mappingsList(): { mappings: FieldMappingRow[] } {
    return { mappings: [] };
  },
  adminOverview(): {
    overview: {
      companyId: string;
      name: string;
      connectorCount: number;
      healthy: number;
      lastSync: string | null;
    }[];
  } {
    return {
      overview: [
        {
          companyId: "11111111-1111-4111-8111-111111111111",
          name: "Acme Co",
          connectorCount: 4,
          healthy: 3,
          lastSync: new Date().toISOString(),
        },
        {
          companyId: "22222222-2222-4222-8222-222222222222",
          name: "Northline",
          connectorCount: 2,
          healthy: 2,
          lastSync: null,
        },
      ],
    };
  },
  adminTenants(): { tenants: { id: string; name: string; created_at: string }[] } {
    return {
      tenants: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Acme Co",
          created_at: new Date().toISOString(),
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Northline",
          created_at: new Date().toISOString(),
        },
      ],
    };
  },
};
