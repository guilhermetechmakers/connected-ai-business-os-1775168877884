import { ArrowUpRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { GlobalSearchHit, GlobalSearchHitType } from "@/types/global-search";

const ORDER: GlobalSearchHitType[] = ["Document", "Entity", "Activity", "Report"];

function groupHits(hits: GlobalSearchHit[]): Map<GlobalSearchHitType, GlobalSearchHit[]> {
  const map = new Map<GlobalSearchHitType, GlobalSearchHit[]>();
  for (const t of ORDER) map.set(t, []);
  const list = Array.isArray(hits) ? hits : [];
  for (const h of list) {
    const key: GlobalSearchHitType = ORDER.includes(h.type) ? h.type : "Entity";
    const bucket = map.get(key);
    if (bucket) bucket.push(h);
  }
  return map;
}

export type GlobalSearchResultGroupsProps = {
  results: GlobalSearchHit[];
  isLoading?: boolean;
  selectedId: string | null;
  onSelect: (hit: GlobalSearchHit) => void;
  aiOpenId: string | null;
  aiTargetId: string | null;
  onToggleAi: (hit: GlobalSearchHit) => void;
  aiSummary?: string;
  aiLoading?: boolean;
  aiConfidence?: number;
};

export function GlobalSearchResultGroups({
  results,
  isLoading,
  selectedId,
  onSelect,
  aiOpenId,
  aiTargetId,
  onToggleAi,
  aiSummary,
  aiLoading,
  aiConfidence,
}: GlobalSearchResultGroupsProps) {
  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading search results">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const grouped = groupHits(results);
  const total = (results ?? []).length;

  if (total === 0) {
    return (
      <Card className="border-border/70 bg-card/80">
        <CardContent className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No matches for this query. Try another keyword or loosen filters.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8" role="list" aria-label="Search results by type">
      {ORDER.map((type) => {
        const items = grouped.get(type) ?? [];
        if (items.length === 0) return null;
        const groupLabel =
          type === "Entity"
            ? "Entities"
            : type === "Activity"
              ? "Activity"
              : `${type}s`;
        return (
          <section key={type} aria-labelledby={`search-group-${type}`}>
            <h2
              id={`search-group-${type}`}
              className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-primary"
            >
              {groupLabel} · {items.length}
            </h2>
            <ul className="space-y-3">
              {(items ?? []).map((hit) => {
                const hitKey = `${hit.type}-${hit.id}`;
                const showAiPanel = aiOpenId === hitKey;
                const aiForThis = aiTargetId === hitKey;
                return (
                <li key={hitKey} role="listitem">
                  <Card
                    className={cn(
                      "border-border/70 bg-card/90 shadow-card transition-all duration-150 hover:-translate-y-1 hover:border-primary/25 hover:shadow-lg",
                      selectedId === hitKey && "ring-1 ring-primary/30",
                    )}
                  >
                    <CardContent className="space-y-3 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <button
                          type="button"
                          className="text-left"
                          onClick={() => onSelect(hit)}
                          aria-current={selectedId === hitKey ? "true" : undefined}
                        >
                          <p className="font-medium text-foreground">{hit.title}</p>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {hit.snippet}
                          </p>
                        </button>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {hit.source}
                          </Badge>
                          {hit.subType ? (
                            <Badge variant="secondary" className="text-[10px]">
                              {hit.subType}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <time dateTime={hit.date}>
                          {hit.date ? new Date(hit.date).toLocaleString() : "—"}
                        </time>
                        {hit.owner ? <span>· {hit.owner}</span> : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 text-xs"
                          onClick={() => onToggleAi(hit)}
                          aria-expanded={showAiPanel}
                        >
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                          AI summary
                        </Button>
                        {hit.href ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="cta"
                            className="h-8 gap-1 text-xs"
                            asChild
                          >
                            <Link to={hit.href}>
                              Open
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs text-muted-foreground"
                            disabled
                          >
                            Detail route TBD
                          </Button>
                        )}
                      </div>
                      {showAiPanel ? (
                        <div
                          className="rounded-xl border border-primary/20 bg-surface-inner/90 p-4 text-sm text-muted-foreground animate-in fade-in duration-150"
                          role="region"
                          aria-label="AI generated summary"
                        >
                          {aiLoading && aiForThis ? (
                            <p>Generating summary…</p>
                          ) : (
                            <>
                              <p className="whitespace-pre-wrap text-foreground/90">
                                {aiForThis
                                  ? aiSummary || "No summary yet."
                                  : "Open AI summary on this result to load context."}
                              </p>
                              {aiForThis && typeof aiConfidence === "number" ? (
                                <p className="mt-2 text-xs text-primary">
                                  Confidence: {(aiConfidence * 100).toFixed(0)}%
                                </p>
                              ) : null}
                            </>
                          )}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                </li>
              );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
