import { cn } from "@/lib/utils";

export interface PillTagProps {
  children: React.ReactNode;
  variant?: "default" | "accent" | "success" | "muted";
  className?: string;
}

export function PillTag({
  children,
  variant = "default",
  className,
}: PillTagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest transition-colors duration-150",
        variant === "default" &&
          "border-border/60 bg-surface-inner text-muted-foreground",
        variant === "accent" &&
          "border-primary/35 bg-primary/10 text-primary",
        variant === "success" &&
          "border-success/40 bg-success/10 text-success",
        variant === "muted" && "border-transparent bg-muted/40 text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}
