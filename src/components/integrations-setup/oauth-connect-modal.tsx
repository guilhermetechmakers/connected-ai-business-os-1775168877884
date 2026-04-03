import { ExternalLink, Loader2, Shield } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type OAuthConnectModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerName: string;
  /** Simulated OAuth: optional app credentials for stub validation */
  onComplete: (payload: {
    client_id?: string;
    client_secret?: string;
    authorization_code: string;
  }) => void;
  isSubmitting?: boolean;
};

export function OAuthConnectModal({
  open,
  onOpenChange,
  providerName,
  onComplete,
  isSubmitting = false,
}: OAuthConnectModalProps) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  const handleSimulatedAuthorize = () => {
    onComplete({
      client_id: clientId.trim() || undefined,
      client_secret: clientSecret.trim() || undefined,
      authorization_code: `sim_${crypto.randomUUID().slice(0, 8)}`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/60 bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Connect {providerName}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            OAuth consent opens in a secure window. This template simulates the
            redirect and stores only encrypted credential references server-side.
          </DialogDescription>
        </DialogHeader>
        <div
          className="space-y-3 rounded-xl border border-border/50 bg-surface-inner/60 p-4"
          role="region"
          aria-label="OAuth simulation"
        >
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span>
              For local testing, optionally paste a provider app Client ID and
              secret — both are encrypted by the Edge Function.
            </span>
          </div>
          <div className="space-y-2">
            <Label htmlFor="oauth-client-id">Client ID (optional)</Label>
            <Input
              id="oauth-client-id"
              className="bg-background/80"
              autoComplete="off"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="oauth-client-secret">Client secret (optional)</Label>
            <Input
              id="oauth-client-secret"
              type="password"
              className="bg-background/80"
              autoComplete="off"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="cta"
            className="transition-transform duration-150 hover:scale-[1.02]"
            onClick={handleSimulatedAuthorize}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
            )}
            Simulate authorize
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
