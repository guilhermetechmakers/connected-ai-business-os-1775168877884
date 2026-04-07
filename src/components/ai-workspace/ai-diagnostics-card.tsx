import { useState } from "react";
import { Activity, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAiDiagnostics } from "@/hooks/use-ai";

export function AiDiagnosticsCard() {
  const [hasRun, setHasRun] = useState(false);
  const diagnostics = useAiDiagnostics();

  const run = async () => {
    const out = await diagnostics.refetch();
    setHasRun(true);
    if (out.data?.overallOk) {
      toast.success("AI tools diagnostics passed");
    } else {
      toast.error("AI tools diagnostics reported failures");
    }
  };

  const data = diagnostics.data;

  return (
    <Card className="border-border/70 bg-card/90">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-display">
          <Activity className="h-4 w-4 text-primary" aria-hidden />
          Tool diagnostics
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Smoke checks for Ask, Analyze, Report, and Action with citation and permission checks.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          type="button"
          size="sm"
          className="w-full"
          onClick={() => void run()}
          disabled={diagnostics.isFetching}
        >
          {diagnostics.isFetching ? "Running diagnostics..." : "Run diagnostics"}
        </Button>

        {!hasRun ? (
          <p className="text-xs text-muted-foreground">Run once to validate mode behavior end-to-end.</p>
        ) : data ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Last run: {new Date(data.generatedAt).toLocaleString()}
              </div>
              <Badge variant={data.overallOk ? "secondary" : "destructive"}>
                {data.overallOk ? "Pass" : "Fail"}
              </Badge>
            </div>

            <ul className="space-y-2">
              {data.checks.map((c) => (
                <li key={c.mode} className="rounded-lg border border-border/60 bg-surface-inner/60 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-foreground">{c.mode}</p>
                    {c.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" aria-hidden />
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {c.latencyMs}ms · {c.citationCount} citation(s)
                  </p>
                  {!c.ok ? (
                    <p className="text-[11px] text-destructive">{c.message}</p>
                  ) : null}
                </li>
              ))}
            </ul>

            <div className="rounded-lg border border-border/60 bg-surface-inner/50 p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Manual checklist
              </p>
              <ol className="space-y-1 text-xs text-muted-foreground">
                {data.manualChecklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </div>
          </div>
        ) : (
          <p className="text-xs text-destructive">Diagnostics failed to execute.</p>
        )}
      </CardContent>
    </Card>
  );
}
