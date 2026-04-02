import { AlertTriangle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { UnifiedEntity } from "@/types/unified";
import { payloadTitle, payloadString } from "@/types/unified";

export type AlertPanelProps = {
  alerts: UnifiedEntity[];
  isLoading?: boolean;
};

export function AlertPanel({ alerts, isLoading }: AlertPanelProps) {
  const list = Array.isArray(alerts) ? alerts : [];

  return (
    <Card className="border-border/80 bg-card/90 shadow-card">
      <CardHeader className="flex flex-row items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden />
        <CardTitle className="text-base">Alerts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading alerts">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No open alerts. Risk signals from integrations appear here.
          </p>
        ) : (
          <ul className="space-y-2">
            {list.map((a) => {
              const msg =
                payloadString(a.payload, "message") ?? payloadTitle(a.payload);
              const severity = payloadString(a.payload, "severity") ?? "info";
              return (
                <li
                  key={a.id}
                  className="rounded-lg border border-border/60 bg-surface-inner/80 p-3 text-sm"
                >
                  <p className="font-medium text-foreground">{msg}</p>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {severity}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
