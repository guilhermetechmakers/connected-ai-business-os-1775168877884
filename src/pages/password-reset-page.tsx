import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { AnimatedPage } from "@/components/animated-page";
import { PublicChrome } from "@/components/layout/public-chrome";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { invokeAuthApi } from "@/lib/auth-api";
import { isSupabaseConfigured } from "@/lib/supabase";

const requestSchema = z.object({
  email: z.string().email(),
});

const resetSchema = z
  .object({
    token: z.string().min(8, "Token required"),
    password: z.string().min(10, "At least 10 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords must match",
    path: ["confirm"],
  });

export default function PasswordResetPage() {
  const [done, setDone] = useState(false);
  const [searchParams] = useSearchParams();
  const requestForm = useForm<z.infer<typeof requestSchema>>({
    resolver: zodResolver(requestSchema),
    defaultValues: { email: "" },
  });
  const resetForm = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { token: "", password: "", confirm: "" },
  });

  const pwd = resetForm.watch("password");
  const strength = Math.min(100, (pwd?.length ?? 0) * 7);
  const tokenFromUrl = searchParams.get("token")?.trim() ?? "";

  useEffect(() => {
    if (!tokenFromUrl) return;
    resetForm.setValue("token", tokenFromUrl, { shouldValidate: true });
  }, [resetForm, tokenFromUrl]);

  return (
    <PublicChrome>
      <AnimatedPage className="flex justify-center px-6 py-16 lg:px-24">
        <Card className="w-full max-w-lg border-border/80 bg-card/95 shadow-card transition-transform duration-150 hover:-translate-y-1">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Password reset</CardTitle>
            <CardDescription>
              Request a secure reset link, then set a new password with live strength feedback.
              Tokens are single-use and rate-limited on the server.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {done ? (
              <div className="space-y-4 text-center">
                <p className="text-lg font-semibold text-foreground">You&apos;re all set</p>
                <p className="text-sm text-muted-foreground">
                  <Link to="/login" className="text-primary hover:underline">
                    Return to sign in
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <Tabs defaultValue={tokenFromUrl ? "reset" : "request"} className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 bg-surface-inner">
                  <TabsTrigger value="request">Request link</TabsTrigger>
                  <TabsTrigger value="reset">Set password</TabsTrigger>
                </TabsList>
                <TabsContent value="request">
                  <Form {...requestForm}>
                    <form
                      onSubmit={requestForm.handleSubmit(async (vals) => {
                        if (!isSupabaseConfigured) {
                          toast.error("Configure Supabase first");
                          return;
                        }
                        try {
                          await invokeAuthApi<{ ok: boolean }>(
                            {
                              op: "password.request",
                              email: vals.email,
                              redirectTo: window.location.origin,
                            },
                            { skipAuthHeader: true },
                          );
                          toast.success("If an account exists, a reset link was sent.");
                          setDone(true);
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Request failed");
                        }
                      })}
                      className="space-y-4"
                    >
                      <FormField
                        control={requestForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input className="bg-surface-inner" type="email" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full transition-transform duration-150 hover:scale-[1.02]" variant="cta">
                        Send reset link
                      </Button>
                    </form>
                  </Form>
                </TabsContent>
                <TabsContent value="reset">
                  <Form {...resetForm}>
                    <form
                      onSubmit={resetForm.handleSubmit(async (vals) => {
                        if (!isSupabaseConfigured) {
                          toast.error("Configure Supabase first");
                          return;
                        }
                        try {
                          await invokeAuthApi<{ ok: boolean }>(
                            {
                              op: "password.confirm",
                              token: vals.token.trim(),
                              password: vals.password,
                            },
                            { skipAuthHeader: true },
                          );
                          toast.success("Password updated");
                          setDone(true);
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Reset failed");
                        }
                      })}
                      className="space-y-4"
                    >
                      <FormField
                        control={resetForm.control}
                        name="token"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Reset token</FormLabel>
                            <FormControl>
                              <Input className="bg-surface-inner" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={resetForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>New password</FormLabel>
                            <FormControl>
                              <Input type="password" className="bg-surface-inner" {...field} />
                            </FormControl>
                            <Progress value={strength} className="h-1" />
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={resetForm.control}
                        name="confirm"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirm password</FormLabel>
                            <FormControl>
                              <Input type="password" className="bg-surface-inner" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full transition-transform duration-150 hover:scale-[1.02]" variant="cta">
                        Update password
                      </Button>
                    </form>
                  </Form>
                  <p className="mt-4 text-center text-xs text-muted-foreground">
                    Arrived from email with a session? You can also use Supabase recovery:{" "}
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 text-primary"
                      onClick={() => {
                        toast.message("Recovery session", {
                          description:
                            "When opened from the email link, update your password with supabase.auth.updateUser from the app shell.",
                        });
                      }}
                    >
                      Learn more
                    </Button>
                  </p>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </AnimatedPage>
    </PublicChrome>
  );
}
