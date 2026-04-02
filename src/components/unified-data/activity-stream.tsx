import { Activity } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActivityFeedItem } from "@/types/unified";

export type ActivityStreamProps = {
  items: ActivityFeedItem[];
  isLoading?: boolean;
  emptyLabel?: string;
};

export function ActivityStream({
  items,
  isLoading,
  emptyLabel = "No recent activity from the unified layer yet.",
}: ActivityStreamProps) {
  const safeItems = Array.isArray(items) ? items : [];

  return (
    <Card className="border-border/80 bg-card/90 shadow-card">
      <CardHeader className="flex flex-row items-center gap-2">
        <Activity className="h-4 w-4 text-primary" aria-hidden />
        <CardTitle className="text-base">Activity stream</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading activity">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : safeItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <ScrollArea className="h-72 pr-3" type="always">
            <ul className="space-y-3">
              {safeItems.map((e) => (
                <li
                  key={e.id}
                  className="rounded-lg border border-border/60 bg-surface-inner/80 p-3 text-sm transition-colors duration-150 hover:border-primary/25"
                >
                  <p className="font-medium text-foreground">{e.title}</p>
                  <p className="text-xs text-muted-foreground">{e.detail}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {new Date(e.at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
