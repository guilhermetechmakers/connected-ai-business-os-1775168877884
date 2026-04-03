import {
  Activity,
  ArrowUpRight,
  Copy,
  FileBarChart,
  FileText,
  LayoutGrid,
  Star,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { GlobalSearchHit, GlobalSearchHitType } from "@/types/global-search";

function TypeIcon({ type }: { type: GlobalSearchHitType }) {
  const cls = "h-4 w-4 shrink-0 text-primary";
  switch (type) {
    case "Document":
      return <FileText className={cls} aria-hidden />;
    case "Activity":
      return <Activity className={cls} aria-hidden />;
    case "Report":
      return <FileBarChart className={cls} aria-hidden />;
    default:
      return <LayoutGrid className={cls} aria-hidden />;
  }
}

export type SearchResultRowProps = {
  hit: GlobalSearchHit;
  selected: boolean;
  highlighted: boolean;
  onSelect: () => void;
  onToggleHighlight: () => void;
  onCopyLink: () => void;
};

export function SearchResultRow({
  hit,
  selected,
  highlighted,
  onSelect,
  onToggleHighlight,
  onCopyLink,
}: SearchResultRowProps) {
  return (
    <Card
      className={cn(
        "border-border/70 bg-card/90 shadow-card transition-all duration-150 hover:-translate-y-1 hover:border-primary/25 hover:shadow-card-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        selected && "ring-1 ring-primary/35",
        highlighted && "border-success/40",
      )}
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex gap-3">
          <TypeIcon type={hit.type} />
          <div className="min-w-0 flex-1">
            <button
              type="button"
              className="w-full text-left"
              onClick={onSelect}
              aria-current={selected ? "true" : undefined}
            >
              <p className="font-medium text-foreground">{hit.title}</p>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{hit.snippet}</p>
            </button>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline" className="text-[10px] uppercase">
                {hit.source}
              </Badge>
              {hit.subType ? (
                <Badge variant="secondary" className="text-[10px]">
                  {hit.subType}
                </Badge>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <time dateTime={hit.date}>
                {hit.date ? new Date(hit.date).toLocaleString() : "—"}
              </time>
              {hit.owner ? <span>· {hit.owner}</span> : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border/50 pt-3">
          <Button
            type="button"
            size="sm"
            variant={highlighted ? "secondary" : "outline"}
            className="h-8 gap-1 text-xs"
            onClick={onToggleHighlight}
            aria-pressed={highlighted}
          >
            <Star className="h-3.5 w-3.5" />
            Highlight
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs"
            onClick={onCopyLink}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy link
          </Button>
          {hit.href ? (
            <Button type="button" size="sm" variant="cta" className="h-8 gap-1 text-xs" asChild>
              <Link to={hit.href}>
                Open
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : (
            <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" disabled>
              Open in module
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
