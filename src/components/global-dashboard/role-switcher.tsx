import { cn } from "@/lib/utils";

export type RolePreviewMode = "actual" | "executive" | "manager" | "team_member";

const OPTIONS: { value: RolePreviewMode; label: string; description: string }[] = [
  { value: "actual", label: "My roles", description: "Use profile RBAC" },
  { value: "executive", label: "Executive", description: "Preview executive visibility" },
  { value: "manager", label: "Manager", description: "Preview manager visibility" },
  { value: "team_member", label: "Team member", description: "Preview member visibility" },
];

export type RoleSwitcherProps = {
  value: RolePreviewMode;
  onChange: (next: RolePreviewMode) => void;
  className?: string;
};

/** Maps preview mode to widget visibility roles (single-lens simulation). */
export function rolesForPreview(mode: RolePreviewMode, profileRoles: string[]): string[] {
  if (mode === "actual") return Array.isArray(profileRoles) ? profileRoles : [];
  if (mode === "team_member") return ["team member"];
  if (mode === "manager") return ["manager"];
  return ["executive"];
}

export function insightRoleViewLabel(mode: RolePreviewMode): string | undefined {
  if (mode === "actual") return undefined;
  if (mode === "team_member") return "team member";
  return mode;
}

export function RoleSwitcher({ value, onChange, className }: RoleSwitcherProps) {
  return (
    <div
      className={cn("flex flex-wrap gap-2", className)}
      role="group"
      aria-label="Role view preview"
    >
      {OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-left text-xs font-medium transition-all duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
              selected
                ? "border-primary/50 bg-primary/15 text-primary shadow-sm"
                : "border-border/60 bg-surface-inner/80 text-muted-foreground hover:border-primary/25 hover:text-foreground",
            )}
            aria-pressed={selected}
          >
            <span className="block font-semibold text-foreground">{opt.label}</span>
            <span className="block text-[10px] font-normal text-muted-foreground">{opt.description}</span>
          </button>
        );
      })}
    </div>
  );
}
