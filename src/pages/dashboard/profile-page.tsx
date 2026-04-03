import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { KeyRound, UserCircle } from "lucide-react";
import type { Control, FieldValues } from "react-hook-form";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AnimatedPage } from "@/components/animated-page";
import { ActivitySnapshot } from "@/components/profile/activity-snapshot";
import { ApiKeysPanel } from "@/components/profile/api-keys-panel";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { ConnectedAccountsPanel } from "@/components/profile/connected-accounts-panel";
import { NotificationPreferencesEditor } from "@/components/profile/notification-preferences-editor";
import { ProfileContactFields } from "@/components/profile/profile-contact-fields";
import { SecurityPanel } from "@/components/profile/security-panel";
import { SsoLinkingPanel } from "@/components/profile/sso-linking-panel";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/auth-context";
import { invokeAuthApi } from "@/lib/auth-api";
import type { Json } from "@/types/database";

const profileEditorSchema = z.object({
  displayName: z.string().min(2, "Name required"),
  avatarUrl: z.union([z.string().url(), z.literal("")]),
  jobTitle: z.string().max(200).optional(),
  department: z.string().max(200).optional(),
  phone: z.string().max(40).optional(),
  address: z.string().max(500).optional(),
  emailDigest: z.boolean(),
  securityAlerts: z.boolean(),
  productUpdates: z.boolean(),
  inAppEnabled: z.boolean(),
  smsEnabled: z.boolean(),
});

type ProfileEditorForm = z.infer<typeof profileEditorSchema>;

function readNotificationPrefs(prefs: Json | undefined): Pick<
  ProfileEditorForm,
  "emailDigest" | "securityAlerts" | "productUpdates" | "inAppEnabled" | "smsEnabled"
> {
  if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) {
    return {
      emailDigest: true,
      securityAlerts: true,
      productUpdates: false,
      inAppEnabled: true,
      smsEnabled: false,
    };
  }
  const n = (prefs as Record<string, unknown>).notifications;
  if (!n || typeof n !== "object" || Array.isArray(n)) {
    return {
      emailDigest: true,
      securityAlerts: true,
      productUpdates: false,
      inAppEnabled: true,
      smsEnabled: false,
    };
  }
  const o = n as Record<string, unknown>;
  return {
    emailDigest: typeof o.emailDigest === "boolean" ? o.emailDigest : true,
    securityAlerts: typeof o.securityAlerts === "boolean" ? o.securityAlerts : true,
    productUpdates: typeof o.productUpdates === "boolean" ? o.productUpdates : false,
    inAppEnabled: typeof o.inAppEnabled === "boolean" ? o.inAppEnabled : true,
    smsEnabled: typeof o.smsEnabled === "boolean" ? o.smsEnabled : false,
  };
}

function readContactFields(contactInfo: Json | undefined) {
  const fromProfile =
    contactInfo && typeof contactInfo === "object" && !Array.isArray(contactInfo)
      ? (contactInfo as Record<string, unknown>)
      : {};
  const phone = typeof fromProfile.phone === "string" ? fromProfile.phone : "";
  const address = typeof fromProfile.address === "string" ? fromProfile.address : "";
  return { phone, address };
}

export default function ProfilePage() {
  const { profileBundle, refreshProfileBundle, user } = useAuth();
  const isLoading = !profileBundle && Boolean(user);

  const form = useForm<ProfileEditorForm>({
    resolver: zodResolver(profileEditorSchema),
    values: profileBundle
      ? {
          displayName: profileBundle.profile?.display_name ?? "",
          avatarUrl: profileBundle.profile?.avatar_url ?? "",
          jobTitle: profileBundle.profile?.job_title ?? "",
          department: profileBundle.profile?.department ?? "",
          ...readContactFields(profileBundle.profile?.contact_info),
          ...readNotificationPrefs(profileBundle.profile?.preferences),
        }
      : {
          displayName: "",
          avatarUrl: "",
          jobTitle: "",
          department: "",
          phone: "",
          address: "",
          emailDigest: true,
          securityAlerts: true,
          productUpdates: false,
          inAppEnabled: true,
          smsEnabled: false,
        },
  });

  const updateMutation = useMutation({
    mutationFn: async (vals: ProfileEditorForm) => {
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
          inAppEnabled: vals.inAppEnabled,
          smsEnabled: vals.smsEnabled,
        },
      };
      const contactInfo: Record<string, unknown> = {
        phone: vals.phone?.trim() ?? "",
        address: vals.address?.trim() ?? "",
      };
      await invokeAuthApi<{ profile: unknown }>({
        op: "profile.update",
        displayName: vals.displayName,
        avatarUrl: vals.avatarUrl,
        preferences,
        jobTitle: vals.jobTitle?.trim() ?? "",
        department: vals.department?.trim() ?? "",
        contactInfo,
      });
    },
    onSuccess: async () => {
      toast.success("Profile saved");
      await refreshProfileBundle();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const externalAccounts = profileBundle?.externalAccounts ?? [];
  const apiKeys = profileBundle?.apiKeys ?? [];
  const securityEvents = profileBundle?.securityEvents ?? [];
  const profileActivity = profileBundle?.profileActivity ?? [];

  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="Profile"
        description="Personal profile, notification channels, authenticator 2FA, SSO, scoped API keys, and activity."
      />

      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-xl bg-surface-inner" />
          <Skeleton className="h-72 rounded-xl bg-surface-inner" />
        </div>
      ) : (
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="flex flex-wrap bg-surface-inner">
            <TabsTrigger value="profile" className="gap-2 text-xs">
              <UserCircle className="h-3.5 w-3.5" aria-hidden />
              Profile
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2 text-xs">
              <KeyRound className="h-3.5 w-3.5" aria-hidden />
              Security
            </TabsTrigger>
            <TabsTrigger value="access" className="text-xs">
              Access
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs">
              Activity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-12">
              <Card className="border-border/80 bg-card/90 lg:col-span-4 transition-all duration-150 hover:-translate-y-1 hover:shadow-card-hover">
                <CardHeader>
                  <CardTitle className="text-base">Photo</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center pb-6">
                  <AvatarUploader
                    currentUrl={profileBundle?.profile?.avatar_url}
                    displayName={profileBundle?.profile?.display_name}
                    disabled={!profileBundle}
                    onUploaded={async (url) => {
                      form.setValue("avatarUrl", url, { shouldDirty: true });
                      await refreshProfileBundle();
                    }}
                  />
                </CardContent>
              </Card>
              <Card className="border-border/80 bg-card/90 lg:col-span-8 transition-all duration-150 hover:-translate-y-1 hover:shadow-card-hover">
                <CardHeader>
                  <CardTitle className="text-base">Details &amp; preferences</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form
                      onSubmit={form.handleSubmit((vals) => updateMutation.mutate(vals))}
                      className="space-y-6"
                    >
                      <div className="grid gap-4 sm:grid-cols-2">
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
                              <FormLabel>Avatar URL (optional override)</FormLabel>
                              <FormControl>
                                <Input className="bg-surface-inner" placeholder="https://…" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <ProfileContactFields
                        control={form.control as unknown as Control<FieldValues>}
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
                      <NotificationPreferencesEditor
                        control={form.control as unknown as Control<FieldValues>}
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
            </div>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <SecurityPanel onRefresh={refreshProfileBundle} />
          </TabsContent>

          <TabsContent value="access" className="space-y-6">
            <Card className="border-border/80 bg-card/90">
              <CardHeader>
                <CardTitle className="text-base">SSO &amp; OAuth</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <SsoLinkingPanel />
                <ConnectedAccountsPanel
                  accounts={externalAccounts}
                  onChanged={refreshProfileBundle}
                />
              </CardContent>
            </Card>
            <Card className="border-border/80 bg-card/90">
              <CardHeader>
                <CardTitle className="text-base">API keys</CardTitle>
              </CardHeader>
              <CardContent>
                <ApiKeysPanel keys={apiKeys} onChanged={refreshProfileBundle} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity">
            <Card className="border-border/80 bg-card/90">
              <CardHeader>
                <CardTitle className="text-base">Activity snapshot</CardTitle>
              </CardHeader>
              <CardContent>
                <ActivitySnapshot
                  securityEvents={securityEvents}
                  profileActivity={profileActivity}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </AnimatedPage>
  );
}
