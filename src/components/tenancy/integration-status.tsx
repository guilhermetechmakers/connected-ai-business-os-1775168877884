import { cn } from "@/lib/utils";

export interface IntegrationStatusProps {
  status: string;
  lastSyncAt?: string | null;
  errorMessage?: string | null;
  className?: string;
}

export function IntegrationStatus({
  status,
  lastSyncAt,
  errorMessage,
  className,
}: IntegrationStatusProps) {
  const s = String(status).toLowerCase();
  const healthy =
    s === "connected" || s === "healthy" || s === "active" || s === "ok";
  const label = errorMessage
    ? "error"
    : healthy
      ? "healthy"
      : s || "unknown";

  return (
    <div className={cn("flex items-center gap-2 text-sm", className)}>
      <span className="relative flex h-2 w-2 shrink-0">
        <span
          className={cn(
            "absolute inline-flex h-full w-full rounded-full opacity-75",
            healthy ? "animate-pulse-live bg-success" : "bg-primary/60",
            label === "error" && "bg-destructive",
          )}
        />
        <span
          className={cn(
            "relative inline-flex h-2 w-2 rounded-full",
            healthy ? "bg-success" : "bg-primary",
            label === "error" && "bg-destructive",
          )}
        />
      </span>
      <span className="text-muted-foreground">
        <span className="font-medium text-foreground">{label}</span>
        {lastSyncAt ? (
          <span className="ml-1 text-xs">
            ·{" "}
            {(() => {
              try {
                return new Date(lastSyncAt).toLocaleString();
              } catch {
                return lastSyncAt;
              }
            })()}
          </span>
        ) : null}
      </span>
    </div>
  );
}
