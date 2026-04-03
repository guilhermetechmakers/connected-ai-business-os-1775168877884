import { formatDistanceToNow } from "date-fns";
import { Clock, Loader2, RefreshCw } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";

const SCHEDULE_OPTIONS: { label: string; minutes: number }[] = [
  { label: "Every 15 minutes", minutes: 15 },
  { label: "Hourly", minutes: 60 },
  { label: "Every 6 hours", minutes: 360 },
  { label: "Daily", minutes: 1440 },
];

export type SyncControlPanelProps = {
  connectorId: string;
  currentIntervalMinutes: number;
  className?: string;
};

export function SyncControlPanel({
  connectorId,
  currentIntervalMinutes,
  className,
}: SyncControlPanelProps) {
  const scheduleOptions = useMemo(() => {
    const base = [...SCHEDULE_OPTIONS];
    if (!base.some((o) => o.minutes === currentIntervalMinutes)) {
      base.push({
        label: `Every ${currentIntervalMinutes} minutes`,
        minutes: currentIntervalMinutes,
      });
    }
    return [...base].sort((a, b) => a.minutes - b.minutes);
  }, [currentIntervalMinutes]);

  const syncs = useConnectorSyncsQuery(connectorId);
  const trigger = useTriggerSyncMutation();
  const update = useUpdateConnectorMutation();

  const runs = Array.isArray(syncs.data) ? syncs.data : [];
  const last = runs[0];
  const lastLabel = last?.ended_at
    ? formatDistanceToNow(new Date(last.ended_at), { addSuffix: true })
    : last?.started_at
      ? `Started ${formatDistanceToNow(new Date(last.started_at), { addSuffix: true })}`
      : "No runs yet";

  const rows =
    typeof last?.result_summary === "object" && last.result_summary !== null
      ? (last.result_summary as { recordsProcessed?: number }).recordsProcessed
      : undefined;

  return (
    <div
      className={cn(
        "space-y-4 rounded-xl border border-border/50 bg-surface-inner/40 p-4",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Sync
          </p>
          <p className="text-sm text-muted-foreground">
            <Clock className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            Last: {lastLabel}
            {typeof rows === "number" ? ` · ${rows} rows (stub)` : ""}
          </p>
        </div>
        <Button
          type="button"
          variant="cta"
          size="sm"
          className="transition-transform duration-150 hover:scale-[1.02]"
          disabled={trigger.isPending}
          onClick={() =>
            trigger.mutate({
              connectorId,
              idempotencyKey: `manual-${connectorId}-${Date.now()}`,
            })
          }
        >
          {trigger.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
          )}
          Sync now
        </Button>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`schedule-${connectorId}`}>Scheduled frequency</Label>
        <Select
          value={String(currentIntervalMinutes)}
          onValueChange={(v) => {
            const minutes = Number(v);
            if (!Number.isFinite(minutes)) return;
            update.mutate({ connectorId, syncIntervalMinutes: minutes });
          }}
        >
          <SelectTrigger
            id={`schedule-${connectorId}`}
            className="bg-background/80"
            aria-label="Sync schedule"
          >
            <SelectValue placeholder="Select interval" />
          </SelectTrigger>
          <SelectContent>
            {scheduleOptions.map((o) => (
              <SelectItem key={o.minutes} value={String(o.minutes)}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {update.isPending ? (
          <p className="text-xs text-muted-foreground">Updating schedule…</p>
        ) : null}
      </div>
    </div>
  );
}
