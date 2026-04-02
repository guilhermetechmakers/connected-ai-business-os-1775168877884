import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type FilterChip = {
  id: string;
  label: string;
};

export type FilterChipsProps = {
  options: FilterChip[];
  selected: string[];
  onChange: (next: string[]) => void;
  className?: string;
};

export function FilterChips({
  options,
  selected,
  onChange,
  className,
}: FilterChipsProps) {
  const safeOptions = Array.isArray(options) ? options : [];
  const safeSelected = Array.isArray(selected) ? selected : [];

  function toggle(id: string) {
    const set = new Set(safeSelected);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange([...set]);
  }

  return (
    <div
      className={cn("flex flex-wrap gap-2", className)}
      role="group"
      aria-label="Entity type filters"
    >
      {safeOptions.map((o) => {
        const active = safeSelected.includes(o.id);
        return (
          <Button
            key={o.id}
            type="button"
            size="sm"
            variant={active ? "default" : "outline"}
            className={cn(
              "h-8 rounded-full px-3 text-xs transition-transform duration-150",
              active && "bg-primary/90 text-primary-foreground",
            )}
            onClick={() => toggle(o.id)}
            aria-pressed={active}
          >
            {o.label}
          </Button>
        );
      })}
      {safeSelected.length > 0 ? (
        <Badge variant="secondary" className="h-8 rounded-full px-2 text-[10px]">
          {safeSelected.length} filters
        </Badge>
      ) : null}
    </div>
  );
}
