import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
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

  return (
    <PublicChrome>
      <AnimatedPage className="flex justify-center px-6 py-16 lg:px-24">
        <Card className="w-full max-w-lg border-border/80 bg-card/95 shadow-card">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Password reset</CardTitle>
            <CardDescription>
              Request a secure reset link, then set a new password with live
              strength feedback.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {done ? (
              <div className="space-y-4 text-center">
                <p className="text-lg font-semibold text-foreground">
                  Check your inbox
                </p>
                <p className="text-sm text-muted-foreground">
                  We sent a reset link to your email. You can close this tab or{" "}
                  <Link to="/login" className="text-primary hover:underline">
                    return to sign in
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <Tabs defaultValue="request" className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 bg-surface-inner">
                  <TabsTrigger value="request">Request link</TabsTrigger>
                  <TabsTrigger value="reset">Set password</TabsTrigger>
                </TabsList>
                <TabsContent value="request">
                  <Form {...requestForm}>
                    <form
                      onSubmit={requestForm.handleSubmit(() => {
                        toast.success("Reset email sent (simulated)");
                        setDone(true);
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
                              <Input className="bg-surface-inner" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full" variant="cta">
                        Send reset link
                      </Button>
                    </form>
                  </Form>
                </TabsContent>
                <TabsContent value="reset">
                  <Form {...resetForm}>
                    <form
                      onSubmit={resetForm.handleSubmit(() => {
                        toast.success("Password updated (simulated)");
                        setDone(true);
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
                              <Input
                                type="password"
                                className="bg-surface-inner"
                                {...field}
                              />
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
                              <Input
                                type="password"
                                className="bg-surface-inner"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full" variant="cta">
                        Update password
                      </Button>
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </AnimatedPage>
    </PublicChrome>
  );
}
