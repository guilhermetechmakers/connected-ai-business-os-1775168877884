import { CheckCircle2, Circle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { UnifiedEntity } from "@/types/unified";
import { payloadTitle, payloadString } from "@/types/unified";

export type TaskBoardProps = {
  tasks: UnifiedEntity[];
  isLoading?: boolean;
};

export function TaskBoard({ tasks, isLoading }: TaskBoardProps) {
  const list = Array.isArray(tasks) ? tasks : [];

  return (
    <Card className="border-border/80 bg-card/90 shadow-card">
      <CardHeader>
        <CardTitle className="text-base">Tasks & workflows</CardTitle>
        <p className="text-sm text-muted-foreground">
          Cross-system tasks normalized as unified Task entities.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading tasks">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tasks in this department scope yet.
          </p>
        ) : (
          <ScrollArea className="h-80 pr-3" type="always">
            <ul className="space-y-2">
              {list.map((t) => {
                const statusRaw = payloadString(t.payload, "status");
                const status = (statusRaw ?? "open").toLowerCase();
                const done = status === "done" || status === "completed";
                const Icon = done ? CheckCircle2 : Circle;
                return (
                  <li
                    key={t.id}
                    className="flex items-start gap-3 rounded-lg border border-border/60 bg-surface-inner/80 p-3 text-sm transition-colors duration-150 hover:border-primary/25"
                  >
                    <Icon
                      className={done ? "mt-0.5 h-4 w-4 text-success" : "mt-0.5 h-4 w-4 text-muted-foreground"}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">
                        {payloadTitle(t.payload)}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">{status}</Badge>
                        {payloadString(t.payload, "dueDate") ? (
                          <span>Due {payloadString(t.payload, "dueDate")}</span>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
