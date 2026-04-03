import { useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ActivityLogEntry } from "@/types/activity-log";
import { activityLogSummary } from "@/types/unified";

export type TeamActivityPanelProps = {
  entries: ActivityLogEntry[];
  isLoading?: boolean;
  className?: string;
};

export function TeamActivityPanel({
  entries,
  isLoading,
  className,
}: TeamActivityPanelProps) {
  const [typeQ, setTypeQ] = useState("");
  const list = Array.isArray(entries) ? entries : [];

  const filtered = useMemo(() => {
    const t = typeQ.trim().toLowerCase();
    if (!t) return list;
    return list.filter((e) => e.event_type.toLowerCase().includes(t));
  }, [list, typeQ]);

  return (
    <Card className={cn("border-border/80 bg-card/90 shadow-card", className)}>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <CardTitle className="text-base">Team activity</CardTitle>
          <p className="text-sm text-muted-foreground">
            Tenant audit stream filtered to this department when available.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="relative flex h-2.5 w-2.5"
            aria-label="Live activity indicator"
          >
            <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
          </span>
          <div className="space-y-1">
            <Label htmlFor="act-type" className="sr-only">
              Filter by event type
            </Label>
            <Input
              id="act-type"
              value={typeQ}
              onChange={(e) => setTypeQ(e.target.value)}
              placeholder="Filter event type…"
              className="h-9 w-48 bg-surface-inner"
              aria-label="Filter activity by event type substring"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No activity rows with a department link yet. Actions will appear here as workflows and AI
            runs emit scoped logs.
          </p>
        ) : (
          <ul className="space-y-2" aria-label="Activity timeline">
            {filtered.map((e) => (
              <li
                key={e.id}
                className="rounded-lg border border-border/60 bg-surface-inner/70 px-3 py-2 text-sm transition-all duration-150 hover:border-primary/20"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-primary">{e.event_type}</span>
                  <time className="text-xs text-muted-foreground" dateTime={e.created_at}>
                    {new Date(e.created_at).toLocaleString()}
                  </time>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {activityLogSummary(e.payload as import("@/types/database").Json)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
