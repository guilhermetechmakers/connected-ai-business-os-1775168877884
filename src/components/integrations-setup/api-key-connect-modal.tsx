import { KeyRound, Loader2 } from "lucide-react";
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

export type ApiKeyConnectModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerName: string;
  onTest: (apiKey: string) => Promise<{ ok: boolean; message?: string }>;
  onSave: (apiKey: string) => void;
  isSaving?: boolean;
};

export function ApiKeyConnectModal({
  open,
  onOpenChange,
  providerName,
  onTest,
  onSave,
  isSaving = false,
}: ApiKeyConnectModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [testHint, setTestHint] = useState<string | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestHint(null);
    try {
      const res = await onTest(apiKey.trim());
      setTestHint(
        res.ok ? "Connection test passed (stub validation)." : res.message ?? "Test failed",
      );
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/60 bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <KeyRound className="h-5 w-5 text-primary" aria-hidden />
            API key · {providerName}
          </DialogTitle>
          <DialogDescription>
            Keys are encrypted at rest. Nothing sensitive appears in sync logs.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="integration-api-key">API key or token</Label>
          <Input
            id="integration-api-key"
            type="password"
            className="bg-surface-inner"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
        {testHint ? (
          <p className="text-sm text-muted-foreground" role="status">
            {testHint}
          </p>
        ) : null}
        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-primary/35"
            onClick={() => void handleTest()}
            disabled={testing || !apiKey.trim()}
          >
            {testing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            Test connection
          </Button>
          <Button
            type="button"
            variant="cta"
            className="transition-transform duration-150 hover:scale-[1.02]"
            disabled={isSaving || !apiKey.trim()}
            onClick={() => onSave(apiKey.trim())}
          >
            {isSaving && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            )}
            Save securely
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
