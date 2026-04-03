import { Bot, Lightbulb, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type WorkflowAiInsightsPanelProps = {
  workflowCount: number;
  failedRuns: number;
  className?: string;
};

export function WorkflowAiInsightsPanel({
  workflowCount,
  failedRuns,
  className,
}: WorkflowAiInsightsPanelProps) {
  const insights = [
    {
      id: "coverage",
      title: "Automation coverage",
      body:
        workflowCount === 0
          ? "No workflows in this scope yet. Start with a trigger + action template from the library."
          : `You have ${workflowCount} workflow(s) in scope. Consider adding approval gates before external actions.`,
      tone: "default" as const,
    },
    {
      id: "reliability",
      title: "Reliability signal",
      body:
        failedRuns > 2
          ? `${failedRuns} recent failures detected in the loaded run sample. Inspect logs and retry policies.`
          : "Failure count in the current sample is low. Keep backoff and alert flags enabled for production.",
      tone: failedRuns > 2 ? ("warn" as const) : ("default" as const),
    },
    {
      id: "next",
      title: "Suggested next steps",
      body:
        "Wire department-scoped runs from this studio, validate graphs before scheduling, and route approvals to managers with SLA timers.",
      tone: "default" as const,
    },
  ];

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/80 bg-gradient-to-br from-card/95 via-card/90 to-surface-inner/80 p-4 shadow-card",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-primary">
        <Bot className="h-5 w-5" aria-hidden />
        <h3 className="text-sm font-semibold text-foreground">
          AI insights (heuristic)
        </h3>
        <Badge variant="outline" className="text-[10px]">
          Offline
        </Badge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Rule-based hints until the assistant is connected to live telemetry.
      </p>
      <ul className="mt-4 space-y-3">
        {(insights ?? []).map((row) => (
          <li
            key={row.id}
            className={cn(
              "rounded-xl border border-border/60 bg-surface-inner/50 p-3",
              row.tone === "warn" && "border-amber-500/30",
            )}
          >
            <div className="flex items-start gap-2">
              {row.tone === "warn" ? (
                <ShieldAlert
                  className="mt-0.5 h-4 w-4 shrink-0 text-amber-400"
                  aria-hidden
                />
              ) : (
                <Lightbulb
                  className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                  aria-hidden
                />
              )}
              <div>
                <p className="text-sm font-medium text-foreground">{row.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{row.body}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
