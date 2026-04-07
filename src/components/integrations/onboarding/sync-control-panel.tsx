import { formatDistanceToNow } from "date-fns";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useConnectorSyncsQuery,
  useTriggerSyncMutation,
  useUpdateConnectorMutation,
} from "@/hooks/use-integrations";
import type { ConnectorRow } from "@/types/integrations";

const SCHEDULE_OPTIONS: { label: string; minutes: number }[] = [
  { label: "Every 15 minutes", minutes: 15 },
  { label: "Hourly", minutes: 60 },
  { label: "Every 6 hours", minutes: 360 },
  { label: "Daily", minutes: 1440 },
];

export interface SyncControlPanelProps {
  integration: ConnectorRow | null;
  onClose?: () => void;
}

function safeStartedAt(run: { started_at?: string } | null | undefined): string {
  if (!run?.started_at) return "—";
  try {
    return formatDistanceToNow(new Date(run.started_at), { addSuffix: true });
  } catch {
    return "—";
  }
}

export function SyncControlPanel({ integration, onClose }: SyncControlPanelProps) {
  const connectorId = integration?.id;
  const syncsQuery = useConnectorSyncsQuery(connectorId);
  const triggerSync = useTriggerSyncMutation();
  const updateConnector = useUpdateConnectorMutation();

  const runs = Array.isArray(syncsQuery.data) ? syncsQuery.data : [];
  const lastRun = runs[0];

  const onSyncNow = () => {
    if (!connectorId) return;
    triggerSync.mutate(
      {
        connectorId,
        idempotencyKey: `manual-${connectorId}-${Date.now()}`,
      },
      {
        onSuccess: () => toast.success("Sync completed"),
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const onScheduleChange = (minutesStr: string) => {
    if (!connectorId) return;
    const minutes = Number(minutesStr);
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    updateConnector.mutate(
      { connectorId, syncIntervalMinutes: minutes },
      {
        onSuccess: () => toast.success("Sync schedule updated"),
        onError: (e) => toast.error(e.message),
      },
    );
  };

  if (!integration || !connectorId) {
    return (
      <p className="text-sm text-muted-foreground">Select a connected integration to manage sync.</p>
    );
  }

  const currentInterval = integration.sync_interval_minutes ?? 360;

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-surface-inner/40 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Manual sync</p>
          <p className="text-sm text-muted-foreground">
            Last run: {lastRun ? `${lastRun.status} · ${safeStartedAt(lastRun)}` : "No runs yet"}
          </p>
        </div>
        <Button
          type="button"
          variant="cta"
          disabled={triggerSync.isPending}
          onClick={onSyncNow}
          className="shrink-0"
        >
          {triggerSync.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
          )}
          Sync now
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Schedule</p>
        <Select
          key={connectorId}
          defaultValue={String(currentInterval)}
          onValueChange={onScheduleChange}
          disabled={updateConnector.isPending}
        >
          <SelectTrigger
            className="max-w-md bg-surface-inner"
            aria-label="Sync recurrence"
          >
            <SelectValue placeholder="Select frequency" />
          </SelectTrigger>
          <SelectContent>
            {SCHEDULE_OPTIONS.map((o) => (
              <SelectItem key={o.minutes} value={String(o.minutes)}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Automated runs respect connector health and tenant rate limits.
        </p>
      </div>

      {onClose ? (
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      ) : null}
    </div>
  );
}
