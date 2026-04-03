import { Loader2, Search } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-unified-data";
import { useSearchAutosuggest } from "@/hooks/use-global-search";
import { cn } from "@/lib/utils";
import type { SearchAutosuggestItem } from "@/types/global-search";

const GROUP_ORDER = ["Entities", "Documents", "Activities", "Reports"] as const;

function categoryForSuggestType(type: string): (typeof GROUP_ORDER)[number] {
  if (type === "Document") return "Documents";
  if (type === "Activity") return "Activities";
  if (type === "Report") return "Reports";
  return "Entities";
}

function groupSuggestions(items: SearchAutosuggestItem[]): Map<string, SearchAutosuggestItem[]> {
  const map = new Map<string, SearchAutosuggestItem[]>();
  for (const g of GROUP_ORDER) map.set(g, []);
  const list = Array.isArray(items) ? items : [];
  for (const s of list) {
    const cat = categoryForSuggestType(typeof s.type === "string" ? s.type : "");
    const bucket = map.get(cat);
    if (bucket) bucket.push(s);
  }
  return map;
}

export type SearchHeaderProps = {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
};

export const SearchHeader = forwardRef<HTMLInputElement, SearchHeaderProps>(
  function SearchHeader(
    {
      value,
      onChange,
      onSubmit,
      placeholder = "Search entities, documents, activity, reports…",
      className,
      "aria-label": ariaLabel = "Global search",
    },
    ref,
  ) {
    const listId = useId();
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const suggestDebounced = useDebouncedValue(value, 120);
    const { data: rawSuggestions = [], isFetching } = useSearchAutosuggest(suggestDebounced);
    const suggestions = Array.isArray(rawSuggestions) ? rawSuggestions : [];
    const grouped = useMemo(() => groupSuggestions(suggestions), [suggestions]);
    const flatForKeys = useMemo(() => {
      const out: { item: SearchAutosuggestItem; group: string; idx: number }[] = [];
      let i = 0;
      for (const g of GROUP_ORDER) {
        const chunk = grouped.get(g) ?? [];
        for (const item of chunk) {
          out.push({ item, group: g, idx: i });
          i += 1;
        }
      }
      return out;
    }, [grouped]);

    const close = useCallback(() => {
      setOpen(false);
      setHighlight(-1);
    }, []);

    useEffect(() => {
      function onDocClick(e: MouseEvent) {
        if (!containerRef.current?.contains(e.target as Node)) close();
      }
      document.addEventListener("mousedown", onDocClick);
      return () => document.removeEventListener("mousedown", onDocClick);
    }, [close]);

    useEffect(() => {
      function onKey(e: KeyboardEvent) {
        if (
          e.key === "/" &&
          document.activeElement?.tagName !== "INPUT" &&
          document.activeElement?.tagName !== "TEXTAREA"
        ) {
          const t = e.target as HTMLElement | null;
          if (t?.isContentEditable) return;
          e.preventDefault();
          const el =
            typeof ref !== "function" && ref?.current
              ? ref.current
              : (containerRef.current?.querySelector("input") as HTMLInputElement | null);
          el?.focus();
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
          e.preventDefault();
          const el =
            typeof ref !== "function" && ref?.current
              ? ref.current
              : (containerRef.current?.querySelector("input") as HTMLInputElement | null);
          el?.focus();
        }
      }
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [ref]);

    const total = flatForKeys.length;
    const hasSuggestions = total > 0;

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (total === 0) {
        if (e.key === "Enter") {
          e.preventDefault();
          onSubmit();
        }
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
        setHighlight((h) => Math.min(h + 1, total - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const pick = highlight >= 0 ? flatForKeys[highlight] : undefined;
        if (open && pick) {
          onChange(pick.item.text);
          close();
        }
        onSubmit();
      } else if (e.key === "Escape") {
        close();
      }
    };

    return (
      <div ref={containerRef} className={cn("relative w-full", className)}>
        <div
          role="search"
          className={cn(
            "flex gap-2 rounded-xl border border-border/60 bg-surface-inner/90 p-2 shadow-inner transition-all duration-150",
            "focus-within:ring-2 focus-within:ring-primary/20 motion-reduce:transition-none md:p-3",
          )}
        >
          <Search className="mt-3 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <Input
            ref={ref}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setOpen(true);
              setHighlight(-1);
            }}
            onFocus={() => value.trim().length >= 1 && setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            aria-label={ariaLabel}
            aria-autocomplete="list"
            aria-expanded={open && hasSuggestions}
            aria-controls={listId}
            className="h-12 border-0 bg-transparent text-base shadow-none focus-visible:ring-0 md:text-lg"
          />
          {isFetching ? (
            <Loader2
              className="mt-3 h-5 w-5 shrink-0 animate-spin text-primary motion-reduce:animate-none"
              aria-hidden
            />
          ) : null}
          <Button
            type="button"
            variant="cta"
            className="mt-1 shrink-0 self-start transition-transform duration-150 hover:scale-[1.02] motion-reduce:transition-none motion-reduce:hover:scale-100"
            onClick={() => {
              onSubmit();
              close();
            }}
          >
            Search
          </Button>
        </div>
        {open && hasSuggestions ? (
          <div
            id={listId}
            role="listbox"
            aria-label="Search suggestions by category"
            className="absolute z-50 mt-2 max-h-80 w-full overflow-auto rounded-xl border border-border/60 bg-card py-2 shadow-lg animate-in fade-in-0 zoom-in-95 duration-150 motion-reduce:animate-none"
          >
            {(() => {
              let running = 0;
              return GROUP_ORDER.map((group) => {
                const chunk = grouped.get(group) ?? [];
                if (chunk.length === 0) return null;
                const nodes = chunk.map((s) => {
                  const i = running;
                  running += 1;
                  return (
                    <li key={`${group}-${s.text}-${s.type}-${i}`} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={i === highlight}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors duration-150",
                          i === highlight ? "bg-primary/10 text-primary" : "hover:bg-muted/50",
                        )}
                        onMouseEnter={() => setHighlight(i)}
                        onClick={() => {
                          onChange(s.text);
                          close();
                          onSubmit();
                        }}
                      >
                        <span className="truncate">{s.text}</span>
                        <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                          {s.type}
                        </span>
                      </button>
                    </li>
                  );
                });
                return (
                  <div key={group} role="group" aria-label={group}>
                    <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-primary">
                      {group}
                    </p>
                    <ul className="space-y-0.5">{nodes}</ul>
                  </div>
                );
              });
            })()}
          </div>
        ) : null}
        <p className="mt-1 text-[10px] text-muted-foreground">
          <kbd className="rounded border border-border/60 px-1">/</kbd> or{" "}
          <kbd className="rounded border border-border/60 px-1">⌘K</kbd> to focus · suggestions grouped by type
        </p>
      </div>
    );
  },
);
