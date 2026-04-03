import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type WidgetBaseProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  /** When false, entire widget hidden (role-based visibility). */
  visible?: boolean;
};

export function WidgetBase({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
  visible = true,
}: WidgetBaseProps) {
  if (!visible) return null;
  return (
    <Card
      className={cn(
        "border-border/80 bg-card/95 shadow-card transition-all duration-150",
        "hover:-translate-y-1 hover:shadow-card-hover motion-reduce:hover:translate-y-0",
        "focus-within:ring-2 focus-within:ring-primary/30",
        className,
      )}
    >
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="font-display text-base font-semibold text-foreground">{title}</CardTitle>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </CardHeader>
      <CardContent className={cn("pt-0", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
