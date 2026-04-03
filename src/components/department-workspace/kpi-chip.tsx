import { cn } from "@/lib/utils";

export type KPIChipProps = {
  label: string;
  value: string;
  variant?: "default" | "success" | "accent";
  className?: string;
};

export function KPIChip({ label, value, variant = "default", className }: KPIChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-all duration-150",
        variant === "success" &&
          "border-success/30 bg-success/10 text-success",
        variant === "accent" &&
          "border-primary/35 bg-primary/10 text-primary",
        variant === "default" &&
          "border-border/80 bg-surface-inner/90 text-muted-foreground",
        className,
      )}
    >
      <span className="uppercase tracking-wider text-[10px] text-muted-foreground">
        {label}
      </span>
      <span className="font-semibold text-foreground">{value}</span>
    </span>
  );
}
