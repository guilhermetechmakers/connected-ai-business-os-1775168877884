import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Loader2, TestTube2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { ProviderCatalogItem } from "@/types/integrations";

const schema = z.object({
  api_key: z.string().min(8, "Enter a valid API key or token"),
});

export type ApiKeyConnectForm = z.infer<typeof schema>;

export interface ApiKeyConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: ProviderCatalogItem | null;
  connectorId: string | null;
  isSubmitting: boolean;
  isTesting: boolean;
  /** True after at least one successful credential save in this session. */
  canTestConnection: boolean;
  onTestConnection: () => void;
  onSave: (values: ApiKeyConnectForm) => void;
}

export function ApiKeyConnectModal({
  open,
  onOpenChange,
  provider,
  connectorId,
  isSubmitting,
  isTesting,
  canTestConnection,
  onTestConnection,
  onSave,
}: ApiKeyConnectModalProps) {
  const form = useForm<ApiKeyConnectForm>({
    resolver: zodResolver(schema),
    defaultValues: { api_key: "" },
  });

  const submit = form.handleSubmit((values) => {
    onSave(values);
  });

  const name = provider?.name ?? "Provider";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/80 bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">API key · {name}</DialogTitle>
          <DialogDescription>
            Keys are encrypted at rest. Test validates presence and shape locally—no third-party
            calls in this template.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface-inner px-3 py-2 text-xs text-muted-foreground">
          <KeyRound className="h-4 w-4 text-primary" aria-hidden />
          <span>Never commit keys to source control. Rotate if exposed.</span>
        </div>
        {!connectorId ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Preparing secure connector record…
          </p>
        ) : null}
        <Form {...form}>
          <form className="space-y-4" onSubmit={submit}>
            <FormField
              control={form.control}
              name="api_key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API key / token</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      className="bg-surface-inner"
                      autoComplete="off"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="outline"
                className="border-primary/35"
                disabled={!connectorId || !canTestConnection || isTesting}
                onClick={() => void onTestConnection()}
              >
                {isTesting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <TestTube2 className="mr-2 h-4 w-4" aria-hidden />
                )}
                Test connection
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="cta"
                  disabled={isSubmitting || !connectorId}
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  ) : null}
                  Save securely
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
