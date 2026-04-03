import { Loader2, Search } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-unified-data";
import { useSearchAutosuggest } from "@/hooks/use-global-search";
import { cn } from "@/lib/utils";

export interface GlobalSearchBarProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  variant?: "hero" | "compact";
  showSuggestions?: boolean;
  className?: string;
  "aria-label"?: string;
}

export const GlobalSearchBar = forwardRef<HTMLInputElement, GlobalSearchBarProps>(
  function GlobalSearchBar(
    {
      value,
      onChange,
      onSubmit,
      placeholder = "Search entities, documents, activity, reports…",
      variant = "compact",
      showSuggestions = true,
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
        if (e.key === "/" && document.activeElement?.tagName !== "INPUT" &&
          document.activeElement?.tagName !== "TEXTAREA") {
          const t = e.target as HTMLElement | null;
          if (t?.isContentEditable) return;
          e.preventDefault();
          const el = typeof ref !== "function" && ref?.current
            ? ref.current
            : (containerRef.current?.querySelector("input") as HTMLInputElement | null);
          el?.focus();
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
          e.preventDefault();
          const el = typeof ref !== "function" && ref?.current
            ? ref.current
            : (containerRef.current?.querySelector("input") as HTMLInputElement | null);
          el?.focus();
        }
      }
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [ref]);

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showSuggestions || suggestions.length === 0) {
        if (e.key === "Enter") {
          e.preventDefault();
          onSubmit();
        }
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
        setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (open && highlight >= 0 && suggestions[highlight]) {
          onChange(suggestions[highlight].text);
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
          className={cn(
            "flex gap-2 rounded-xl border border-border/60 bg-surface-inner/90 p-1 shadow-inner transition-all duration-150",
            "focus-within:ring-2 focus-within:ring-primary/20",
            variant === "hero" && "p-2 md:p-3",
            "motion-reduce:transition-none",
          )}
        >
          <Search
            className="mt-2.5 h-5 w-5 shrink-0 text-muted-foreground motion-reduce:animate-none"
            aria-hidden
          />
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
            aria-expanded={open && showSuggestions && suggestions.length > 0}
            aria-controls={listId}
            className={cn(
              "border-0 bg-transparent text-base shadow-none focus-visible:ring-0 md:text-base",
              variant === "hero" && "h-12 text-lg",
            )}
          />
          {isFetching ? (
            <Loader2
              className="mt-2.5 h-5 w-5 shrink-0 animate-spin text-primary motion-reduce:animate-none"
              aria-hidden
            />
          ) : null}
          <Button
            type="button"
            variant="cta"
            className="shrink-0 transition-transform duration-150 hover:scale-[1.02] motion-reduce:transition-none motion-reduce:hover:scale-100"
            onClick={() => {
              onSubmit();
              close();
            }}
          >
            Search
          </Button>
        </div>
        {showSuggestions && open && suggestions.length > 0 ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-50 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-border/60 bg-card py-1 shadow-lg animate-in fade-in-0 zoom-in-95 duration-150 motion-reduce:animate-none"
          >
            {(suggestions ?? []).map((s, i) => (
              <li key={`${s.type}-${s.text}-${i}`} role="presentation">
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
            ))}
          </ul>
        ) : null}
        <p className="mt-1 text-[10px] text-muted-foreground motion-reduce:opacity-100">
          <kbd className="rounded border border-border/60 px-1">/</kbd> or{" "}
          <kbd className="rounded border border-border/60 px-1">⌘K</kbd> to focus
        </p>
      </div>
    );
  },
);
