import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
};

export function SearchBar({
  value,
  onChange,
  placeholder = "Search unified entities…",
  className,
  id = "global-unified-search",
}: SearchBarProps) {
  return (
    <div className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 rounded-xl border-border/70 bg-surface-inner pl-10 pr-3 text-sm transition-shadow duration-150 focus-visible:ring-[rgba(154,208,255,0.18)]"
        aria-label="Search query"
        autoComplete="off"
      />
    </div>
  );
}
