import { ChevronDown, Filter } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { fetchTenantDepartmentsDirectory } from "@/lib/department-workspace-api";
import { isSupabaseConfigured } from "@/lib/supabase";
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
  { id: "gmail", label: "Gmail" },
  { id: "google_calendar", label: "Google Calendar" },
  { id: "hubspot", label: "HubSpot" },
  { id: "quickbooks", label: "QuickBooks" },
  { id: "slack", label: "Slack" },
  { id: "uploads", label: "Uploads" },
  { id: "activity_log", label: "Activity log" },
  { id: "report_templates", label: "Reports" },
];

function FiltersInner({
  filters,
  onChange,
  departmentRows,
}: {
  filters: GlobalSearchFilters;
  onChange: (next: GlobalSearchFilters) => void;
  departmentRows: { id: string; name: string }[];
}) {
  const types = filters.types ?? [];
  const sources = filters.sources ?? [];
  const departmentIds = filters.departmentIds ?? [];
  const ownerFrags = filters.owners ?? [];

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

  const toggleDepartment = (id: string) => {
    const set = new Set(departmentIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange({
      ...filters,
      departmentIds: [...set],
      departmentId: undefined,
    });
  };

  const toggleOwnerFrag = (frag: string) => {
    const set = new Set(ownerFrags);
    if (set.has(frag)) set.delete(frag);
    else set.add(frag);
    onChange({ ...filters, owners: [...set] });
  };

  return (
    <div className="space-y-6" role="region" aria-label="Search filters">
      <div className="flex items-center justify-between rounded-lg border border-border/60 bg-surface-inner/50 px-3 py-2">
        <div className="space-y-0.5">
          <Label htmlFor="ai-summarize-toggle" className="text-sm text-foreground">
            AI summarize (preview)
          </Label>
          <p className="text-[10px] text-muted-foreground">
            When on, selecting a result opens AI-assisted preview by default.
          </p>
        </div>
        <Switch
          id="ai-summarize-toggle"
          checked={filters.aiSummarize === true}
          onCheckedChange={(c) =>
            onChange({ ...filters, aiSummarize: c ? true : undefined })
          }
          aria-label="Toggle AI summarize on result selection"
        />
      </div>

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

      <fieldset className="space-y-3">
        <legend className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Departments
        </legend>
        {departmentRows.length === 0 ? (
          <p className="text-xs text-muted-foreground">No departments loaded.</p>
        ) : (
          <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
            {departmentRows.map((d) => (
              <label
                key={d.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-surface-inner/60 px-3 py-2"
              >
                <Checkbox
                  checked={departmentIds.includes(d.id)}
                  onCheckedChange={() => toggleDepartment(d.id)}
                  aria-label={d.name}
                />
                <span className="truncate text-sm">{d.name}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="search-owner-frags" className="text-xs text-muted-foreground">
            Owner contains (add fragments)
          </Label>
          <div className="flex flex-wrap gap-2">
            {(["lead", "admin", "exec"] as const).map((frag) => (
              <Button
                key={frag}
                type="button"
                size="sm"
                variant={ownerFrags.includes(frag) ? "secondary" : "outline"}
                className="h-8 text-xs"
                onClick={() => toggleOwnerFrag(frag)}
              >
                {frag}
              </Button>
            ))}
          </div>
          <Input
            id="search-owner-frags"
            value={filters.owner ?? ""}
            onChange={(e) =>
              onChange({ ...filters, owner: e.target.value || undefined })
            }
            placeholder="Or type a custom substring"
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

export type SearchFilterPanelProps = {
  filters: GlobalSearchFilters;
  onChange: (next: GlobalSearchFilters) => void;
  className?: string;
};

export function SearchFilterPanel({ filters, onChange, className }: SearchFilterPanelProps) {
  const { data: deptRaw = [] } = useQuery({
    queryKey: ["tenant-departments-directory", "search-filters"],
    queryFn: fetchTenantDepartmentsDirectory,
    enabled: isSupabaseConfigured,
    staleTime: 60_000,
  });
  const departmentRows = (Array.isArray(deptRaw) ? deptRaw : []).map((d) => ({
    id: d.id,
    name: typeof d.name === "string" ? d.name : d.id,
  }));

  const panel = (
    <FiltersInner
      filters={filters}
      onChange={onChange}
      departmentRows={departmentRows}
    />
  );

  return (
    <>
      <aside
        className={cn(
          "hidden w-full max-w-sm shrink-0 lg:block",
          className,
        )}
      >
        <Collapsible defaultOpen className="rounded-2xl border border-border/70 bg-card/90 shadow-card">
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="flex h-12 w-full items-center justify-between rounded-t-2xl border-b border-border/60 px-4 text-left font-semibold text-foreground hover:bg-muted/40 data-[state=open]:[&>svg:last-child]:rotate-180"
              aria-expanded
            >
              <span className="flex items-center gap-2 text-sm">
                <Filter className="h-4 w-4 text-primary" />
                Filters
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="px-4 py-4 motion-reduce:transition-none data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            {panel}
          </CollapsibleContent>
        </Collapsible>
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
            <div className="mt-6 max-h-[calc(100vh-8rem)] overflow-y-auto px-1">
              {panel}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
