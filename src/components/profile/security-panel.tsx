import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { KeyRound, Shield } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { disableTotp, getMfaStatus } from "@/lib/profile-api";

import { TwoFactorSetupWizard } from "@/components/profile/two-factor-setup-wizard";

const disableSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

type DisableForm = z.infer<typeof disableSchema>;

const mfaKey = ["profile", "mfa-status"] as const;

export function SecurityPanel({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);

  const mfaQuery = useQuery({
    queryKey: mfaKey,
    queryFn: async () => {
      const env = await getMfaStatus();
      if (env.error) throw new Error(env.error.message);
      return env.data ?? { enabled: false, factors: [] as string[] };
    },
  });

  const form = useForm<DisableForm>({
    resolver: zodResolver(disableSchema),
    defaultValues: { code: "" },
  });

  const disableMutation = useMutation({
    mutationFn: async (code: string) => disableTotp(code),
    onSuccess: async () => {
      toast.success("Two-factor authentication disabled");
      await mfaQuery.refetch();
      await onRefresh();
      setDisableOpen(false);
      form.reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const enabled = Boolean(mfaQuery.data?.enabled);

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-surface-inner/30 p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Shield className="h-3.5 w-3.5 text-primary" aria-hidden />
        Two-factor authentication
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={
            enabled
              ? "inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success"
              : "inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-0.5 text-xs text-muted-foreground"
          }
        >
          <span
            className={enabled ? "h-1.5 w-1.5 animate-pulse rounded-full bg-success" : "h-1.5 w-1.5 rounded-full bg-muted-foreground"}
            aria-hidden
          />
          {enabled ? "TOTP active" : "Not enabled"}
        </span>
        {!enabled ? (
          <Button
            type="button"
            size="sm"
            variant="cta"
            className="transition-transform duration-150 hover:scale-[1.02]"
            onClick={() => setWizardOpen(true)}
          >
            <KeyRound className="mr-2 h-4 w-4" aria-hidden />
            Set up authenticator
          </Button>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={() => setDisableOpen(true)}>
            Disable 2FA
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Password changes remain in Supabase Auth. This TOTP layer is enforced for app-level checks and
        audit events.
      </p>

      <TwoFactorSetupWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onCompleted={async () => {
          await mfaQuery.refetch();
          await onRefresh();
        }}
      />

      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent className="border-border/80 bg-card sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Disable 2FA</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit((vals) => disableMutation.mutate(vals.code))}
            >
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current TOTP code</FormLabel>
                    <FormControl>
                      <Input
                        className="bg-surface-inner font-mono"
                        inputMode="numeric"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" variant="destructive" disabled={disableMutation.isPending}>
                  Disable
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
