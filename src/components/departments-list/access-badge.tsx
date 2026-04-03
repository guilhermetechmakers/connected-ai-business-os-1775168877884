import { cn } from "@/lib/utils";

export type DepartmentAccessRole = "Manager" | "Member" | "Guest";

export type AccessBadgeProps = {
  role: string;
  className?: string;
};

const ROLE_STYLES: Record<DepartmentAccessRole, string> = {
  Manager:
    "border-success/40 bg-success/10 text-success ring-1 ring-success/20",
  Member: "border-primary/30 bg-primary/10 text-primary ring-1 ring-primary/15",
  Guest: "border-border bg-muted/40 text-muted-foreground",
};

export function AccessBadge({ role, className }: AccessBadgeProps) {
  const r = role === "Manager" || role === "Guest" ? role : "Member";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        ROLE_STYLES[r],
        className,
      )}
      aria-label={`Your access in this department: ${r}`}
    >
      {r}
    </span>
  );
}
