import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type KPIBlockProps = {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down" | "neutral";
  icon?: ReactNode;
  className?: string;
};

export function KPIBlock({
  label,
  value,
  delta,
  trend = "neutral",
  icon,
  className,
}: KPIBlockProps) {
  const deltaColor =
    trend === "up"
      ? "text-success"
      : trend === "down"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <Card
      className={cn(
        "border-border/80 bg-card/90 shadow-card transition-all duration-150 hover:-translate-y-1 hover:shadow-card-hover",
        className,
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        {icon ? (
          <span className="text-primary opacity-90" aria-hidden>
            {icon}
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-2">
        <span className="font-display text-3xl font-bold tracking-tight text-foreground">
          {value}
        </span>
        {delta ? (
          <span className={cn("text-xs font-semibold", deltaColor)}>{delta}</span>
        ) : null}
      </CardContent>
    </Card>
  );
}
