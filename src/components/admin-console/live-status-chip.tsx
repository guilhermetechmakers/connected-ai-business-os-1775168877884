import { cn } from "@/lib/utils";

export type LiveStatusVariant = "live" | "error" | "idle" | "syncing";

type LiveStatusChipProps = {
  variant: LiveStatusVariant;
  label: string;
  className?: string;
};

export function LiveStatusChip({
  variant,
  label,
  className,
}: LiveStatusChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors duration-150",
        variant === "live" &&
          "border-success/40 bg-success/10 text-success shadow-[0_0_12px_rgba(0,210,122,0.15)]",
        variant === "error" &&
          "border-destructive/40 bg-destructive/10 text-destructive",
        variant === "idle" && "border-border/60 text-muted-foreground",
        variant === "syncing" &&
          "border-primary/40 bg-primary/10 text-primary shadow-[0_0_12px_rgba(154,208,255,0.12)]",
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          variant === "live" && "animate-pulse bg-success",
          variant === "error" && "bg-destructive",
          variant === "idle" && "bg-muted-foreground",
          variant === "syncing" && "animate-pulse bg-primary",
        )}
        aria-hidden
      />
      {label}
    </span>
  );
}
