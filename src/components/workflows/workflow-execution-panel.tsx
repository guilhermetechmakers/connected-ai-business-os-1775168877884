import { formatDistanceToNow } from "date-fns";
import { Ban, RefreshCw, ScrollText } from "lucide-react";

import { parseRunLogs } from "@/api/workflows";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { WorkflowRunRow } from "@/types/workflows";
import { cn } from "@/lib/utils";

export type WorkflowExecutionPanelProps = {
  runs: WorkflowRunRow[];
  selectedRunId: string | null;
  onSelectRun: (id: string | null) => void;
  allowWrite?: boolean;
  onRetry?: (runId: string) => void;
  onCancel?: (runId: string) => void;
  isRetrying?: boolean;
  isCanceling?: boolean;
  className?: string;
};

function statusStyles(status: string) {
  const s = String(status);
  if (s === "Completed") return "bg-success/15 text-success";
  if (s === "Failed") return "bg-destructive/15 text-destructive";
  if (s === "Running") {
    return "bg-primary/15 text-primary motion-safe:animate-pulse";
  }
  if (s === "WaitingApproval") return "bg-secondary/20 text-secondary-foreground";
  if (s === "Canceled") return "bg-muted text-muted-foreground";
  return "bg-muted/50 text-foreground";
}

export function WorkflowExecutionPanel({
  runs,
  selectedRunId,
  onSelectRun,
  allowWrite = false,
  onRetry,
  onCancel,
  isRetrying,
  isCanceling,
  className,
}: WorkflowExecutionPanelProps) {
  const list = Array.isArray(runs) ? runs : [];
  const selected = list.find((r) => r.id === selectedRunId) ?? null;
  const logs = parseRunLogs(selected);

  return (
    <div
      className={cn(
        "flex min-h-[320px] flex-col rounded-2xl border border-border/80 bg-card/90 shadow-card lg:min-h-[480px]",
        className,
      )}
    >
      <div className="border-b border-border/60 p-4">
        <div className="flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-primary" aria-hidden />
          <h3 className="text-sm font-semibold text-foreground">
            Execution & logs
          </h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Live status, structured log stream, retry and cancel for eligible runs.
        </p>
      </div>

      <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-2">
        <ScrollArea className="h-[min(280px,40vh)] border-b border-border/60 lg:h-auto lg:border-b-0 lg:border-r">
          <ul className="divide-y divide-border/50 p-2">
            {list.length === 0 ? (
              <li className="px-2 py-8 text-center text-xs text-muted-foreground">
                No runs yet. Trigger a manual or test execution.
              </li>
            ) : null}
            {(list ?? []).map((r) => {
              const active = r.id === selectedRunId;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onSelectRun(r.id)}
                    className={cn(
                      "flex w-full flex-col gap-1 rounded-lg px-3 py-2.5 text-left text-xs transition-all duration-150",
                      active
                        ? "bg-primary/10 ring-1 ring-primary/25"
                        : "hover:bg-muted/50",
                    )}
                    aria-current={active ? "true" : undefined}
                  >
                    <span className="font-mono text-[11px] text-primary">
                      {r.id.slice(0, 8)}…
                    </span>
                    <span
                      className={cn(
                        "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                        statusStyles(r.status ?? ""),
                      )}
                    >
                      {r.status}
                      {r.status === "Running" ? (
                        <span
                          className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-success"
                          aria-hidden
                        />
                      ) : null}
                    </span>
                    <span className="text-muted-foreground">
                      {formatDistanceToNow(new Date(r.created_at), {
                        addSuffix: true,
                      })}
                      {r.test_mode ? " · test" : " · live"}
                      {typeof r.retry_count === "number" && r.retry_count > 0
                        ? ` · retry #${r.retry_count}`
                        : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </ScrollArea>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-wrap gap-2 border-b border-border/60 p-3">
            {allowWrite && selected && onRetry ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={
                  isRetrying ||
                  !["Failed", "Canceled"].includes(String(selected.status))
                }
                className="h-8 gap-1"
                onClick={() => onRetry(selected.id)}
                aria-label="Retry failed or canceled run"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </Button>
            ) : null}
            {allowWrite && selected && onCancel ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isCanceling || String(selected.status) !== "Running"}
                className="h-8 gap-1"
                onClick={() => onCancel(selected.id)}
                aria-label="Cancel running execution"
              >
                <Ban className="h-3.5 w-3.5" />
                Cancel
              </Button>
            ) : null}
          </div>
          <ScrollArea className="min-h-[200px] flex-1 p-3">
            {selected ? (
              <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted-foreground">
                {JSON.stringify(logs, null, 2)}
              </pre>
            ) : (
              <p className="text-xs text-muted-foreground">
                Select a run to inspect logs.
              </p>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
