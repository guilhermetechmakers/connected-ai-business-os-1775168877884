import { Bot, ListTodo, Workflow } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type QuickActionsBarProps = {
  className?: string;
};

export function QuickActionsBar({ className }: QuickActionsBarProps) {
  return (
    <div
      className={cn("flex flex-wrap items-center justify-end gap-2", className)}
      role="toolbar"
      aria-label="Quick actions"
    >
      <Button
        variant="outline"
        size="sm"
        className="gap-2 rounded-full border-border/70 transition-transform duration-150 hover:scale-[1.02] motion-reduce:hover:scale-100"
        asChild
      >
        <Link to="/dashboard/departments">
          <ListTodo className="h-4 w-4" aria-hidden />
          New task
        </Link>
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 rounded-full border-border/70 transition-transform duration-150 hover:scale-[1.02] motion-reduce:hover:scale-100"
        asChild
      >
        <Link to="/chat">
          <Bot className="h-4 w-4" aria-hidden />
          Open AI assistant
        </Link>
      </Button>
      <Button
        variant="cta"
        size="sm"
        className="gap-2 rounded-full transition-transform duration-150 hover:scale-[1.02] motion-reduce:hover:scale-100"
        asChild
      >
        <Link to="/dashboard/workflows">
          <Workflow className="h-4 w-4" aria-hidden />
          Start workflow
        </Link>
      </Button>
    </div>
  );
}
