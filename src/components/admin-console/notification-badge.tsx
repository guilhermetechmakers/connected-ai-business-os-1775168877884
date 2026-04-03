import { cn } from "@/lib/utils";

type NotificationBadgeProps = {
  count?: number;
  pulse?: boolean;
  className?: string;
  "aria-label"?: string;
};

export function NotificationBadge({
  count = 0,
  pulse = false,
  className,
  "aria-label": ariaLabel,
}: NotificationBadgeProps) {
  const n = typeof count === "number" && count >= 0 ? count : 0;
  const label =
    ariaLabel ?? (n > 0 ? `${n} active notifications` : "No notifications");

  return (
    <span
      className={cn("relative inline-flex h-3 w-3 shrink-0", className)}
      aria-label={label}
      role="status"
    >
      <span
        className={cn(
          "absolute inset-0 rounded-full bg-success opacity-90",
          pulse && n > 0 && "animate-ping",
        )}
        aria-hidden
      />
      <span
        className={cn(
          "relative inline-flex h-3 w-3 rounded-full bg-success ring-2 ring-background",
          n === 0 && "bg-muted-foreground opacity-40",
        )}
        aria-hidden
      />
    </span>
  );
}
