import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchExecutiveBrief } from "@/lib/ai-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { ExecutiveBriefResult } from "@/types/dashboard";

export type AIExecutiveBriefCardProps = {
  canRefresh: boolean;
  className?: string;
};

export function AIExecutiveBriefCard({ canRefresh, className }: AIExecutiveBriefCardProps) {
  const [timeframe, setTimeframe] = useState<"7d" | "30d" | "90d">("7d");
  const queryClient = useQueryClient();

  const briefQ = useQuery({
    queryKey: ["executive-dashboard", "ai-brief", timeframe],
    queryFn: () => fetchExecutiveBrief({ timeframe }),
    enabled: isSupabaseConfigured,
    staleTime: 60_000,
    retry: 1,
  });

  const briefMutation = useMutation({
    mutationFn: () => fetchExecutiveBrief({ timeframe }),
    onSuccess: (data: ExecutiveBriefResult) => {
      queryClient.setQueryData(["executive-dashboard", "ai-brief", timeframe], data);
      toast.success("Executive brief refreshed");
    },
    onError: () => toast.error("Could not refresh executive brief"),
  });

  const data = briefQ.data as ExecutiveBriefResult | undefined;
  const brief = typeof data?.brief === "string" ? data.brief : "";
  const actions = Array.isArray(data?.actionItems) ? data.actionItems : [];

  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-xl border border-border/80 bg-gradient-to-br from-card via-card to-surface-inner/80 p-5 shadow-card",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" aria-hidden />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            AI executive brief
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={timeframe}
            onValueChange={(v) => setTimeframe(v as typeof timeframe)}
            disabled={!canRefresh}
          >
            <SelectTrigger className="h-8 w-[100px] text-xs" aria-label="Brief timeframe">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 days</SelectItem>
              <SelectItem value="30d">30 days</SelectItem>
              <SelectItem value="90d">90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1"
            disabled={!canRefresh || !isSupabaseConfigured || briefMutation.isPending}
            onClick={() => briefMutation.mutate()}
            aria-label="Refresh AI brief"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", briefMutation.isPending && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {!isSupabaseConfigured ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Connect Supabase to generate tenant-grounded briefs via the AI API.
        </p>
      ) : null}

      {briefQ.isLoading && isSupabaseConfigured ? (
        <div className="mt-4 space-y-2" aria-busy="true">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ) : (
        <p className="mt-4 text-sm leading-relaxed text-foreground/90">
          {brief ||
            "Generate a brief to synthesize KPIs, risks, and recent activity for your leadership review."}
        </p>
      )}

      {actions.length > 0 ? (
        <ul className="mt-4 space-y-2 text-sm text-primary">
          {actions.slice(0, 4).map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-success" aria-hidden>
                →
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <Button variant="cta" size="sm" className="rounded-full" asChild>
          <Link to="/chat">Ask AI</Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/dashboard/global">Global dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
