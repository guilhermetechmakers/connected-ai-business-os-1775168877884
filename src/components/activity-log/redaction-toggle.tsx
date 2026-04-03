import { Eye, EyeOff } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type RedactionToggleProps = {
  canToggle: boolean;
  showRedacted: boolean;
  onShowRedactedChange: (value: boolean) => void;
  className?: string;
};

export function RedactionToggle({
  canToggle,
  showRedacted,
  onShowRedactedChange,
  className,
}: RedactionToggleProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-surface-inner/80 px-4 py-3",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {showRedacted ? (
          <EyeOff className="h-4 w-4 text-muted-foreground" aria-hidden />
        ) : (
          <Eye className="h-4 w-4 text-primary" aria-hidden />
        )}
        <div>
          <Label htmlFor="redaction-toggle" className="text-sm text-foreground">
            Redacted payload view
          </Label>
          <p className="text-xs text-muted-foreground">
            {canToggle
              ? "Toggle between full and redacted JSON for privileged roles."
              : "Your role receives redacted payloads only."}
          </p>
        </div>
      </div>
      <Switch
        id="redaction-toggle"
        checked={showRedacted}
        onCheckedChange={onShowRedactedChange}
        disabled={!canToggle}
        aria-label="Show redacted payload view"
      />
    </div>
  );
}
