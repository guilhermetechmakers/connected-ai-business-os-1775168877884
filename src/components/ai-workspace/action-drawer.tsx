import { Bot, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { AiPermittedAction } from "@/types/ai";

export function ActionDrawer({
  open,
  onOpenChange,
  suggestedIds,
  permittedActions,
  onPickAction,
  triggerClassName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  suggestedIds: string[];
  permittedActions: AiPermittedAction[];
  onPickAction: (a: AiPermittedAction) => void;
  triggerClassName?: string;
}) {
  const permitted = Array.isArray(permittedActions) ? permittedActions : [];
  const suggested = Array.isArray(suggestedIds) ? suggestedIds : [];
  const suggestedSet = new Set(suggested);

  const suggestedActions = permitted.filter((a) => suggestedSet.has(a.id));
  const otherActions = permitted.filter((a) => !suggestedSet.has(a.id));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "gap-2 border-primary/20 transition-transform duration-150 hover:scale-[1.02]",
            triggerClassName,
          )}
        >
          <Bot className="h-4 w-4 text-primary" aria-hidden />
          Action drawer
          {suggested.length > 0 ? (
            <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
              {suggested.length}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent className="border-border/80 bg-card w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display">Permissioned actions</SheetTitle>
          <SheetDescription>
            Suggested ids come from the current mode and your role. Sensitive operations require confirmation
            in the dialog.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          {suggestedActions.length > 0 ? (
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-success">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                Suggested for this session
              </p>
              <ul className="space-y-2">
                {suggestedActions.map((a) => (
                  <li key={a.id}>
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-auto min-h-11 w-full justify-start whitespace-normal py-2 text-left text-xs"
                      onClick={() => {
                        onPickAction(a);
                        onOpenChange(false);
                      }}
                    >
                      {a.label}
                      {a.requiresConfirmation ? (
                        <span className="ml-2 text-[10px] text-success">● confirm</span>
                      ) : null}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              All permitted
            </p>
            <ul className="space-y-2">
              {otherActions.length === 0 && suggestedActions.length === 0 ? (
                <li className="text-sm text-muted-foreground">No actions for your role.</li>
              ) : null}
              {otherActions.map((a) => (
                <li key={a.id}>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto min-h-11 w-full justify-start whitespace-normal py-2 text-left text-xs transition-transform duration-150 hover:scale-[1.01]"
                    onClick={() => {
                      onPickAction(a);
                      onOpenChange(false);
                    }}
                  >
                    {a.label}
                    {a.requiresConfirmation ? (
                      <span className="ml-2 text-[10px] text-success">● confirm</span>
                    ) : null}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
