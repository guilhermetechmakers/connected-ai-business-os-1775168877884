import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export type RunConfigValues = {
  testMode: boolean;
  correlationId: string;
  inputPayload: Record<string, unknown>;
};

export type WorkflowRunConfiguratorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  onConfirm: (values: RunConfigValues) => void;
  isLoading?: boolean;
};

export function WorkflowRunConfigurator({
  open,
  onOpenChange,
  title = "Configure run",
  onConfirm,
  isLoading,
}: WorkflowRunConfiguratorProps) {
  const [testMode, setTestMode] = useState(true);
  const [correlationId, setCorrelationId] = useState("");
  const [jsonRaw, setJsonRaw] = useState("{}");
  const [jsonError, setJsonError] = useState<string | null>(null);

  function handleSubmit() {
    let inputPayload: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(jsonRaw || "{}") as unknown;
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        inputPayload = parsed as Record<string, unknown>;
      } else {
        setJsonError("Input payload must be a JSON object.");
        return;
      }
      setJsonError(null);
    } catch {
      setJsonError("Invalid JSON.");
      return;
    }
    onConfirm({
      testMode,
      correlationId: correlationId.trim(),
      inputPayload,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/80 bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-surface-inner/50 px-3 py-2">
            <Label htmlFor="run-test" className="text-sm font-normal">
              Test mode (sandbox)
            </Label>
            <Switch
              id="run-test"
              checked={testMode}
              onCheckedChange={(v) => setTestMode(Boolean(v))}
              aria-label="Test mode"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="corr">Correlation id (optional)</Label>
            <Input
              id="corr"
              value={correlationId}
              onChange={(e) => setCorrelationId(e.target.value)}
              placeholder="e.g. ticket-4821"
              className="border-border/60 bg-input font-mono text-sm"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payload">Input payload (JSON object)</Label>
            <Textarea
              id="payload"
              value={jsonRaw}
              onChange={(e) => {
                setJsonRaw(e.target.value);
                setJsonError(null);
              }}
              rows={6}
              className="border-border/60 bg-input font-mono text-xs"
              spellCheck={false}
              aria-invalid={Boolean(jsonError)}
            />
            {jsonError ? (
              <p className="text-xs text-destructive" role="alert">
                {jsonError}
              </p>
            ) : null}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button
            type="button"
            variant="cta"
            disabled={isLoading}
            onClick={() => handleSubmit()}
          >
            {isLoading ? "Starting…" : "Start run"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
