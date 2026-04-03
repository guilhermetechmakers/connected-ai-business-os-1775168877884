import { Bot } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DepartmentAIAccessorButtonProps = {
  departmentName: string;
  disabled?: boolean;
  onOpen: () => void;
  className?: string;
};

export function DepartmentAIAccessorButton({
  departmentName,
  disabled,
  onOpen,
  className,
}: DepartmentAIAccessorButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={onOpen}
      className={cn(
        "min-h-11 border-[rgb(21_78_120/0.5)] transition-all duration-150",
        "hover:border-[rgb(154_208_255/0.4)] hover:bg-muted/40 hover:shadow-[0_0_16px_rgb(154_208_255/0.08)]",
        "motion-reduce:transition-none",
        className,
      )}
      aria-label={`Open AI assistant for ${departmentName}`}
    >
      <Bot className="mr-1.5 h-4 w-4 text-[rgb(154_208_255)]" aria-hidden />
      AI assistant
    </Button>
  );
}
