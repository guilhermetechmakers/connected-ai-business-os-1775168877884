import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Link2Off, Shield } from "lucide-react";
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
import { invokeAuthApi } from "@/lib/auth-api";

export type ExternalAccountRow = {
  id: string;
  provider: string;
  linked_at: string;
  last_used_at?: string | null;
  revoked?: boolean;
};

export function ConnectedAccountsPanel({
  accounts,
  onChanged,
  disabled,
}: {
  accounts: ExternalAccountRow[];
  onChanged: () => Promise<void>;
  disabled?: boolean;
}) {
  const list = Array.isArray(accounts) ? accounts : [];
  const active = list.filter((a) => a.revoked !== true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const disconnectMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      await invokeAuthApi<{ ok: boolean }>({
        op: "connections.disconnect",
        connectionId,
      });
    },
    onSuccess: async () => {
      toast.success("Connection disconnected");
      setPendingId(null);
      await onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Shield className="h-3.5 w-3.5 text-primary" aria-hidden />
        Connected accounts
      </p>
      {active.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No SSO or OAuth rows linked yet. Use the SSO linking panel to connect Google or Microsoft.
        </p>
      ) : (
        <ul className="space-y-2">
          {active.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-surface-inner/40 px-3 py-2 transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/30"
            >
              <div>
                <p className="font-medium capitalize text-foreground">{a.provider}</p>
                <p className="text-xs text-muted-foreground">
                  Linked {format(new Date(a.linked_at), "PP")}
                  {a.last_used_at
                    ? ` · Last used ${format(new Date(a.last_used_at), "PP")}`
                    : ""}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || disconnectMutation.isPending}
                className="gap-1"
                aria-label={`Disconnect ${a.provider} account`}
                onClick={() => setPendingId(a.id)}
              >
                <Link2Off className="h-3.5 w-3.5" aria-hidden />
                Disconnect
              </Button>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={pendingId !== null} onOpenChange={(o) => !o && setPendingId(null)}>
        <AlertDialogContent className="border-border/80 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect account?</AlertDialogTitle>
            <AlertDialogDescription>
              You may need to sign in with password or re-link this provider to use it again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingId) disconnectMutation.mutate(pendingId);
              }}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
