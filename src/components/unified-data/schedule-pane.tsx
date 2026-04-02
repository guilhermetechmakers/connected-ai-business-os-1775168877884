import { CalendarClock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReportScheduleRow } from "@/types/unified";

export type SchedulePaneProps = {
  schedules: ReportScheduleRow[];
  isLoading?: boolean;
};

export function SchedulePane({ schedules, isLoading }: SchedulePaneProps) {
  const list = Array.isArray(schedules) ? schedules : [];

  return (
    <Card className="border-border/80 bg-card/90 shadow-card">
      <CardHeader className="flex flex-row items-center gap-2">
        <CalendarClock className="h-4 w-4 text-primary" aria-hidden />
        <CardTitle className="text-base">Schedules</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No schedules yet. Create one to export on a cadence.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {list.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-surface-inner/80 px-3 py-2"
              >
                <span className="text-foreground">
                  {s.cron_expression ?? "On-demand"}
                </span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {s.export_format}
                  {s.next_run_at
                    ? ` · next ${new Date(s.next_run_at).toLocaleDateString()}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
