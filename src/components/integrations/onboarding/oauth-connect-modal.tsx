import { ExternalLink, Loader2, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProviderCatalogItem } from "@/types/integrations";

export interface OAuthConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: ProviderCatalogItem | null;
  isSubmitting: boolean;
  onContinue: () => void;
}

export function OAuthConnectModal({
  open,
  onOpenChange,
  provider,
  isSubmitting,
  onContinue,
}: OAuthConnectModalProps) {
  const name = provider?.name ?? "Provider";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/80 bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Connect {name}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            You will be redirected to the provider consent screen. OAuth credentials are managed
            server-side and never entered manually in this UI.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span>
            Redirects return to this setup page and finalize the connection automatically.
          </span>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="cta" disabled={isSubmitting} onClick={onContinue}>
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
            )}
            Continue to {name}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

