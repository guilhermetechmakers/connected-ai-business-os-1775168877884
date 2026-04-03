import { AlertCircle, CheckCircle2, CircleDashed, WifiOff } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type IntegrationHealthDisplayStatus =
  | "not_connected"
  | "connected"
  | "error"
  | "healthy";

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso || typeof iso !== "string") return "Never";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "Unknown";
    return d.toLocaleString();
  } catch {
    return "Unknown";
  }
}

export function IntegrationHealthBadge({
  status,
  lastError,
  lastRemediation,
  lastSync,
  className,
}: {
  status: IntegrationHealthDisplayStatus;
  lastError?: string | null;
  lastRemediation?: string | null;
  lastSync?: string | null;
  className?: string;
}) {
  const label =
    status === "healthy" || status === "connected"
      ? "Connected"
      : status === "error"
        ? "Error"
        : "Not connected";

  const Icon =
    status === "error"
      ? AlertCircle
      : status === "healthy"
        ? CheckCircle2
        : status === "connected"
          ? CheckCircle2
          : CircleDashed;

  const chipClass =
    status === "error"
      ? "border-destructive/50 text-destructive"
      : status === "healthy"
        ? "border-success/50 text-success"
        : status === "connected"
          ? "border-primary/45 text-primary"
          : "border-border/60 text-muted-foreground";

  const tipLines: string[] = [`Status: ${label}`];
  tipLines.push(`Last sync: ${formatRelativeTime(lastSync)}`);
  if (lastError && String(lastError).trim().length > 0) {
    tipLines.push(`Error: ${lastError}`);
  }
  if (lastRemediation && String(lastRemediation).trim().length > 0) {
    tipLines.push(`Remediation: ${lastRemediation}`);
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors duration-150",
              chipClass,
              className,
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {label}
            {status === "not_connected" ? (
              <WifiOff className="h-3 w-3 opacity-60" aria-hidden />
            ) : null}
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs border-border/80 bg-card text-xs text-foreground"
        >
          <ul className="list-inside list-disc space-y-1 text-muted-foreground">
            {tipLines.map((line) => (
              <li key={line} className="text-left">
                {line}
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function connectorRowToHealthStatus(row: {
  status: string;
}): IntegrationHealthDisplayStatus {
  const s = String(row.status ?? "").toLowerCase();
  if (s === "error") return "error";
  if (s === "healthy") return "healthy";
  if (s === "connected") return "connected";
  return "not_connected";
}
