import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type DashboardWidgetCardProps = {
  title: string;
  children: ReactNode;
  showDragHandle?: boolean;
  actions?: ReactNode;
  className?: string;
};

export function DashboardWidgetCard({
  title,
  children,
  showDragHandle = false,
  actions,
  className,
}: DashboardWidgetCardProps) {
  return (
    <Card
      className={cn(
        "flex h-full min-h-0 flex-col border-border/80 bg-card/90 shadow-card",
        "transition-transform duration-150 motion-reduce:transform-none",
        "hover:-translate-y-1 hover:shadow-card-hover motion-reduce:hover:translate-y-0",
        className,
      )}
    >
      <CardHeader className="flex shrink-0 flex-row items-center gap-2 space-y-0 py-3">
        {showDragHandle ? (
          <span
            className="dashboard-drag-handle inline-flex cursor-grab touch-none rounded-md p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground active:cursor-grabbing"
            aria-label="Drag widget"
            role="button"
            tabIndex={0}
          >
            <GripVertical className="h-4 w-4" />
          </span>
        ) : null}
        <CardTitle className="truncate text-sm font-medium text-foreground">{title}</CardTitle>
        {actions ? <div className="ml-auto flex shrink-0 items-center gap-1">{actions}</div> : null}
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-auto p-4 pt-0">{children}</CardContent>
    </Card>
  );
}
