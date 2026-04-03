import { AlertCircle, CheckCircle2, Plug } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type IntegrationHealthStatus = "not_connected" | "connected" | "error";

function normalizeStatus(raw: string | undefined): IntegrationHealthStatus {
  const s = String(raw ?? "").toLowerCase();
  if (s === "error") return "error";
  if (
    s === "connected" ||
    s === "healthy" ||
    s === "running"
  ) {
    return "connected";
  }
  return "not_connected";
}

export function IntegrationHealthBadge({
  status,
  lastError,
  lastSync,
  remediation,
}: {
  status: string;
  lastError?: string | null;
  lastSync?: string | null;
  remediation?: string | null;
}) {
  const n = normalizeStatus(status);
  const Icon =
    n === "error" ? AlertCircle : n === "connected" ? CheckCircle2 : Plug;
  const label =
    n === "error"
      ? "Error"
      : n === "connected"
        ? "Connected"
        : "Not connected";

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 gap-1 text-[10px] font-semibold uppercase tracking-wide",
              n === "connected" && "border-success/50 text-success",
              n === "error" && "border-destructive/50 text-destructive",
              n === "not_connected" && "border-border/60 text-muted-foreground",
            )}
          >
            <Icon className="h-3 w-3" aria-hidden />
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs border-border/60 bg-card text-foreground"
        >
          <p className="text-xs font-medium">Last sync</p>
          <p className="text-xs text-muted-foreground">
            {lastSync ? new Date(lastSync).toLocaleString() : "—"}
          </p>
          {lastError ? (
            <>
              <p className="mt-2 text-xs font-medium text-destructive">Issue</p>
              <p className="text-xs text-muted-foreground">{lastError}</p>
              {remediation ? (
                <p className="mt-1 text-xs text-primary">{remediation}</p>
              ) : null}
            </>
          ) : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
