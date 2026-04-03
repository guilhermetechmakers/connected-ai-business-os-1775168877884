import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Layers,
  Package,
  Shield,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  normalizeModuleDataBindings,
  summarizeBindings,
} from "@/api/modules";
import { cn } from "@/lib/utils";
import type { InternalModuleRow } from "@/types/modules";

export type ModuleGridProps = {
  modules: InternalModuleRow[];
  isLoading: boolean;
  onOpenPreview?: (module: InternalModuleRow) => void;
};

function statusVariant(
  status: string,
): "default" | "secondary" | "outline" | "destructive" {
  const s = status.toLowerCase();
  if (s === "published") return "default";
  if (s === "draft") return "secondary";
  if (s === "deprecated" || s === "archived") return "destructive";
  return "outline";
}

export function ModuleGrid({ modules, isLoading, onOpenPreview }: ModuleGridProps) {
  const list = Array.isArray(modules) ? modules : [];

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card
            key={i}
            className="border-border/80 bg-card/90 shadow-card"
          >
            <CardHeader>
              <Skeleton className="h-5 w-2/3 bg-muted" />
              <Skeleton className="h-4 w-1/3 bg-muted" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-9 w-full bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <Card className="border-dashed border-border/80 bg-card/40 shadow-none">
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <Package className="h-10 w-10 text-muted-foreground" aria-hidden />
          <div>
            <p className="font-display text-lg font-semibold text-foreground">
              No modules yet
            </p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Install a marketplace template or create a custom module. Bindings stay
              tenant-isolated under RLS.
            </p>
          </div>
          <Button variant="cta" asChild>
            <Link to="/dashboard/modules/new">Create module</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {list.map((m) => {
        const bindings = normalizeModuleDataBindings(m.data_bindings);
        const tags = Array.isArray(m.tags) ? m.tags : [];
        return (
          <Card
            key={m.id}
            className={cn(
              "group border-border/80 bg-card/90 shadow-card transition-all duration-150",
              "hover:-translate-y-1 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/5",
            )}
          >
            <CardHeader className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="font-display text-lg leading-tight">
                  {m.name}
                </CardTitle>
                <Badge variant={statusVariant(m.status)} className="shrink-0 capitalize">
                  {m.status}
                </Badge>
              </div>
              <CardDescription className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Layers className="h-3.5 w-3.5" aria-hidden />
                  {m.active_version_id ? "Versioned" : "No active version"}
                </span>
                {m.last_deployed_at ? (
                  <span className="inline-flex items-center gap-1 text-success">
                    <Activity className="h-3.5 w-3.5" aria-hidden />
                    Deployed
                  </span>
                ) : (
                  <span className="text-muted-foreground">Not deployed</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {m.description || "No description"}
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">Bindings: </span>
                {summarizeBindings(bindings)}
              </p>
              {tags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {(tags ?? []).slice(0, 4).map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px] font-normal">
                      {t}
                    </Badge>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="cta" className="gap-1" asChild>
                  <Link to={`/dashboard/modules/${m.id}/manage`}>
                    Manage
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </Button>
                {onOpenPreview ? (
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    className="gap-1 border-primary/20"
                    onClick={() => onOpenPreview(m)}
                  >
                    <Shield className="h-3.5 w-3.5" aria-hidden />
                    Test preview
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
