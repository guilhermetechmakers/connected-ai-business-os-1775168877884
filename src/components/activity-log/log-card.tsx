import { format, parseISO } from "date-fns";
import { ChevronDown } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ActivityLogEntry } from "@/types/activity-log";
import { cn } from "@/lib/utils";

type LogCardProps = {
  entry: ActivityLogEntry;
  displayPayload: Record<string, unknown>;
};

const EVENT_ICONS: Record<string, string> = {
  user_action: "UA",
  workflow_run: "WR",
  workflow_event: "WE",
  integration_sync: "IS",
  "connector.sync": "CS",
  ai_action: "AI",
  system_alert: "AL",
  system_change: "SC",
  admin_action: "AD",
};

function eventBadgeLabel(eventType: string): string {
  return EVENT_ICONS[eventType] ?? eventType.slice(0, 2).toUpperCase();
}

export function LogCard({ entry, displayPayload }: LogCardProps) {
  const created = (() => {
    try {
      return format(parseISO(entry.created_at), "PPpp");
    } catch {
      return entry.created_at;
    }
  })();

  return (
    <Collapsible className="group rounded-xl border border-border/70 bg-surface-inner/60 shadow-sm transition-all duration-150 hover:-translate-y-1 hover:border-primary/25 hover:shadow-card motion-reduce:transform-none">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-[10px] font-bold text-primary"
            aria-hidden
          >
            {eventBadgeLabel(entry.event_type)}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-mono text-muted-foreground">{created}</p>
            <p className="mt-1 truncate text-sm font-semibold text-primary">
              {entry.event_type}
            </p>
            <p className="text-xs text-muted-foreground">
              Actor:{" "}
              <span className="font-mono text-foreground/90">
                {entry.actor_user_id ?? "system"}
              </span>
            </p>
          </div>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border/60 px-4 pb-4 pt-2">
        <dl className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
          <div>
            <dt className="font-semibold text-foreground">Related</dt>
            <dd className="font-mono">
              {entry.related_entity ?? "—"} · {entry.related_id ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Department</dt>
            <dd className="font-mono">{entry.department_id ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Workflow run</dt>
            <dd className="font-mono">{entry.workflow_run_id ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Connector</dt>
            <dd className="font-mono">{entry.connector_id ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Integration</dt>
            <dd className="font-mono">{entry.integration_id ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">AI action</dt>
            <dd className="font-mono">{entry.ai_action_id ?? "—"}</dd>
          </div>
        </dl>
        <pre
          className={cn(
            "mt-3 max-h-52 overflow-auto rounded-lg border border-border/60 bg-background/60 p-3 font-mono text-[11px] text-muted-foreground",
          )}
        >
          {JSON.stringify(displayPayload ?? {}, null, 2)}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}
