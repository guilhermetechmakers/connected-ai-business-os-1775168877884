import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface DepartmentRowProps {
  value: string;
  index: number;
  onChange: (value: string) => void;
  onRemove: () => void;
  canRemove: boolean;
  className?: string;
}

export function DepartmentRow({
  value,
  index,
  onChange,
  onRemove,
  canRemove,
  className,
}: DepartmentRowProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-surface-inner/60 p-2 transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md",
        className,
      )}
    >
      <span className="w-8 shrink-0 text-center text-xs text-muted-foreground">
        {index + 1}
      </span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Department name"
        className="min-w-[12rem] flex-1 border-border/60 bg-input"
        aria-label={`Department ${index + 1} name`}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={!canRemove}
        onClick={onRemove}
        aria-label={`Remove department ${index + 1}`}
        className="shrink-0 text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
