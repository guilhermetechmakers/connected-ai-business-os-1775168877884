import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, LayoutGrid } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { ApiKeyConnectModal } from "@/components/integrations-setup/api-key-connect-modal";
import { CompanySetupOnboardingPanel } from "@/components/integrations-setup/company-setup-onboarding-panel";
import { IntegrationCatalogCard } from "@/components/integrations-setup/integration-catalog-card";
import { MappingWizardDialog } from "@/components/integrations-setup/mapping-wizard-dialog";
import { OAuthConnectModal } from "@/components/integrations-setup/oauth-connect-modal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import {
  useConnectorsQuery,
  useCreateConnectorMutation,
  useIntegrationCatalogQuery,
  useRemoveConnectorMutation,
  useUpsertCredentialsMutation,
} from "@/hooks/use-integrations";
import { integrationsManagerApi } from "@/lib/integrations-manager-api";
import type { ConnectorRow, ProviderCatalogItem } from "@/types/integrations";

const SUGGESTIONS_QK = ["integrations", "company-setup-suggestions"] as const;

function mergeCatalog(
  catalog: ProviderCatalogItem[],
  connectors: ConnectorRow[],
): { item: ProviderCatalogItem; connector: ConnectorRow | null }[] {
  const c = Array.isArray(catalog) ? catalog : [];
  const n = Array.isArray(connectors) ? connectors : [];
  return c.map((item) => ({
    item,
    connector: n.find((x) => x.provider_key === item.id) ?? null,
  }));
}

export function IntegrationConnectionSetup() {
  const qc = useQueryClient();
  const { tenant } = useAuth();
  const catalogQuery = useIntegrationCatalogQuery();
  const connectorsQuery = useConnectorsQuery();
  const createConnector = useCreateConnectorMutation();
  const upsertCreds = useUpsertCredentialsMutation();
  const removeConnector = useRemoveConnectorMutation();

  const suggestionsQuery = useQuery({
    queryKey: SUGGESTIONS_QK,
    queryFn: () => integrationsManagerApi.fetchCompanySetupSuggestions(),
  });

  const [oauthOpen, setOauthOpen] = useState(false);
  const [apiKeyOpen, setApiKeyOpen] = useState(false);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [activeCatalog, setActiveCatalog] = useState<ProviderCatalogItem | null>(
    null,
  );
  const [activeConnectorId, setActiveConnectorId] = useState<string | null>(
    null,
  );
  const [applyingSuggestions, setApplyingSuggestions] = useState(false);

  const merged = useMemo(
    () =>
      mergeCatalog(
        Array.isArray(catalogQuery.data) ? catalogQuery.data : [],
        Array.isArray(connectorsQuery.data) ? connectorsQuery.data : [],
      ),
    [catalogQuery.data, connectorsQuery.data],
  );

  const ensureConnector = async (
    providerKey: string,
    displayName?: string,
  ): Promise<string | null> => {
    const existing = (connectorsQuery.data ?? []).find(
      (x) => x.provider_key === providerKey,
    );
    if (existing?.id) return existing.id;
    try {
      const res = await createConnector.mutateAsync({
        providerKey,
        displayName,
      });
      const id = res.connector?.id ?? null;
      if (!id) {
        toast.error("Could not create connector");
        return null;
      }
      return id;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Create failed";
      toast.error(msg);
      return null;
    }
  };

  const openOAuth = async (item: ProviderCatalogItem) => {
    setActiveCatalog(item);
    const id = await ensureConnector(item.id, item.name);
    if (!id) return;
    setActiveConnectorId(id);
    setOauthOpen(true);
  };

  const openApiKey = async (item: ProviderCatalogItem) => {
    setActiveCatalog(item);
    const id = await ensureConnector(item.id, item.name);
    if (!id) return;
    setActiveConnectorId(id);
    setApiKeyOpen(true);
  };

  const handleOAuthComplete = (payload: {
    client_id?: string;
    client_secret?: string;
    authorization_code: string;
  }) => {
    if (!activeConnectorId) return;
    const creds: Record<string, unknown> = {
      authorization_code: payload.authorization_code,
    };
    if (payload.client_id) creds.client_id = payload.client_id;
    if (payload.client_secret) creds.client_secret = payload.client_secret;

    upsertCreds.mutate(
      {
        connectorId: activeConnectorId,
        credentials: creds,
        metadata: { flow: "oauth_simulated" },
      },
      {
        onSuccess: () => {
          toast.success("OAuth flow stored");
          setOauthOpen(false);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const busy =
    createConnector.isPending ||
    upsertCreds.isPending ||
    removeConnector.isPending;

  return (
    <div className="space-y-10">
      <nav aria-label="Onboarding progress" className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          to="/onboarding/company"
          className="text-muted-foreground transition-colors hover:text-primary"
        >
          Company setup
        </Link>
        <ChevronRight className="h-4 w-4 text-border" aria-hidden />
        <span className="font-medium text-foreground">
          Integrations connection
        </span>
        <ChevronRight className="h-4 w-4 text-border" aria-hidden />
        <Link
          to="/dashboard/global"
          className="text-muted-foreground transition-colors hover:text-primary"
        >
          Workspace
        </Link>
      </nav>

      <CompanySetupOnboardingPanel
        company={tenant}
        suggestedIntegrations={
          Array.isArray(suggestionsQuery.data) ? suggestionsQuery.data : []
        }
        isLoadingSuggestions={suggestionsQuery.isLoading}
        isApplying={applyingSuggestions}
        onApplySuggestions={() => {
          void (async () => {
            const items = Array.isArray(suggestionsQuery.data)
              ? suggestionsQuery.data
              : [];
            const conns = Array.isArray(connectorsQuery.data)
              ? connectorsQuery.data
              : [];
            if (items.length === 0) return;
            setApplyingSuggestions(true);
            try {
              for (const s of items) {
                if (conns.some((c) => c.provider_key === s.provider)) continue;
                await integrationsManagerApi.createOrUpdateIntegration({
                  providerKey: s.provider,
                  displayName: s.label,
                });
              }
              toast.success("Connectors added", {
                description: "Authorize each integration below.",
              });
              void qc.invalidateQueries({ queryKey: ["integrations", "connectors"] });
              void qc.invalidateQueries({ queryKey: ["integrations", "health"] });
            } catch (e) {
              const msg = e instanceof Error ? e.message : "Quick-add failed";
              toast.error(msg);
            } finally {
              setApplyingSuggestions(false);
            }
          })();
        }}
      />

      <section aria-labelledby="catalog-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              Integration catalog
            </p>
            <h2
              id="catalog-heading"
              className="font-display text-2xl font-bold text-foreground md:text-3xl"
            >
              Connect your <span className="text-primary">stack</span>
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              OAuth and API keys are encrypted by Edge Functions. Map fields before
              running high-volume sync jobs.
            </p>
          </div>
          <Button variant="outline" className="border-primary/35" asChild>
            <Link to="/dashboard/settings/integrations">
              <LayoutGrid className="mr-2 h-4 w-4" aria-hidden />
              Settings hub
            </Link>
          </Button>
        </div>

        {catalogQuery.isLoading || connectorsQuery.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-64 rounded-2xl bg-surface-inner" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {merged.map(({ item, connector }) => (
              <IntegrationCatalogCard
                key={item.id}
                item={item}
                connector={connector}
                isBusy={busy}
                onConnectOAuth={() => void openOAuth(item)}
                onConnectApiKey={() => void openApiKey(item)}
                onOpenMapping={(id) => {
                  setActiveConnectorId(id);
                  setActiveCatalog(item);
                  setMappingOpen(true);
                }}
                onRemove={(id) => {
                  removeConnector.mutate(id, {
                    onSuccess: () => toast.success("Integration removed"),
                    onError: (e) => toast.error(e.message),
                  });
                }}
              />
            ))}
          </div>
        )}
      </section>

      <OAuthConnectModal
        open={oauthOpen}
        onOpenChange={setOauthOpen}
        providerName={activeCatalog?.name ?? "Provider"}
        isSubmitting={upsertCreds.isPending}
        onComplete={handleOAuthComplete}
      />

      <ApiKeyConnectModal
        open={apiKeyOpen}
        onOpenChange={setApiKeyOpen}
        providerName={activeCatalog?.name ?? "Provider"}
        isSaving={upsertCreds.isPending}
        onTest={async (apiKey) => {
          if (!activeConnectorId) return { ok: false, message: "No connector" };
          try {
            await upsertCreds.mutateAsync({
              connectorId: activeConnectorId,
              credentials: { api_key: apiKey },
              metadata: { flow: "api_key_test" },
            });
          } catch {
            return { ok: false, message: "Could not store key for test" };
          }
          return integrationsManagerApi.testConnection(activeConnectorId);
        }}
        onSave={(apiKey) => {
          if (!activeConnectorId) return;
          upsertCreds.mutate(
            {
              connectorId: activeConnectorId,
              credentials: { api_key: apiKey },
              metadata: { flow: "api_key" },
            },
            {
              onSuccess: () => {
                toast.success("API key secured");
                setApiKeyOpen(false);
              },
              onError: (e) => toast.error(e.message),
            },
          );
        }}
      />

      {activeConnectorId && activeCatalog ? (
        <MappingWizardDialog
          open={mappingOpen}
          onOpenChange={setMappingOpen}
          connectorId={activeConnectorId}
          providerKey={activeCatalog.id}
          onSaved={() => {
            void qc.invalidateQueries({ queryKey: ["integrations", "connectors"] });
          }}
        />
      ) : null}
    </div>
  );
}
