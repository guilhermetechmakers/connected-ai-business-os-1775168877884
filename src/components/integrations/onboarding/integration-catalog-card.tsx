import {
  CalendarDays,
  Cloud,
  Mail,
  FileText,
  Landmark,
  MessageSquare,
  Plug,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
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

import {
  IntegrationHealthBadge,
  connectorRowToHealthStatus,
} from "@/components/integrations/onboarding/integration-health-badge";

function ProviderIcon({ providerId }: { providerId: string }) {
  const cls = "h-8 w-8 shrink-0 text-primary";
  switch (providerId) {
    case "slack":
      return <MessageSquare className={cls} aria-hidden />;
    case "google_drive":
      return <FileText className={cls} aria-hidden />;
    case "gmail":
      return <Mail className={cls} aria-hidden />;
    case "google_calendar":
      return <CalendarDays className={cls} aria-hidden />;
    case "hubspot":
      return <Cloud className={cls} aria-hidden />;
    case "quickbooks":
      return <Landmark className={cls} aria-hidden />;
    default:
      return <Plug className={cls} aria-hidden />;
  }
}

export interface IntegrationCatalogCardProps {
  item: ProviderCatalogItem;
  connector?: ConnectorRow;
  onConnectOAuth: () => void;
  onConnectApiKey: () => void;
  onConfigureMapping: () => void;
  onManageSync: () => void;
  linkedAuthActive?: boolean;
}

export function IntegrationCatalogCard({
  item,
  connector,
  onConnectOAuth,
  onConnectApiKey,
  onConfigureMapping,
  onManageSync,
  linkedAuthActive = false,
}: IntegrationCatalogCardProps) {
  const health = connector
    ? connectorRowToHealthStatus(connector)
    : "not_connected";

  const capabilityBadges = (
    <div className="flex flex-wrap gap-1">
      {item.supportsOAuth ? (
        <Badge variant="outline" className="border-primary/35 text-[10px] uppercase">
          OAuth
        </Badge>
      ) : null}
      {item.supportsApiKey ? (
        <Badge variant="outline" className="border-secondary/40 text-[10px] uppercase">
          API key
        </Badge>
      ) : null}
    </div>
  );

  const hasConnector = Boolean(connector?.id);

  return (
    <Card
      className={cn(
        "border-border/80 bg-card/90 shadow-card transition-all duration-150",
        "hover:-translate-y-1 hover:border-primary/35 hover:shadow-card-hover motion-reduce:transform-none",
      )}
    >
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-border/60 bg-surface-inner p-2">
              <ProviderIcon providerId={item.id} />
            </div>
            <div>
              <CardTitle className="font-display text-lg text-foreground">{item.name}</CardTitle>
              <CardDescription className="mt-1 text-sm leading-relaxed">
                {item.description}
              </CardDescription>
            </div>
          </div>
          <IntegrationHealthBadge
            status={health}
            lastError={connector?.last_error_message}
            lastRemediation={connector?.last_error_remediation}
            lastSync={connector?.last_sync_at}
          />
        </div>
        {capabilityBadges}
        {item.linkedGroup === "google_workspace" ? (
          <Badge
            variant="outline"
            className={cn(
              "w-fit border-primary/25 text-[10px] uppercase",
              linkedAuthActive && "border-success/30 text-success",
            )}
          >
            {linkedAuthActive ? "Linked Google auth active" : "Linked Google auth"}
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {connector?.last_error_message && health === "error" ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-xs text-foreground"
          >
            <p className="font-medium">Action required</p>
            <p className="mt-1 text-muted-foreground">{connector.last_error_message}</p>
            {connector.last_error_remediation ? (
              <p className="mt-2 text-primary">{connector.last_error_remediation}</p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
      <CardFooter className="flex flex-col gap-2 border-t border-border/60 sm:flex-row sm:flex-wrap">
        {!hasConnector ? (
          <>
            {item.supportsOAuth ? (
              <Button
                type="button"
                variant="cta"
                className="w-full sm:w-auto"
                onClick={onConnectOAuth}
              >
                Connect (OAuth)
              </Button>
            ) : null}
            {item.supportsApiKey ? (
              <Button
                type="button"
                variant={item.supportsOAuth ? "outline" : "cta"}
                className="w-full border-primary/30 sm:w-auto"
                onClick={onConnectApiKey}
              >
                Connect (API key)
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={onConfigureMapping}
            >
              Mapping wizard
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full border-primary/30 sm:w-auto"
              onClick={onManageSync}
            >
              Sync & schedule
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
