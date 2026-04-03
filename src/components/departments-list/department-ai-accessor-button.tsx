import { Bot } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DepartmentAIAccessorButtonProps = {
  departmentName: string;
  aiAvailable: boolean;
  workspacePath: string;
  className?: string;
};

/** Opens the department workspace focused on the AI assistant tab (via router state). */
export function DepartmentAIAccessorButton({
  departmentName,
  aiAvailable,
  workspacePath,
  className,
}: DepartmentAIAccessorButtonProps) {
  if (!aiAvailable) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("min-h-11 flex-1", className)}
        disabled
        aria-label={`AI assistant unavailable for ${departmentName}`}
      >
        <Bot className="mr-2 h-4 w-4" aria-hidden />
        AI unavailable
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(
        "min-h-11 flex-1 border-secondary/60 transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md motion-reduce:transform-none",
        className,
      )}
      asChild
    >
      <Link
        to={`${workspacePath}?tab=ai`}
        aria-label={`Open AI assistant for ${departmentName}`}
      >
        <Bot className="mr-2 h-4 w-4" aria-hidden />
        Open AI
      </Link>
    </Button>
  );
}
