import { Layers, MessageSquare, Sparkles } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AiChatMode } from "@/types/ai";

export function KpiBar({
  mode,
  messageCount,
  citationCount,
  isLive,
  className,
}: {
  mode: AiChatMode;
  messageCount: number;
  citationCount: number;
  isLive: boolean;
  className?: string;
}) {
  const tiles = [
    {
      label: "Mode",
      value: mode,
      icon: Sparkles,
    },
    {
      label: "Messages",
      value: String(messageCount),
      icon: MessageSquare,
    },
    {
      label: "Sources (last turn)",
      value: String(citationCount),
      icon: Layers,
    },
  ];

  return (
    <div
      className={cn(
        "grid gap-3 sm:grid-cols-3 motion-reduce:transform-none",
        className,
      )}
    >
      {tiles.map((t) => (
        <Card
          key={t.label}
          className="border-border/80 bg-card/80 shadow-card transition-all duration-150 hover:-translate-y-1 hover:shadow-card-hover"
        >
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg border border-primary/15 bg-primary/5 p-2">
              <t.icon className="h-4 w-4 text-primary" aria-hidden />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {t.label}
              </p>
              <p className="font-display text-lg font-semibold text-foreground">{t.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
      {isLive ? (
        <div className="sm:col-span-3 flex items-center gap-2 rounded-lg border border-success/25 bg-success/5 px-3 py-2 text-xs text-muted-foreground">
          <span className="relative flex h-2 w-2" aria-label="Live">
            <span className="absolute inline-flex h-full w-full animate-pulse-live rounded-full bg-success/70 opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          Streaming response in progress — citations attach when the model finishes.
        </div>
      ) : null}
    </div>
  );
}
