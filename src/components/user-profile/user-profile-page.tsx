import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { KeyRound, UserCircle } from "lucide-react";
import type { Control, FieldValues } from "react-hook-form";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { AnimatedPage } from "@/components/animated-page";
import { ActivitySnapshot } from "@/components/profile/activity-snapshot";
import { ApiKeysPanel } from "@/components/profile/api-keys-panel";
import { ConnectedAccountsPanel } from "@/components/profile/connected-accounts-panel";
import { SsoLinkingPanel } from "@/components/profile/sso-linking-panel";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/auth-context";
import { invokeAuthApi } from "@/lib/auth-api";

import { AuthenticationMethodsCard } from "./authentication-methods-card";
import { NotificationPreferencesCard } from "./notification-preferences-card";
import { ProfileDetailsCard } from "./profile-details-card";
import {
  profileEditorSchema,
  readContactFields,
  readNotificationPrefs,
  type ProfileEditorForm,
} from "./user-profile-form-schema";

export function UserProfilePage() {
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
          bio: profileBundle.profile?.bio ?? "",
          ...readContactFields(profileBundle.profile?.contact_info),
          ...readNotificationPrefs(profileBundle.profile?.preferences),
        }
      : {
          displayName: "",
          avatarUrl: "",
          jobTitle: "",
          department: "",
          bio: "",
          phone: "",
          address: "",
          emailDigest: true,
          securityAlerts: true,
          productUpdates: false,
          inAppEnabled: true,
          smsEnabled: false,
          chEmailFreq: "immediate",
          chInAppFreq: "immediate",
          chSmsFreq: "weekly",
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
          channels: {
            email: { frequency: vals.chEmailFreq },
            in_app: { frequency: vals.chInAppFreq },
            sms: { frequency: vals.chSmsFreq },
          },
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
        bio: vals.bio?.trim() ?? "",
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

  const tenantId = profileBundle?.profile?.company_id ?? "";
  const userId = profileBundle?.profile?.id ?? user?.id ?? "";

  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="User profile"
        description="Tenant-scoped identity, notifications, authentication, connected accounts, API keys, and activity. Changes sync to your session where applicable."
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
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((vals) => updateMutation.mutate(vals))}
                className="space-y-6"
              >
                <ProfileDetailsCard
                  control={form.control}
                  profileBundle={profileBundle}
                  userEmail={profileBundle?.profile?.email ?? user?.email ?? ""}
                  disabled={!profileBundle}
                  onAvatarUploaded={async (url) => {
                    form.setValue("avatarUrl", url, { shouldDirty: true });
                    await refreshProfileBundle();
                  }}
                />
                <Separator className="opacity-50" />
                <NotificationPreferencesCard
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
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <AuthenticationMethodsCard onRefresh={refreshProfileBundle} />
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
                  tenantId={tenantId}
                  userId={userId}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </AnimatedPage>
  );
}
