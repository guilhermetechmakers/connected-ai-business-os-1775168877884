import { ExternalLink, FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AiWorkspaceDocumentItem } from "@/types/ai";

export function DocumentCard({
  item,
  className,
}: {
  item: AiWorkspaceDocumentItem;
  className?: string;
}) {
  const label = item.title || item.sourceProvider;
  const href =
    item.externalId && item.externalId.startsWith("http")
      ? item.externalId
      : undefined;

  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-surface-inner/70 p-3 text-left transition-all duration-150 hover:-translate-y-1 hover:border-primary/20 hover:shadow-card",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              {item.sourceProvider}
              <span className="ml-2 font-mono text-[10px] font-normal text-muted-foreground">
                {item.kind}
              </span>
            </p>
            {item.indexStatus ? (
              <Badge variant="outline" className="h-5 text-[10px] uppercase">
                {item.indexStatus}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-2 text-sm font-medium text-foreground">{label}</p>
          {item.snippet ? (
            <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
              {item.snippet}
            </p>
          ) : null}
        </div>
      </div>
      {href ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 h-8 w-full gap-1 text-xs text-primary"
          asChild
        >
          <a href={href} target="_blank" rel="noreferrer">
            Open source
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </Button>
      ) : null}
    </div>
  );
}
