import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { AiPermittedAction } from "@/types/ai";

type ExecuteFn = (params: {
  actionId: string;
  confirmed: boolean;
  conversationId?: string;
}) => Promise<{ ok: boolean }>;

export function ActionConfirmDialog({
  action,
  open,
  onOpenChange,
  conversationId,
  executeAction,
  onSuccess,
}: {
  action: AiPermittedAction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId?: string;
  executeAction: ExecuteFn;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const run = async (confirmed: boolean) => {
    if (!action) return;
    setLoading(true);
    try {
      await executeAction({
        actionId: action.id,
        confirmed,
        conversationId,
      });
      toast.success(confirmed ? "Action executed" : "Action queued for confirmation");
      onSuccess();
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Action failed";
      if (msg.includes("Confirmation required") || msg.includes("409")) {
        toast.message("Confirmation required", {
          description: "Use confirm for sensitive actions.",
        });
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-border/80 bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle>{action?.label ?? "Action"}</AlertDialogTitle>
          <AlertDialogDescription>
            {action?.requiresConfirmation
              ? "This action can change connected systems. Confirm only if you intend to proceed."
              : "Run this permitted action for your tenant?"}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          {action?.requiresConfirmation ? (
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant="cta"
                disabled={loading}
                className="transition-transform duration-150 hover:scale-[1.02]"
                onClick={(ev) => {
                  ev.preventDefault();
                  void run(true);
                }}
              >
                {loading ? "Running…" : "Confirm & run"}
              </Button>
            </AlertDialogAction>
          ) : (
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant="cta"
                disabled={loading}
                onClick={(ev) => {
                  ev.preventDefault();
                  void run(true);
                }}
              >
                {loading ? "Running…" : "Run"}
              </Button>
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
