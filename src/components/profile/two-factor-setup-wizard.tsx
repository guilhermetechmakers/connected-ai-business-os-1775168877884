import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, ShieldCheck } from "lucide-react";
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
import { startTotpEnrollment, verifyTotpEnrollment } from "@/lib/profile-api";

const verifySchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

type VerifyForm = z.infer<typeof verifySchema>;

const mfaKey = ["profile", "mfa-status"] as const;

export function TwoFactorSetupWizard({
  open,
  onOpenChange,
  onCompleted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCompleted: () => Promise<void>;
}) {
  const [step, setStep] = useState<"intro" | "scan" | "verify">("intro");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [manualSecret, setManualSecret] = useState("");
  const qc = useQueryClient();

  const form = useForm<VerifyForm>({
    resolver: zodResolver(verifySchema),
    defaultValues: { code: "" },
  });

  const startMutation = useMutation({
    mutationFn: async () => startTotpEnrollment(),
    onSuccess: (data) => {
      setOtpauthUrl(data.otpauthUrl);
      setManualSecret(data.manualSecret);
      setStep("scan");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const verifyMutation = useMutation({
    mutationFn: async (code: string) => verifyTotpEnrollment(code),
    onSuccess: async () => {
      toast.success("Two-factor authentication enabled");
      await qc.invalidateQueries({ queryKey: mfaKey });
      await onCompleted();
      onOpenChange(false);
      setStep("intro");
      setOtpauthUrl("");
      setManualSecret("");
      form.reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const qrSrc =
    otpauthUrl.length > 0
      ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(otpauthUrl)}`
      : "";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setStep("intro");
          setOtpauthUrl("");
          setManualSecret("");
          form.reset();
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="border-border/80 bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-success" aria-hidden />
            Authenticator setup
          </DialogTitle>
        </DialogHeader>
        {step === "intro" ? (
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>
              We&apos;ll generate a time-based one-time password (TOTP) secret. Scan the QR code in
              your authenticator app, then confirm with a 6-digit code.
            </p>
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="cta"
                disabled={startMutation.isPending}
                onClick={() => startMutation.mutate()}
              >
                Generate QR
              </Button>
            </DialogFooter>
          </div>
        ) : null}
        {step === "scan" ? (
          <div className="space-y-4">
            <div className="flex justify-center">
              {qrSrc ? (
                <img
                  src={qrSrc}
                  alt="Scan to enroll TOTP"
                  className="rounded-lg border border-border/60 bg-white p-2"
                  width={196}
                  height={196}
                />
              ) : null}
            </div>
            <div className="rounded-lg border border-border/60 bg-surface-inner/50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Manual entry
              </p>
              <p className="mt-1 break-all font-mono text-xs text-foreground">{manualSecret}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  void navigator.clipboard.writeText(manualSecret);
                  toast.message("Secret copied");
                }}
              >
                <Copy className="mr-2 h-3.5 w-3.5" aria-hidden />
                Copy secret
              </Button>
            </div>
            <Button type="button" variant="cta" className="w-full" onClick={() => setStep("verify")}>
              I scanned the code
            </Button>
          </div>
        ) : null}
        {step === "verify" ? (
          <Form {...form}>
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit((vals) => verifyMutation.mutate(vals.code))}
            >
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verification code</FormLabel>
                    <FormControl>
                      <Input
                        className="bg-surface-inner font-mono tracking-widest"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="000000"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="gap-2">
                <Button type="button" variant="ghost" onClick={() => setStep("scan")}>
                  Back
                </Button>
                <Button type="submit" variant="cta" disabled={verifyMutation.isPending}>
                  Enable 2FA
                </Button>
              </DialogFooter>
            </form>
          </Form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
