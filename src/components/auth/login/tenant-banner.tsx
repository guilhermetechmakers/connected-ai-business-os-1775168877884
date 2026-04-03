import { Building2 } from "lucide-react";

import { cn } from "@/lib/utils";

export type TenantBannerProps = {
  tenantName?: string;
  className?: string;
};

export function TenantBanner({ tenantName, className }: TenantBannerProps) {
  const label =
    typeof tenantName === "string" && tenantName.trim().length > 0
      ? tenantName.trim()
      : null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border border-secondary/25 bg-surface-inner/80 px-3 py-2 text-xs text-muted-foreground motion-safe:animate-fade-in",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Building2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
      <span>
        {label ? (
          <>
            <span className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
              Tenant
            </span>{" "}
            <span className="text-foreground">{label}</span>
          </>
        ) : (
          <>
            <span className="text-foreground">Workspace context</span> — sign in with your
            assigned company email. If you were invited, use the link from your invitation
            email.
          </>
        )}
      </span>
    </div>
  );
}
