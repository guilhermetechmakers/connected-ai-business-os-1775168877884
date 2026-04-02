import { Link2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { UnifiedEntity } from "@/types/unified";
import { payloadTitle } from "@/types/unified";

export type UnifiedEntityCardProps = {
  entity: UnifiedEntity;
  className?: string;
  onSelect?: (entity: UnifiedEntity) => void;
};

export function UnifiedEntityCard({
  entity,
  className,
  onSelect,
}: UnifiedEntityCardProps) {
  const refs = Array.isArray(entity.sourceReferences)
    ? entity.sourceReferences
    : [];
  const links = Array.isArray(entity.linkedEntityIds)
    ? entity.linkedEntityIds
    : [];
  const title = payloadTitle(entity.payload);

  return (
    <Card
      className={cn(
        "border-border/80 bg-card/90 shadow-card transition-all duration-150 hover:-translate-y-1 hover:shadow-card-hover",
        onSelect && "cursor-pointer",
        className,
      )}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={() => onSelect?.(entity)}
      onKeyDown={(e) => {
        if (!onSelect) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(entity);
        }
      }}
    >
      <CardHeader className="space-y-2 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
            {entity.entityType}
          </Badge>
          {entity.isDeleted ? (
            <Badge variant="secondary" className="text-[10px]">
              Archived
            </Badge>
          ) : null}
        </div>
        <CardTitle className="text-base font-semibold leading-snug text-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs text-muted-foreground">
        <p>
          v{entity.version} · updated{" "}
          {new Date(entity.updatedAt).toLocaleString()}
        </p>
        {refs.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {refs.slice(0, 4).map((r) => (
              <Badge key={`${r.provider}-${r.externalId}`} variant="secondary">
                {r.provider}:{r.externalId}
              </Badge>
            ))}
            {refs.length > 4 ? (
              <span className="text-[10px]">+{refs.length - 4} sources</span>
            ) : null}
          </div>
        ) : null}
        {links.length > 0 ? (
          <p className="flex items-center gap-1 text-[11px] text-primary">
            <Link2 className="h-3.5 w-3.5" aria-hidden />
            {links.length} linked record{links.length === 1 ? "" : "s"}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
