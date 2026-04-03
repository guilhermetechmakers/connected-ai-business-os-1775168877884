import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, RefreshCw, Shield } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { ActionConfirmDialog } from "@/components/ai-workspace/action-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { executeAiAction, fetchAiDashboardInsights, fetchAiPermissions } from "@/lib/ai-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { AiPermittedAction } from "@/types/ai";

export type AIWorkspaceAccessBridgeProps = {
  roleView?: string;
  datePreset: "7d" | "30d" | "90d";
  className?: string;
};

export function AIWorkspaceAccessBridge({
  roleView,
  datePreset,
  className,
}: AIWorkspaceAccessBridgeProps) {
  const qc = useQueryClient();
  const [pendingAction, setPendingAction] = useState<AiPermittedAction | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const insightsQ = useQuery({
    queryKey: ["global-dashboard-ai-insights", roleView ?? "", datePreset],
    queryFn: () => fetchAiDashboardInsights({ roleView, datePreset }),
    enabled: isSupabaseConfigured,
    staleTime: 45_000,
  });

  const permsQ = useQuery({
    queryKey: ["global-dashboard-ai-perms-bridge"],
    queryFn: fetchAiPermissions,
    enabled: isSupabaseConfigured,
    staleTime: 120_000,
  });

  const permList = Array.isArray(permsQ.data) ? permsQ.data : [];
  const permById = useMemo(() => {
    const m = new Map<string, AiPermittedAction>();
    for (const p of permList) {
      if (p?.id) m.set(p.id, p);
    }
    return m;
  }, [permList]);

  const outputsRaw = insightsQ.data;
  const outputs = Array.isArray(outputsRaw) ? outputsRaw : [];
  const primary = outputs[0];

  const citations = Array.isArray(primary?.citations) ? primary!.citations : [];
  const allowedIds = Array.isArray(primary?.allowedActions) ? primary!.allowedActions : [];

  const openAction = (id: string) => {
    const action = permById.get(id);
    if (!action) {
      toast.message("Action unavailable", {
        description: "This action is not permitted for your profile.",
      });
      return;
    }
    if (action.requiresConfirmation) {
      setPendingAction(action);
      setDialogOpen(true);
      return;
    }
    void (async () => {
      try {
        await executeAiAction({ actionId: action.id, confirmed: true });
        toast.success("Action completed");
        void qc.invalidateQueries({ queryKey: ["global-dashboard-ai-insights"] });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Action failed");
      }
    })();
  };

  return (
    <>
      <Card
        className={cn(
          "border-border/80 bg-gradient-to-br from-card via-card to-secondary/10 shadow-card transition-all duration-150 hover:shadow-card-hover",
          className,
        )}
      >
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <Shield className="h-4 w-4 text-primary" aria-hidden />
            AI workspace bridge
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!isSupabaseConfigured || insightsQ.isFetching}
              onClick={() => void insightsQ.refetch()}
              className="gap-1.5"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", insightsQ.isFetching && "animate-spin")} />
              Refresh insights
            </Button>
            <Button variant="cta" size="sm" className="gap-1.5" asChild>
              <Link to="/dashboard/ai">
                <Bot className="h-3.5 w-3.5" />
                Full workspace
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isSupabaseConfigured ? (
            <p className="text-sm text-muted-foreground">
              Connect Supabase to load RAG-grounded insights and permitted actions.
            </p>
          ) : insightsQ.isError ? (
            <p className="text-sm text-destructive/90">
              {insightsQ.error instanceof Error
                ? insightsQ.error.message
                : "Could not load AI insights. Deploy ai-api with dashboard.insights support."}
            </p>
          ) : insightsQ.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-3/4 rounded-md" />
            </div>
          ) : primary?.content ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{primary.content}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No insight payload returned.</p>
          )}

          {citations.length > 0 ? (
            <div className="rounded-xl border border-border/50 bg-surface-inner/60 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Source citations
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {citations.slice(0, 8).map((c) => (
                  <li
                    key={c}
                    className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 font-mono text-[10px] text-primary"
                  >
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {allowedIds.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Permitted actions (gated)
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {allowedIds.map((id) => {
                  const def = permById.get(id);
                  return (
                    <Button
                      key={id}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full text-xs"
                      onClick={() => openAction(id)}
                      disabled={!isSupabaseConfigured || permsQ.isLoading}
                    >
                      {def?.label ?? id}
                      {def?.requiresConfirmation ? " · confirm" : ""}
                    </Button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <ActionConfirmDialog
        action={pendingAction}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        executeAction={executeAiAction}
        onSuccess={() => {
          void qc.invalidateQueries({ queryKey: ["global-dashboard-ai-insights"] });
        }}
      />
    </>
  );
}
