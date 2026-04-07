import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

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
} from "@/hooks/use-integrations";
import { Button } from "@/components/ui/button";
import { integrationsManagerApi } from "@/lib/integrations-manager-api";
import type { ConnectorRow, IntegrationProviderKey, ProviderCatalogItem } from "@/types/integrations";

const GOOGLE_KEYS: IntegrationProviderKey[] = ["google_drive", "gmail", "google_calendar"];

function findConnectorForProvider(
  connectors: ConnectorRow[],
  providerId: IntegrationProviderKey,
): ConnectorRow | undefined {
  const list = Array.isArray(connectors) ? connectors : [];
  return list.find((c) => c.provider_key === providerId);
}

function withClearedOAuthParams(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete("code");
  next.delete("state");
  next.delete("error");
  next.delete("error_description");
  return next;
}

export interface IntegrationConnectionSetupProps {
  showBreadcrumbs?: boolean;
}

export function IntegrationConnectionSetup({ showBreadcrumbs = true }: IntegrationConnectionSetupProps) {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const catalogQuery = useIntegrationCatalogQuery();
  const connectorsQuery = useConnectorsQuery();

  const createConnector = useCreateConnectorMutation();
  const removeConnector = useRemoveConnectorMutation();

  const [oauthItem, setOauthItem] = useState<ProviderCatalogItem | null>(null);
  const [oauthConnectorId, setOauthConnectorId] = useState<string | null>(null);
  const [oauthStartingFor, setOauthStartingFor] = useState<IntegrationProviderKey | null>(null);

  const [mappingItem, setMappingItem] = useState<ProviderCatalogItem | null>(null);
  const [mappingConnectorId, setMappingConnectorId] = useState<string | null>(null);

  const [syncConnector, setSyncConnector] = useState<ConnectorRow | null>(null);

  const callbackHandledRef = useRef<string>("");

  const catalog = Array.isArray(catalogQuery.data) ? catalogQuery.data : [];
  const connectors = Array.isArray(connectorsQuery.data) ? connectorsQuery.data : [];

  const isLoading = catalogQuery.isLoading || connectorsQuery.isLoading;

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

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const oauthError = searchParams.get("error");
    const oauthErrorDescription = searchParams.get("error_description");

    const key = `${code ?? ""}:${state ?? ""}:${oauthError ?? ""}`;
    if (!key || callbackHandledRef.current === key) return;

    if (oauthError) {
      callbackHandledRef.current = key;
      toast.error("OAuth connection was cancelled or denied", {
        description: oauthErrorDescription ?? oauthError,
      });
      setSearchParams(withClearedOAuthParams(searchParams), { replace: true });
      return;
    }

    if (!code || !state) return;

    callbackHandledRef.current = key;
    void (async () => {
      try {
        const result = await integrationsManagerApi.completeOAuthCallback({ code, state });
        toast.success("Integration connected", {
          description: `OAuth completed for ${result.providerKey}.`,
        });
        setOauthItem(null);
        setOauthConnectorId(null);
        await Promise.all([
          qc.invalidateQueries({ queryKey: ["integrations", "connectors"] }),
          qc.invalidateQueries({ queryKey: ["integrations", "health"] }),
          qc.invalidateQueries({ queryKey: ["integrations", "catalog"] }),
        ]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "OAuth callback failed");
      } finally {
        setSearchParams(withClearedOAuthParams(searchParams), { replace: true });
      }
    })();
  }, [qc, searchParams, setSearchParams]);

  const openOAuth = (item: ProviderCatalogItem) => {
    const existing = findConnectorForProvider(connectors, item.id);
    setOauthConnectorId(existing?.id ?? null);
    setOauthItem(item);
  };

  const openApiKey = (item: ProviderCatalogItem) => {
    toast.info(`${item.name} uses OAuth in v1.`, {
      description: "Use the OAuth connect flow for this provider.",
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

  const onOAuthContinue = async () => {
    if (!oauthItem) return;
    setOauthStartingFor(oauthItem.id);
    try {
      const connectorId = oauthConnectorId ?? (await ensureConnectorId(oauthItem));
      const started = await integrationsManagerApi.startOAuth({
        providerKey: oauthItem.id,
        connectorId,
      });
      window.location.assign(started.authUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to start OAuth");
      setOauthStartingFor(null);
    }
  };

  const sortedCatalog = useMemo(() => {
    const c = Array.isArray(catalog) ? catalog : [];
    return [...c].sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog]);

  const googleLinkedAuthActive = useMemo(() => {
    return connectors.some((c) => {
      if (!GOOGLE_KEYS.includes(c.provider_key as IntegrationProviderKey)) return false;
      const status = String(c.status ?? "").toLowerCase();
      return status === "connected" || status === "healthy";
    });
  }, [connectors]);

  return (
    <div className="space-y-8">
      {showBreadcrumbs ? <IntegrationOnboardingBreadcrumbs currentIndex={1} /> : null}

      <ConnectionStatusBanner variant="info">
        <span className="font-medium text-foreground">Tenant-scoped catalog</span> - OAuth flows are
        platform-managed through Edge Functions. Sync logs and activity payloads are redacted.
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
                  linkedAuthActive={item.linkedGroup === "google_workspace" ? googleLinkedAuthActive : false}
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
        isSubmitting={oauthItem ? oauthStartingFor === oauthItem.id : false}
        onContinue={() => {
          void onOAuthContinue();
        }}
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
              Trigger a full sync now or tune recurring sync cadence for this connector.
            </DialogDescription>
          </DialogHeader>
          <SyncControlPanel integration={syncConnector} onClose={() => setSyncConnector(null)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

