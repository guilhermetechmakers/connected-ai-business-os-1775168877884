import { cn } from "@/lib/utils";
import type { DepartmentWorkspaceUserRole } from "@/types/department-workspace-list";

const roleStyles: Record<
  DepartmentWorkspaceUserRole,
  string
> = {
  Manager:
    "border-[rgb(0_210_122/0.45)] text-[rgb(0_210_122)] bg-[rgb(0_210_122/0.08)]",
  Member:
    "border-[rgb(154_208_255/0.35)] text-[rgb(154_208_255)] bg-[rgb(154_208_255/0.06)]",
  Guest: "border-border/60 text-muted-foreground bg-muted/30",
};

export type AccessBadgeProps = {
  role: DepartmentWorkspaceUserRole | string;
  className?: string;
};

export function AccessBadge({ role, className }: AccessBadgeProps) {
  const r =
    role === "Manager" || role === "Member" || role === "Guest" ? role : "Member";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        roleStyles[r],
        className,
      )}
    >
      {r}
    </span>
  );
}
