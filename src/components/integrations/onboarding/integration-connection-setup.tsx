import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { ApiKeyConnectModal } from "@/components/integrations/onboarding/api-key-connect-modal";
import { ConnectionStatusBanner } from "@/components/integrations/onboarding/connection-status-banner";
import { IntegrationCatalogCard } from "@/components/integrations/onboarding/integration-catalog-card";
import { IntegrationOnboardingBreadcrumbs } from "@/components/integrations/onboarding/integration-onboarding-breadcrumbs";
import { MappingWizard } from "@/components/integrations/onboarding/mapping-wizard";
import { OAuthConnectModal } from "@/components/integrations/onboarding/oauth-connect-modal";
import { SyncControlPanel } from "@/components/integrations/onboarding/sync-control-panel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useConnectorsQuery,
  useCreateConnectorMutation,
  useIntegrationCatalogQuery,
  useRemoveConnectorMutation,
  useTestConnectionMutation,
  useUpsertCredentialsMutation,
} from "@/hooks/use-integrations";
import { Button } from "@/components/ui/button";
import type { ConnectorRow, ProviderCatalogItem } from "@/types/integrations";

function findConnectorForProvider(
  connectors: ConnectorRow[],
  providerId: string,
): ConnectorRow | undefined {
  const list = Array.isArray(connectors) ? connectors : [];
  return list.find((c) => c.provider_key === providerId);
}

export function IntegrationConnectionSetup() {
  const catalogQuery = useIntegrationCatalogQuery();
  const connectorsQuery = useConnectorsQuery();

  const createConnector = useCreateConnectorMutation();
  const upsertCreds = useUpsertCredentialsMutation();
  const testConnection = useTestConnectionMutation();
  const removeConnector = useRemoveConnectorMutation();

  const [oauthItem, setOauthItem] = useState<ProviderCatalogItem | null>(null);
  const [oauthConnectorId, setOauthConnectorId] = useState<string | null>(null);

  const [apiKeyItem, setApiKeyItem] = useState<ProviderCatalogItem | null>(null);
  const [apiKeyConnectorId, setApiKeyConnectorId] = useState<string | null>(null);
  const [apiKeySaved, setApiKeySaved] = useState(false);

  const [mappingItem, setMappingItem] = useState<ProviderCatalogItem | null>(null);
  const [mappingConnectorId, setMappingConnectorId] = useState<string | null>(null);

  const [syncConnector, setSyncConnector] = useState<ConnectorRow | null>(null);

  const catalog = Array.isArray(catalogQuery.data) ? catalogQuery.data : [];
  const connectors = Array.isArray(connectorsQuery.data) ? connectorsQuery.data : [];

  const isLoading = catalogQuery.isLoading || connectorsQuery.isLoading;

  const resetApiKeySession = useCallback(() => {
    setApiKeySaved(false);
    setApiKeyConnectorId(null);
    setApiKeyItem(null);
  }, []);

  const ensureConnectorId = useCallback(
    async (item: ProviderCatalogItem): Promise<string> => {
      const existing = findConnectorForProvider(connectors, item.id);
      if (existing?.id) return existing.id;
      const res = await createConnector.mutateAsync({
        providerKey: item.id,
        displayName: item.name,
      });
      const id = res?.connector?.id;
      if (!id) throw new Error("Could not create connector");
      return id;
    },
    [connectors, createConnector],
  );

  const openOAuth = (item: ProviderCatalogItem) => {
    const existing = findConnectorForProvider(connectors, item.id);
    setOauthConnectorId(existing?.id ?? null);
    setOauthItem(item);
  };

  const openApiKey = (item: ProviderCatalogItem) => {
    setApiKeyItem(item);
    setApiKeySaved(false);
    setApiKeyConnectorId(null);
    void ensureConnectorId(item)
      .then((id) => setApiKeyConnectorId(id))
      .catch((e: Error) => {
        toast.error(e.message);
        setApiKeyItem(null);
      });
  };

  const openMapping = (item: ProviderCatalogItem) => {
    const c = findConnectorForProvider(connectors, item.id);
    if (!c?.id) {
      toast.error("Connect this integration before mapping.");
      return;
    }
    setMappingConnectorId(c.id);
    setMappingItem(item);
  };

  const openSync = (item: ProviderCatalogItem) => {
    const c = findConnectorForProvider(connectors, item.id);
    if (!c) {
      toast.error("Connect this integration before syncing.");
      return;
    }
    setSyncConnector(c);
  };

  const onOAuthComplete = (values: { client_id: string; client_secret: string }) => {
    if (!oauthItem) return;
    const finish = (connectorId: string) => {
      upsertCreds.mutate(
        {
          connectorId,
          credentials: { client_id: values.client_id, client_secret: values.client_secret },
          metadata: { flow: "oauth_onboarding" },
        },
        {
          onSuccess: () => {
            toast.success("OAuth credentials secured");
            setOauthItem(null);
            setOauthConnectorId(null);
          },
          onError: (e) => toast.error(e.message),
        },
      );
    };

    if (oauthConnectorId) {
      finish(oauthConnectorId);
      return;
    }
    createConnector.mutate(
      { providerKey: oauthItem.id, displayName: oauthItem.name },
      {
        onSuccess: (res) => {
          const id = res?.connector?.id;
          if (!id) {
            toast.error("Connector id missing");
            return;
          }
          finish(id);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const onApiKeySave = (values: { api_key: string }) => {
    if (!apiKeyConnectorId) {
      toast.error("Connector not ready");
      return;
    }
    upsertCreds.mutate(
      {
        connectorId: apiKeyConnectorId,
        credentials: { api_key: values.api_key },
        metadata: { flow: "api_key_onboarding" },
      },
      {
        onSuccess: () => {
          toast.success("API key stored securely");
          setApiKeySaved(true);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const onApiKeyTest = () => {
    if (!apiKeyConnectorId) return;
    testConnection.mutate(apiKeyConnectorId, {
      onSuccess: (res) => {
        if (res.ok) toast.success("Connection test passed");
        else
          toast.error(res.message ?? "Test failed", {
            description: res.remediation,
          });
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const oauthSubmitting =
    Boolean(oauthItem) && (createConnector.isPending || upsertCreds.isPending);

  const sortedCatalog = useMemo(() => {
    const c = Array.isArray(catalog) ? catalog : [];
    return [...c].sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog]);

  return (
    <div className="space-y-8">
      <IntegrationOnboardingBreadcrumbs currentIndex={1} />

      <ConnectionStatusBanner variant="info">
        <span className="font-medium text-foreground">Tenant-scoped catalog</span> — OAuth and API
        keys are processed only inside Edge Functions. Sync logs exclude secret material.
      </ConnectionStatusBanner>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 rounded-2xl bg-surface-inner" />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {sortedCatalog.map((item) => {
            const connector = findConnectorForProvider(connectors, item.id);
            return (
              <div key={item.id} className="flex flex-col gap-2">
                <IntegrationCatalogCard
                  item={item}
                  connector={connector}
                  onConnectOAuth={() => openOAuth(item)}
                  onConnectApiKey={() => openApiKey(item)}
                  onConfigureMapping={() => openMapping(item)}
                  onManageSync={() => openSync(item)}
                />
                {connector?.id ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-destructive"
                    disabled={removeConnector.isPending}
                    onClick={() => {
                      if (!window.confirm(`Disconnect ${item.name}? This removes credentials.`)) {
                        return;
                      }
                      removeConnector.mutate(connector.id, {
                        onSuccess: () => toast.success("Integration removed"),
                        onError: (e) => toast.error(e.message),
                      });
                    }}
                  >
                    Disconnect
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <OAuthConnectModal
        open={Boolean(oauthItem)}
        onOpenChange={(o) => {
          if (!o) {
            setOauthItem(null);
            setOauthConnectorId(null);
          }
        }}
        provider={oauthItem}
        isSubmitting={oauthSubmitting}
        onComplete={onOAuthComplete}
      />

      <ApiKeyConnectModal
        open={Boolean(apiKeyItem)}
        onOpenChange={(o) => {
          if (!o) resetApiKeySession();
        }}
        provider={apiKeyItem}
        connectorId={apiKeyConnectorId}
        isSubmitting={upsertCreds.isPending}
        isTesting={testConnection.isPending}
        canTestConnection={apiKeySaved}
        onTestConnection={onApiKeyTest}
        onSave={onApiKeySave}
      />

      <MappingWizard
        open={Boolean(mappingItem && mappingConnectorId)}
        onOpenChange={(o) => {
          if (!o) {
            setMappingItem(null);
            setMappingConnectorId(null);
          }
        }}
        catalogItem={mappingItem}
        connectorId={mappingConnectorId}
      />

      <Dialog open={Boolean(syncConnector)} onOpenChange={(o) => !o && setSyncConnector(null)}>
        <DialogContent className="border-border/80 bg-card sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Sync &amp; schedule</DialogTitle>
            <DialogDescription>
              Manual sync uses idempotent keys. Adjust cadence for background pulls (stub).
            </DialogDescription>
          </DialogHeader>
          <SyncControlPanel integration={syncConnector} onClose={() => setSyncConnector(null)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
