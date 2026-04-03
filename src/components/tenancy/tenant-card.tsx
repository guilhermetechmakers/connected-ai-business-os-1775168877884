import { Building2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TenantCompanyRecord } from "@/types/tenancy";

import { PillTag } from "@/components/tenancy/pill-tag";

export interface TenantCardProps {
  tenant: TenantCompanyRecord;
  footer?: React.ReactNode;
  className?: string;
}

export function TenantCard({ tenant, footer, className }: TenantCardProps) {
  const status = tenant.tenant_status ?? "active";
  return (
    <Card
      className={cn(
        "border-border/80 bg-card/90 transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg",
        className,
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <CardTitle className="text-base font-semibold">
              {tenant.display_name ?? tenant.name}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{tenant.plan}</p>
          </div>
        </div>
        <PillTag
          variant={
            status === "active"
              ? "success"
              : status === "deprovisioned"
                ? "muted"
                : "accent"
          }
        >
          {status}
        </PillTag>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>
          <span className="text-foreground/90">Region</span> · {tenant.region}
        </p>
        {tenant.legal_name ? (
          <p>
            <span className="text-foreground/90">Legal</span> ·{" "}
            {tenant.legal_name}
          </p>
        ) : null}
        {footer}
      </CardContent>
    </Card>
  );
}
