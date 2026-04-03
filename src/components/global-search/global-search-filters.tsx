import { Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { GlobalSearchFilters, GlobalSearchHitType } from "@/types/global-search";

const TYPE_OPTIONS: { id: GlobalSearchHitType; label: string }[] = [
  { id: "Entity", label: "Entities" },
  { id: "Document", label: "Documents" },
  { id: "Activity", label: "Activity" },
  { id: "Report", label: "Reports" },
];

const SOURCE_OPTIONS = [
  { id: "unified", label: "Unified layer" },
  { id: "google_drive", label: "Google Drive" },
  { id: "notion", label: "Notion" },
  { id: "uploads", label: "Uploads" },
  { id: "activity_log", label: "Activity log" },
  { id: "report_templates", label: "Reports" },
];

export type GlobalSearchFiltersProps = {
  filters: GlobalSearchFilters;
  onChange: (next: GlobalSearchFilters) => void;
  className?: string;
};

function FiltersForm({
  filters,
  onChange,
}: {
  filters: GlobalSearchFilters;
  onChange: (next: GlobalSearchFilters) => void;
}) {
  const types = filters.types ?? [];
  const sources = filters.sources ?? [];
  const toggleType = (id: GlobalSearchHitType) => {
    const set = new Set(types);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange({ ...filters, types: [...set] });
  };

  const toggleSource = (id: string) => {
    const set = new Set(sources);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange({ ...filters, sources: [...set] });
  };

  return (
    <div className="space-y-6" role="region" aria-label="Search filters">
      <fieldset className="space-y-3">
        <legend className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Result type
        </legend>
        <div className="grid grid-cols-2 gap-3">
          {TYPE_OPTIONS.map((opt) => (
            <label
              key={opt.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-surface-inner/60 px-3 py-2 transition-colors duration-150 hover:border-primary/30"
            >
              <Checkbox
                checked={types.includes(opt.id)}
                onCheckedChange={() => toggleType(opt.id)}
                aria-label={opt.label}
              />
              <span className="text-sm text-foreground">{opt.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Source
        </legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SOURCE_OPTIONS.map((opt) => (
            <label
              key={opt.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-surface-inner/60 px-3 py-2"
            >
              <Checkbox
                checked={sources.includes(opt.id)}
                onCheckedChange={() => toggleSource(opt.id)}
                aria-label={opt.label}
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="search-dept" className="text-xs text-muted-foreground">
            Department ID (UUID)
          </Label>
          <Input
            id="search-dept"
            value={filters.departmentId ?? ""}
            onChange={(e) =>
              onChange({
                ...filters,
                departmentId: e.target.value || undefined,
              })
            }
            placeholder="Optional"
            className="bg-surface-inner"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="search-owner" className="text-xs text-muted-foreground">
            Owner contains
          </Label>
          <Input
            id="search-owner"
            value={filters.owner ?? ""}
            onChange={(e) =>
              onChange({ ...filters, owner: e.target.value || undefined })
            }
            placeholder="Email or name fragment"
            className="bg-surface-inner"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="search-df" className="text-xs text-muted-foreground">
            Date from
          </Label>
          <Input
            id="search-df"
            type="date"
            value={filters.dateFrom ?? ""}
            onChange={(e) =>
              onChange({ ...filters, dateFrom: e.target.value || undefined })
            }
            className="bg-surface-inner"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="search-dt" className="text-xs text-muted-foreground">
            Date to
          </Label>
          <Input
            id="search-dt"
            type="date"
            value={filters.dateTo ?? ""}
            onChange={(e) =>
              onChange({ ...filters, dateTo: e.target.value || undefined })
            }
            className="bg-surface-inner"
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-surface-inner/60 px-3 py-2">
        <Checkbox
          checked={filters.permissionScope === "restricted"}
          onCheckedChange={(c) =>
            onChange({
              ...filters,
              permissionScope: c === true ? "restricted" : undefined,
            })
          }
          aria-label="Show only permission-restricted documents"
        />
        <span className="text-sm">Restricted permission scope only</span>
      </label>
    </div>
  );
}

export function GlobalSearchFilters({ filters, onChange, className }: GlobalSearchFiltersProps) {
  return (
    <>
      <aside
        className={cn(
          "hidden w-full max-w-sm shrink-0 rounded-2xl border border-border/70 bg-card/90 p-6 shadow-card lg:block",
          className,
        )}
      >
        <p className="mb-4 text-sm font-semibold text-foreground">Filters</p>
        <FiltersForm filters={filters} onChange={onChange} />
      </aside>

      <div className="lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 border-border/70"
              aria-label="Open search filters"
            >
              <Filter className="h-4 w-4" />
              Filters
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-full border-border/80 bg-card sm:max-w-md"
          >
            <SheetHeader>
              <SheetTitle>Search filters</SheetTitle>
            </SheetHeader>
            <div className="mt-6 px-1">
              <FiltersForm filters={filters} onChange={onChange} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
