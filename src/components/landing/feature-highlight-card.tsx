import type { LucideIcon } from "lucide-react";
import {
  Bot,
  LayoutDashboard,
  Layers,
  Plug,
  Sparkles,
  Workflow,
} from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, LucideIcon> = {
  Plug,
  plug: Plug,
  Bot,
  bot: Bot,
  Workflow,
  workflow: Workflow,
  LayoutDashboard,
  "layout-dashboard": LayoutDashboard,
  Sparkles,
  sparkles: Sparkles,
  Layers,
  layers: Layers,
};

export interface FeatureHighlightCardProps {
  icon: string;
  title: string;
  description: string;
  className?: string;
}

export function FeatureHighlightCard({
  icon,
  title,
  description,
  className,
}: FeatureHighlightCardProps) {
  const key = icon?.trim() ?? "";
  const Icon = ICON_MAP[key] ?? ICON_MAP[key.toLowerCase()] ?? Sparkles;
  const label = `${title}: ${description}`;

  return (
    <Card
      role="article"
      aria-label={label}
      className={cn(
        "border-border/80 bg-card/80 shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className,
      )}
    >
      <CardHeader className="space-y-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-secondary/40 bg-surface-inner text-primary">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <CardTitle className="font-display text-lg">{title}</CardTitle>
        <CardDescription className="text-base leading-relaxed">
          {description}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
