import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { DepartmentOptionRow, ReportsCenterFilters } from "@/types/reports-center";

export interface UnifiedDataFilterBarProps {
  departments: DepartmentOptionRow[];
  value: ReportsCenterFilters;
  onChange: (next: ReportsCenterFilters) => void;
  className?: string;
}

export function UnifiedDataFilterBar({
  departments,
  value,
  onChange,
  className,
}: UnifiedDataFilterBarProps) {
  const [localSearch, setLocalSearch] = useState(value.search);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    setLocalSearch(value.search);
  }, [value.search]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      onChange({ ...valueRef.current, search: localSearch });
    }, 280);
    return () => window.clearTimeout(t);
  }, [localSearch, onChange]);

  const deptList = Array.isArray(departments) ? departments : [];

  return (
    <div
      className={cn(
        "grid gap-4 rounded-xl border border-[rgb(21,78,120)]/50 bg-[rgb(12,17,22)]/90 p-4 md:grid-cols-12 md:items-end",
        className,
      )}
      role="search"
      aria-label="Reports and data filters"
    >
      <div className="md:col-span-4">
        <Label htmlFor="reports-search" className="text-xs text-muted-foreground">
          Search
        </Label>
        <div className="relative mt-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="reports-search"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Report name…"
            className="bg-[rgb(12,17,22)] pl-9 transition-colors duration-150 focus-visible:ring-[rgb(154,208,255)]/40"
            aria-label="Search reports by name"
          />
        </div>
      </div>
      <div className="md:col-span-2">
        <Label className="text-xs text-muted-foreground">Department</Label>
        <Select
          value={value.departmentId ?? "all"}
          onValueChange={(v) =>
            onChange({
              ...value,
              departmentId: v === "all" ? null : v,
            })
          }
        >
          <SelectTrigger
            className="mt-1 bg-[rgb(12,17,22)] transition-colors duration-150"
            aria-label="Filter by department"
          >
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {deptList.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="md:col-span-2">
        <Label className="text-xs text-muted-foreground">Status</Label>
        <Select
          value={value.status ?? "all"}
          onValueChange={(v) =>
            onChange({
              ...value,
              status: v === "all" ? null : v,
            })
          }
        >
          <SelectTrigger
            className="mt-1 bg-[rgb(12,17,22)] transition-colors duration-150"
            aria-label="Filter by status"
          >
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="md:col-span-2">
        <Label htmlFor="tag-filter" className="text-xs text-muted-foreground">
          Tag
        </Label>
        <Input
          id="tag-filter"
          value={value.tag ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              tag: e.target.value.trim() ? e.target.value.trim() : null,
            })
          }
          placeholder="e.g. weekly"
          className="mt-1 bg-[rgb(12,17,22)] transition-colors duration-150"
          aria-label="Filter by tag"
        />
      </div>
      <div className="flex flex-col gap-1 md:col-span-2">
        <Label className="text-xs text-muted-foreground">Scope</Label>
        <Button
          type="button"
          variant={value.ownerOnly ? "default" : "outline"}
          size="sm"
          className={cn(
            "mt-1 transition-transform duration-150 hover:scale-[1.02]",
            value.ownerOnly && "bg-[rgb(0,210,122)] text-[rgb(8,16,23)] hover:bg-[rgb(0,210,122)]/90",
          )}
          onClick={() => onChange({ ...value, ownerOnly: !value.ownerOnly })}
          aria-pressed={value.ownerOnly}
          aria-label="Toggle my reports only"
        >
          My reports only
        </Button>
      </div>
    </div>
  );
}
