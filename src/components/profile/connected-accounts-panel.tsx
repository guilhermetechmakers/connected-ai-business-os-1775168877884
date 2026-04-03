import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Link2Off, Shield } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { unlinkSsoProvider } from "@/lib/profile-api";

export type ExternalAccountRow = {
  id: string;
  provider: string;
  linked_at: string;
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

  const unlinkMutation = useMutation({
    mutationFn: async (provider: ExternalAccountRow["provider"]) => {
      await unlinkSsoProvider(
        provider as "google" | "microsoft" | "saml" | "oidc",
      );
    },
    onSuccess: async () => {
      toast.success("Connection removed");
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
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No SSO or OAuth rows linked yet. Use the SSO linking panel to connect Google or Microsoft.
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-surface-inner/40 px-3 py-2 transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/30"
            >
              <div>
                <p className="font-medium capitalize text-foreground">{a.provider}</p>
                <p className="text-xs text-muted-foreground">
                  Linked {format(new Date(a.linked_at), "PP")}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || unlinkMutation.isPending}
                className="gap-1"
                onClick={() => unlinkMutation.mutate(a.provider)}
              >
                <Link2Off className="h-3.5 w-3.5" aria-hidden />
                Unlink
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
