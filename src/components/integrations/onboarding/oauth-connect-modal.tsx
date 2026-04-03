import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Lock, Shield } from "lucide-react";
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
  client_id: z.string().min(1, "Client ID is required"),
  client_secret: z.string().min(1, "Client secret is required"),
});

export type OAuthConnectForm = z.infer<typeof schema>;

export interface OAuthConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: ProviderCatalogItem | null;
  isSubmitting: boolean;
  onComplete: (values: OAuthConnectForm) => void;
}

export function OAuthConnectModal({
  open,
  onOpenChange,
  provider,
  isSubmitting,
  onComplete,
}: OAuthConnectModalProps) {
  const form = useForm<OAuthConnectForm>({
    resolver: zodResolver(schema),
    defaultValues: { client_id: "", client_secret: "" },
  });

  const submit = form.handleSubmit((values) => {
    onComplete(values);
  });

  const name = provider?.name ?? "Provider";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/80 bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Connect {name}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            OAuth 2.0 credentials are encrypted server-side. In production, this step opens your
            provider&apos;s consent screen; here we capture app credentials for the template flow.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span>
            Never share refresh tokens in support tickets. Tokens are redacted from activity logs.
          </span>
        </div>
        <Form {...form}>
          <form className="space-y-4" onSubmit={submit}>
            <FormField
              control={form.control}
              name="client_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client ID</FormLabel>
                  <FormControl>
                    <Input className="bg-surface-inner" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="client_secret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client secret</FormLabel>
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
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="cta" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Lock className="mr-2 h-4 w-4" aria-hidden />
                )}
                Authorize &amp; store
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
