import { Skeleton } from "@/components/ui/skeleton";
import type { UnifiedEntity } from "@/types/unified";
import { UnifiedEntityCard } from "@/components/unified-data/unified-entity-card";

export type ResultListProps = {
  results: UnifiedEntity[];
  isLoading?: boolean;
  onSelect?: (entity: UnifiedEntity) => void;
};

export function ResultList({ results, isLoading, onSelect }: ResultListProps) {
  const list = Array.isArray(results) ? results : [];

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading results">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No matches in the unified layer for this query and filter set.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {list.map((e) => (
        <li key={e.id}>
          <UnifiedEntityCard entity={e} onSelect={onSelect} />
        </li>
      ))}
    </ul>
  );
}
