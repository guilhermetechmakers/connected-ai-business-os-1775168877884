import { GitBranch, Link2, Trash2, Unplug } from "lucide-react";

import { IntegrationHealthBadge } from "@/components/integrations-setup/integration-health-badge";
import { SyncControlPanel } from "@/components/integrations-setup/sync-control-panel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ConnectorRow, ProviderCatalogItem } from "@/types/integrations";
import { cn } from "@/lib/utils";

export type IntegrationCatalogCardProps = {
  item: ProviderCatalogItem;
  connector: ConnectorRow | null;
  onConnectOAuth: () => void;
  onConnectApiKey: () => void;
  onOpenMapping: (connectorId: string) => void;
  onRemove: (connectorId: string) => void;
  isBusy?: boolean;
};

export function IntegrationCatalogCard({
  item,
  connector,
  onConnectOAuth,
  onConnectApiKey,
  onOpenMapping,
  onRemove,
  isBusy = false,
}: IntegrationCatalogCardProps) {
  const id = typeof item.id === "string" ? item.id : "";
  const name = typeof item.name === "string" ? item.name : id;
  const desc =
    typeof item.description === "string" ? item.description : "";
  const oauth = Boolean(item.supportsOAuth);
  const apiKey = Boolean(item.supportsApiKey);

  const hasConnector = Boolean(connector?.id);
  const errMsg = connector?.last_error_message ?? null;
  const remediation = connector?.last_error_remediation ?? null;

  return (
    <Card
      className={cn(
        "border-border/70 bg-card/90 shadow-card transition-all duration-150",
        "hover:-translate-y-1 hover:border-primary/35 hover:shadow-card-hover",
      )}
    >
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="font-display text-lg text-foreground">
              {name}
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              {desc}
            </CardDescription>
          </div>
          <IntegrationHealthBadge
            status={connector?.status ?? "disconnected"}
            lastError={errMsg}
            lastSync={connector?.last_sync_at ?? null}
            remediation={remediation}
          />
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
          {oauth ? (
            <span className="rounded-full border border-primary/30 px-2 py-0.5 text-primary">
              OAuth
            </span>
          ) : null}
          {apiKey ? (
            <span className="rounded-full border border-border/50 px-2 py-0.5">
              API key
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {errMsg ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-foreground"
          >
            <p className="font-medium text-destructive">Action required</p>
            <p className="text-muted-foreground">{errMsg}</p>
            {remediation ? (
              <p className="mt-1 text-xs text-primary">{remediation}</p>
            ) : null}
          </div>
        ) : null}

        {!hasConnector ? (
          <div className="flex flex-wrap gap-2">
            {oauth ? (
              <Button
                type="button"
                variant="cta"
                size="sm"
                className="transition-transform duration-150 hover:scale-[1.02]"
                disabled={isBusy}
                onClick={onConnectOAuth}
              >
                <Link2 className="mr-2 h-4 w-4" aria-hidden />
                Connect
              </Button>
            ) : null}
            {apiKey && !oauth ? (
              <Button
                type="button"
                variant="cta"
                size="sm"
                disabled={isBusy}
                onClick={onConnectApiKey}
              >
                <Link2 className="mr-2 h-4 w-4" aria-hidden />
                Connect
              </Button>
            ) : null}
            {apiKey && oauth ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-primary/35"
                disabled={isBusy}
                onClick={onConnectApiKey}
              >
                <Unplug className="mr-2 h-4 w-4" aria-hidden />
                API key instead
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  connector?.id && onOpenMapping(connector.id)
                }
              >
                <GitBranch className="mr-2 h-4 w-4" aria-hidden />
                Map fields
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={isBusy || !connector?.id}
                onClick={() => connector?.id && onRemove(connector.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                Remove
              </Button>
            </div>
            {connector?.id ? (
              <SyncControlPanel
                connectorId={connector.id}
                currentIntervalMinutes={connector.sync_interval_minutes ?? 360}
              />
            ) : null}
          </div>
        )}
      </CardContent>
      <CardFooter className="border-t border-border/50 text-xs text-muted-foreground">
        Provider ID: <span className="font-mono text-foreground">{id}</span>
      </CardFooter>
    </Card>
  );
}
