import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { AiChatMode } from "@/types/ai";

const MODES: AiChatMode[] = ["Ask", "Analyze", "Report", "Action"];

export function ModeSwitch({
  value,
  onValueChange,
  className,
}: {
  value: AiChatMode;
  onValueChange: (mode: AiChatMode) => void;
  className?: string;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => {
        if (v) onValueChange(v as AiChatMode);
      }}
      className={cn("justify-end bg-surface-inner p-1 rounded-lg", className)}
      aria-label="AI workspace mode"
    >
      {MODES.map((m) => (
        <ToggleGroupItem
          key={m}
          value={m}
          className="px-3 text-xs transition-transform duration-150 data-[state=on]:ring-1 data-[state=on]:ring-primary/25"
        >
          {m}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export { MODES as AI_WORKSPACE_MODES };
