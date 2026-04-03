import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { integrationsManagerApi } from "@/lib/integrations-manager-api";
import { integrationsClient } from "@/lib/integrations-client";
import type {
  ConnectorRow,
  ConnectorSyncLogEntry,
  ConnectorSyncRun,
  FieldMappingRow,
} from "@/types/integrations";

const qk = {
  catalog: ["integrations", "catalog"] as const,
  connectors: ["integrations", "connectors"] as const,
  health: ["integrations", "health"] as const,
  syncs: (id: string) => ["integrations", "syncs", id] as const,
  logs: (id: string) => ["integrations", "logs", id] as const,
  mappings: (id: string) => ["integrations", "mappings", id] as const,
  adminTenants: ["integrations", "admin", "tenants"] as const,
  adminOverview: ["integrations", "admin", "overview"] as const,
};

export function useIntegrationCatalogQuery() {
  return useQuery({
    queryKey: qk.catalog,
    queryFn: async () => {
      const list = await integrationsManagerApi.fetchCatalog();
      return Array.isArray(list) ? list : [];
    },
  });
}

export function useConnectorsQuery() {
  return useQuery({
    queryKey: qk.connectors,
    queryFn: async () => {
      const res = await integrationsClient.invoke<{ connectors: ConnectorRow[] }>(
        { op: "connectors.list" },
      );
      const list = Array.isArray(res?.connectors) ? res.connectors : [];
      return list;
    },
  });
}

export function useTenantHealthQuery() {
  return useQuery({
    queryKey: qk.health,
    queryFn: () =>
      integrationsClient.invoke<{
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
      }>({ op: "health.tenant" }),
  });
}

export function useConnectorSyncsQuery(connectorId: string | undefined) {
  return useQuery({
    queryKey: qk.syncs(connectorId ?? "none"),
    enabled: Boolean(connectorId),
    queryFn: async () => {
      if (!connectorId) return [];
      const res = await integrationsClient.invoke<{ runs: ConnectorSyncRun[] }>({
        op: "sync.list",
        connectorId,
        limit: 25,
      });
      return Array.isArray(res?.runs) ? res.runs : [];
    },
  });
}

export function useConnectorLogsQuery(connectorId: string | undefined) {
  return useQuery({
    queryKey: qk.logs(connectorId ?? "none"),
    enabled: Boolean(connectorId),
    queryFn: async () => {
      if (!connectorId) return [];
      const res = await integrationsClient.invoke<{ logs: ConnectorSyncLogEntry[] }>(
        {
          op: "logs.list",
          connectorId,
          limit: 80,
        },
      );
      return Array.isArray(res?.logs) ? res.logs : [];
    },
  });
}

export function useMappingsQuery(connectorId: string | undefined) {
  return useQuery({
    queryKey: qk.mappings(connectorId ?? "none"),
    enabled: Boolean(connectorId),
    queryFn: async () => {
      if (!connectorId) return [];
      const res = await integrationsClient.invoke<{ mappings: FieldMappingRow[] }>({
        op: "mappings.list",
        connectorId,
      });
      return Array.isArray(res?.mappings) ? res.mappings : [];
    },
  });
}

export function useCreateConnectorMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { providerKey: string; displayName?: string }) => {
      const connector = await integrationsManagerApi.createOrUpdateIntegration({
        providerKey: input.providerKey,
        displayName: input.displayName,
      });
      return { connector };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.connectors });
      void qc.invalidateQueries({ queryKey: qk.health });
    },
  });
}

export function useRemoveConnectorMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (connectorId: string) =>
      integrationsManagerApi.removeIntegration(connectorId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.connectors });
      void qc.invalidateQueries({ queryKey: qk.health });
    },
  });
}

export function useTestConnectionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (connectorId: string) =>
      integrationsManagerApi.testConnection(connectorId),
    onSettled: (_d, _e, connectorId) => {
      void qc.invalidateQueries({ queryKey: qk.connectors });
      void qc.invalidateQueries({ queryKey: qk.health });
      if (connectorId) {
        void qc.invalidateQueries({ queryKey: qk.mappings(connectorId) });
      }
    },
  });
}

export function useUpsertCredentialsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      connectorId: string;
      credentials: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    }) =>
      integrationsClient.invoke<{ ok: boolean }>({
        op: "credentials.upsert",
        connectorId: input.connectorId,
        credentials: input.credentials,
        metadata: input.metadata,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.connectors });
    },
  });
}

export function useTriggerSyncMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { connectorId: string; idempotencyKey?: string }) =>
      integrationsClient.invoke<unknown>({
        op: "sync.trigger",
        connectorId: input.connectorId,
        idempotencyKey: input.idempotencyKey,
      }),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: qk.connectors });
      void qc.invalidateQueries({ queryKey: qk.health });
      void qc.invalidateQueries({ queryKey: qk.syncs(vars.connectorId) });
      void qc.invalidateQueries({ queryKey: qk.logs(vars.connectorId) });
    },
  });
}

export function useReplaceMappingsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      connectorId: string;
      mappings: {
        sourceField: string;
        targetEntity: string;
        targetField: string;
        dataType?: string;
      }[];
    }) =>
      integrationsClient.invoke<{ ok: boolean }>({
        op: "mappings.replace",
        connectorId: input.connectorId,
        mappings: input.mappings,
      }),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: qk.mappings(vars.connectorId) });
      void qc.invalidateQueries({ queryKey: qk.connectors });
    },
  });
}

export function useUpdateConnectorMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      connectorId: string;
      status?: string;
      syncIntervalMinutes?: number;
    }) =>
      integrationsClient.invoke<{ connector: ConnectorRow }>({
        op: "connectors.update",
        connectorId: input.connectorId,
        status: input.status,
        syncIntervalMinutes: input.syncIntervalMinutes,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.connectors });
      void qc.invalidateQueries({ queryKey: qk.health });
    },
  });
}

export function useAdminTenantsQuery() {
  return useQuery({
    queryKey: qk.adminTenants,
    queryFn: async () => {
      const res = await integrationsClient.invoke<{
        tenants: { id: string; name: string; created_at: string }[];
      }>({ op: "admin.tenants" });
      return Array.isArray(res?.tenants) ? res.tenants : [];
    },
    retry: false,
  });
}

export function useAdminIntegrationOverviewQuery() {
  return useQuery({
    queryKey: qk.adminOverview,
    queryFn: async () => {
      const res = await integrationsClient.invoke<{
        overview: {
          companyId: string;
          name: string;
          connectorCount: number;
          healthy: number;
          lastSync: string | null;
        }[];
      }>({ op: "admin.integrationOverview" });
      return Array.isArray(res?.overview) ? res.overview : [];
    },
    retry: false,
  });
}
