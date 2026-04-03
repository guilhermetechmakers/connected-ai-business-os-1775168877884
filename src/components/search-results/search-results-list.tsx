import { Skeleton } from "@/components/ui/skeleton";
import { SearchResultRow } from "@/components/search-results/search-result-row";
import type { GlobalSearchHit } from "@/types/global-search";

export type SearchResultsListProps = {
  results: GlobalSearchHit[];
  isLoading?: boolean;
  selectedKey: string | null;
  highlightedKeys: Set<string>;
  onSelect: (hit: GlobalSearchHit) => void;
  onToggleHighlight: (key: string) => void;
  onCopyLink: (hit: GlobalSearchHit) => void;
  rowKey: (hit: GlobalSearchHit) => string;
};

export function SearchResultsList({
  results,
  isLoading,
  selectedKey,
  highlightedKeys,
  onSelect,
  onToggleHighlight,
  onCopyLink,
  rowKey,
}: SearchResultsListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading search results">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const list = Array.isArray(results) ? results : [];

  if (list.length === 0) {
    return (
      <div
        className="rounded-2xl border border-border/70 bg-card/80 p-10 text-center animate-in fade-in duration-200 motion-reduce:animate-none"
        role="status"
      >
        <p className="text-sm text-muted-foreground">
          No matches for this query. Adjust filters or try different keywords.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-4" aria-label="Search results">
      {list.map((hit) => {
        const key = rowKey(hit);
        return (
          <li key={key}>
            <SearchResultRow
              hit={hit}
              selected={selectedKey === key}
              highlighted={highlightedKeys.has(key)}
              onSelect={() => onSelect(hit)}
              onToggleHighlight={() => onToggleHighlight(key)}
              onCopyLink={() => onCopyLink(hit)}
            />
          </li>
        );
      })}
    </ul>
  );
}
