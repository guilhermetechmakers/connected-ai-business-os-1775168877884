import { Check, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type DomainSuggestionsProps = {
  baseLabel: string;
  suggestions: string[];
  selected: string | undefined;
  onSelect: (domain: string) => void;
  isLoading: boolean;
  disabled?: boolean;
};

/**
 * Heuristic / API-backed domain chips for tenant DNS hints. All list access is guarded.
 */
export function DomainSuggestions({
  baseLabel,
  suggestions,
  selected,
  onSelect,
  isLoading,
  disabled,
}: DomainSuggestionsProps) {
  const list = Array.isArray(suggestions) ? suggestions : [];

  if (!baseLabel.trim() || baseLabel.trim().length < 2) {
    return (
      <p className="text-xs text-muted-foreground">
        Type a company name to see suggested workspace domains.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-wrap gap-2" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-9 w-40 rounded-full bg-surface-inner" />
        ))}
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No suggestions yet — enter a domain manually (letters, numbers, dots, hyphens).
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
        Suggested domains
      </p>
      <div className="flex flex-wrap gap-2" role="list">
        {list.map((d) => {
          const isSel = selected === d;
          return (
            <Button
              key={d}
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => onSelect(d)}
              className={cn(
                "rounded-full border-secondary/50 bg-surface-inner/80 text-xs transition-all duration-150",
                "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card",
                isSel && "border-primary/50 bg-primary/10 text-primary",
              )}
              role="listitem"
            >
              {isSel ? <Check className="mr-1 h-3.5 w-3.5" aria-hidden /> : null}
              {d}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
