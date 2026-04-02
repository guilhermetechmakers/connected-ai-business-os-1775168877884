import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { KeyRound, Shield } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/auth-context";
import { invokeAuthApi, safeStringArray } from "@/lib/auth-api";
import type { Json } from "@/types/database";

const profileSchema = z.object({
  displayName: z.string().min(2, "Name required"),
  avatarUrl: z.union([z.string().url(), z.literal("")]),
  emailDigest: z.boolean(),
  securityAlerts: z.boolean(),
  productUpdates: z.boolean(),
});

type ProfileForm = z.infer<typeof profileSchema>;

function readNotificationPrefs(prefs: Json | undefined): {
  emailDigest: boolean;
  securityAlerts: boolean;
  productUpdates: boolean;
} {
  if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) {
    return { emailDigest: true, securityAlerts: true, productUpdates: false };
  }
  const n = (prefs as Record<string, unknown>).notifications;
  if (!n || typeof n !== "object" || Array.isArray(n)) {
    return { emailDigest: true, securityAlerts: true, productUpdates: false };
  }
  const o = n as Record<string, unknown>;
  return {
    emailDigest: typeof o.emailDigest === "boolean" ? o.emailDigest : true,
    securityAlerts: typeof o.securityAlerts === "boolean" ? o.securityAlerts : true,
    productUpdates: typeof o.productUpdates === "boolean" ? o.productUpdates : false,
  };
}

export default function ProfilePage() {
  const { profileBundle, refreshProfileBundle, user } = useAuth();
  const isLoading = !profileBundle && Boolean(user);

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: profileBundle
      ? {
          displayName: profileBundle.profile?.display_name ?? "",
          avatarUrl: profileBundle.profile?.avatar_url ?? "",
          ...readNotificationPrefs(profileBundle.profile?.preferences),
        }
      : {
          displayName: "",
          avatarUrl: "",
          emailDigest: true,
          securityAlerts: true,
          productUpdates: false,
        },
  });

  const updateMutation = useMutation({
    mutationFn: async (vals: ProfileForm) => {
      const basePrefs =
        profileBundle?.profile?.preferences &&
        typeof profileBundle.profile.preferences === "object" &&
        !Array.isArray(profileBundle.profile.preferences)
          ? (profileBundle.profile.preferences as Record<string, unknown>)
          : {};
      const preferences: Record<string, unknown> = {
        ...basePrefs,
        notifications: {
          emailDigest: vals.emailDigest,
          securityAlerts: vals.securityAlerts,
          productUpdates: vals.productUpdates,
        },
      };
      await invokeAuthApi<{ profile: unknown }>({
        op: "profile.update",
        displayName: vals.displayName,
        avatarUrl: vals.avatarUrl,
        preferences,
      });
    },
    onSuccess: async () => {
      toast.success("Profile saved");
      await refreshProfileBundle();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createKeyMutation = useMutation({
    mutationFn: async (name: string) => {
      return invokeAuthApi<{ secret: string; key: { id: string; name: string; key_prefix: string } }>(
        {
          op: "apikeys.create",
          name,
          scopes: ["read"],
        },
      );
    },
    onSuccess: (data) => {
      toast.success("API key created", {
        description: `Secret (copy now): ${data.secret}`,
        duration: 20_000,
      });
      void refreshProfileBundle();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      await invokeAuthApi<{ ok: boolean }>({ op: "apikeys.revoke", keyId });
    },
    onSuccess: async () => {
      toast.success("Key revoked");
      await refreshProfileBundle();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const externalAccounts = profileBundle?.externalAccounts ?? [];
  const apiKeys = profileBundle?.apiKeys ?? [];
  const securityEvents = profileBundle?.securityEvents ?? [];

  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="Profile"
        description="Personal info, notification preferences, connected accounts, scoped API keys, and a security snapshot."
      />

      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-border/80 bg-card/90 transition-transform duration-150 hover:-translate-y-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4 text-primary" />
                Basics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit((vals) => updateMutation.mutate(vals))}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="displayName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display name</FormLabel>
                        <FormControl>
                          <Input className="bg-surface-inner" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="avatarUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Avatar URL (optional)</FormLabel>
                        <FormControl>
                          <Input className="bg-surface-inner" placeholder="https://…" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <Input
                      className="mt-1 bg-surface-inner"
                      readOnly
                      value={profileBundle?.profile?.email ?? user?.email ?? ""}
                    />
                  </div>
                  <Separator />
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Notifications
                  </p>
                  <FormField
                    control={form.control}
                    name="emailDigest"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                        <FormLabel className="!mt-0">Email digest</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="securityAlerts"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                        <FormLabel className="!mt-0">Security alerts</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="productUpdates"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                        <FormLabel className="!mt-0">Product updates</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    variant="cta"
                    size="sm"
                    disabled={updateMutation.isPending}
                    className="transition-transform duration-150 hover:scale-[1.02]"
                  >
                    {updateMutation.isPending ? "Saving…" : "Save profile"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/90 transition-transform duration-150 hover:-translate-y-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-4 w-4 text-primary" />
                Security & keys
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p className="text-xs">
                Password & MFA are managed via Supabase Auth (
                <span className="font-mono">auth.users</span>). Use the hosted recovery flow or your
                IdP for SSO-linked accounts.
              </p>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Connected accounts
                </p>
                {externalAccounts.length === 0 ? (
                  <p className="text-xs">No linked SAML/OIDC rows yet. OAuth sign-ins appear here.</p>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {externalAccounts.map((a) => (
                      <li key={a.id} className="flex justify-between gap-2 rounded-md bg-surface-inner/60 px-2 py-1">
                        <span className="capitalize text-foreground">{a.provider}</span>
                        <span>{format(new Date(a.linked_at), "PP")}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  API keys
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  disabled={createKeyMutation.isPending}
                  onClick={() => {
                    const name = window.prompt("Key name");
                    if (name?.trim()) createKeyMutation.mutate(name.trim());
                  }}
                >
                  Create scoped key
                </Button>
                {apiKeys.length === 0 ? (
                  <p className="text-xs">No active keys.</p>
                ) : (
                  <ul className="space-y-2 text-xs">
                    {apiKeys.map((k) => (
                      <li
                        key={k.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-surface-inner/40 px-2 py-2"
                      >
                        <div>
                          <p className="font-medium text-foreground">{k.name}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {k.key_prefix}… · {safeStringArray(k.scopes).join(", ") || "read"}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={revokeKeyMutation.isPending}
                          onClick={() => revokeKeyMutation.mutate(k.id)}
                        >
                          Revoke
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-border/80 bg-card/90">
        <CardHeader>
          <CardTitle className="text-base">Activity snapshot</CardTitle>
        </CardHeader>
        <CardContent>
          {securityEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent security events recorded.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead className="text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {securityEvents.map((ev) => (
                  <TableRow key={`${ev.event_type}-${ev.created_at}`}>
                    <TableCell className="font-mono text-xs">{ev.event_type}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {format(new Date(ev.created_at), "PPp")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AnimatedPage>
  );
}
