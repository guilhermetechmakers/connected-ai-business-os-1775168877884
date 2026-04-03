import { Filter, ListChecks } from "lucide-react";

import { ACTIVITY_EVENT_TYPE_OPTIONS } from "@/types/activity-log";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ActivityLogFilterValues = {
  eventTypes: string[];
  actorUserId: string;
  departmentId: string;
  workflowRunId: string;
  connectorId: string;
  integrationId: string;
  aiActionId: string;
  from: string;
  to: string;
  search: string;
};

type ActivityLogFilterBarProps = {
  values: ActivityLogFilterValues;
  onChange: (next: ActivityLogFilterValues) => void;
  onApply: () => void;
  className?: string;
};

export function ActivityLogFilterBar({
  values,
  onChange,
  onApply,
  className,
}: ActivityLogFilterBarProps) {
  const toggleEventType = (value: string, checked: boolean) => {
    const next = new Set(values.eventTypes);
    if (checked) next.add(value);
    else next.delete(value);
    onChange({ ...values, eventTypes: [...next] });
  };

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/80 bg-card/90 p-4 shadow-card",
        className,
      )}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
        <Filter className="h-4 w-4 text-primary" aria-hidden />
        Filters and search
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">
            Event types
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 w-full justify-start border-border/60 bg-input"
              >
                <ListChecks className="mr-2 h-4 w-4" />
                {values.eventTypes.length === 0
                  ? "All types"
                  : `${values.eventTypes.length} selected`}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-72 border-border/80 bg-card p-3"
              align="start"
            >
              <p className="mb-2 text-xs text-muted-foreground">
                Leave empty to include every event type.
              </p>
              <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {ACTIVITY_EVENT_TYPE_OPTIONS.map((opt) => {
                  const checked = values.eventTypes.includes(opt.value);
                  return (
                    <li key={opt.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`et-${opt.value}`}
                        checked={checked}
                        onCheckedChange={(c) =>
                          toggleEventType(opt.value, c === true)
                        }
                      />
                      <label
                        htmlFor={`et-${opt.value}`}
                        className="text-sm text-foreground"
                      >
                        {opt.label}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </PopoverContent>
          </Popover>
        </div>

        <div className="lg:col-span-8">
          <Label htmlFor="activity-search">Search (payload and metadata)</Label>
          <Input
            id="activity-search"
            value={values.search}
            onChange={(e) =>
              onChange({ ...values, search: e.target.value })
            }
            placeholder="Keywords, UUID fragment, event name…"
            className="mt-2 bg-input border-border/60"
          />
        </div>

        <div className="lg:col-span-4">
          <Label htmlFor="actor-id">Actor user ID</Label>
          <Input
            id="actor-id"
            value={values.actorUserId}
            onChange={(e) =>
              onChange({ ...values, actorUserId: e.target.value })
            }
            placeholder="UUID"
            className="mt-2 bg-input border-border/60 font-mono text-xs"
          />
        </div>
        <div className="lg:col-span-4">
          <Label htmlFor="dept-id">Department ID</Label>
          <Input
            id="dept-id"
            value={values.departmentId}
            onChange={(e) =>
              onChange({ ...values, departmentId: e.target.value })
            }
            placeholder="UUID"
            className="mt-2 bg-input border-border/60 font-mono text-xs"
          />
        </div>
        <div className="lg:col-span-4">
          <Label htmlFor="wf-run">Workflow run ID</Label>
          <Input
            id="wf-run"
            value={values.workflowRunId}
            onChange={(e) =>
              onChange({ ...values, workflowRunId: e.target.value })
            }
            placeholder="UUID"
            className="mt-2 bg-input border-border/60 font-mono text-xs"
          />
        </div>
        <div className="lg:col-span-4">
          <Label htmlFor="conn-id">Connector ID</Label>
          <Input
            id="conn-id"
            value={values.connectorId}
            onChange={(e) =>
              onChange({ ...values, connectorId: e.target.value })
            }
            placeholder="UUID"
            className="mt-2 bg-input border-border/60 font-mono text-xs"
          />
        </div>
        <div className="lg:col-span-4">
          <Label htmlFor="int-id">Integration ID</Label>
          <Input
            id="int-id"
            value={values.integrationId}
            onChange={(e) =>
              onChange({ ...values, integrationId: e.target.value })
            }
            placeholder="UUID"
            className="mt-2 bg-input border-border/60 font-mono text-xs"
          />
        </div>
        <div className="lg:col-span-4">
          <Label htmlFor="ai-act">AI action ID</Label>
          <Input
            id="ai-act"
            value={values.aiActionId}
            onChange={(e) =>
              onChange({ ...values, aiActionId: e.target.value })
            }
            placeholder="UUID"
            className="mt-2 bg-input border-border/60 font-mono text-xs"
          />
        </div>
        <div className="lg:col-span-6">
          <Label htmlFor="from-iso">From (ISO)</Label>
          <Input
            id="from-iso"
            value={values.from}
            onChange={(e) => onChange({ ...values, from: e.target.value })}
            placeholder="2026-04-01T00:00:00Z"
            className="mt-2 bg-input border-border/60 font-mono text-xs"
          />
        </div>
        <div className="lg:col-span-6">
          <Label htmlFor="to-iso">To (ISO)</Label>
          <Input
            id="to-iso"
            value={values.to}
            onChange={(e) => onChange({ ...values, to: e.target.value })}
            placeholder="2026-04-30T23:59:59Z"
            className="mt-2 bg-input border-border/60 font-mono text-xs"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="cta" size="sm" onClick={onApply}>
          Apply filters
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange({
              eventTypes: [],
              actorUserId: "",
              departmentId: "",
              workflowRunId: "",
              connectorId: "",
              integrationId: "",
              aiActionId: "",
              from: "",
              to: "",
              search: "",
            })
          }
        >
          Clear
        </Button>
      </div>
    </div>
  );
}
