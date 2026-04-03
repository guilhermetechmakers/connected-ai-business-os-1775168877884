import { zodResolver } from "@hookform/resolvers/zod";
import {
  KeyRound,
  Loader2,
  Lock,
  Plug,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandingPanel } from "@/components/settings/branding-panel";
import { EmailTemplatesManager } from "@/components/settings/email-templates-manager";
import {
  AlertRulesTab,
  NotificationSchedulesTab,
  NotificationsPreferencesTab,
} from "@/components/settings/notifications-alerts-settings";
import { SettingsUsersRolesPanel } from "@/components/settings/settings-users-roles-panel";
import { TenantCompanySettingsForm } from "@/components/settings/tenant-company-settings-form";
import { useTenantSettingsQuery } from "@/hooks/use-tenant-settings";
import {
  useConnectorsQuery,
  useTenantHealthQuery,
  useTriggerSyncMutation,
  useUpsertCredentialsMutation,
} from "@/hooks/use-integrations";
import { CONNECTOR_PROVIDERS, getProviderDefinition } from "@/lib/connector-registry";
import { cn } from "@/lib/utils";
import type { ConnectorRow } from "@/types/integrations";

const credentialSchema = z.object({
  client_id: z.string().optional(),
  client_secret: z.string().optional(),
  api_key: z.string().optional(),
  redirect_url: z.string().optional(),
  auth_url: z.string().optional(),
  token_url: z.string().optional(),
  scopes: z.string().optional(),
});

type CredentialForm = z.infer<typeof credentialSchema>;

const sections = [
  "Company",
  "Users & roles",
  "Email templates",
  "Integrations",
  "Notifications",
  "Alert rules",
  "Schedules",
  "AI",
  "Branding",
  "Data policies",
  "Feature flags",
] as const;

function ConnectorCard({
  row,
  onConfigure,
  onSync,
  isSyncing,
}: {
  row: ConnectorRow;
  onConfigure: () => void;
  onSync: () => void;
  isSyncing: boolean;
}) {
  const def = getProviderDefinition(row.provider_key);
  return (
    <Card className="border-border/80 bg-card/90 shadow-card transition-all duration-150 hover:-translate-y-1 hover:shadow-card-hover">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-lg">
            {row.display_name ?? def?.label ?? row.provider_key}
          </CardTitle>
          <CardDescription>{def?.description ?? "Connector"}</CardDescription>
        </div>
        <Badge
          variant="outline"
          className={cn(
            row.status === "healthy" && "border-success/40 text-success",
            row.status === "connected" && "border-primary/40 text-primary",
            row.status === "error" && "border-destructive/40 text-destructive",
            row.status === "disconnected" && "text-muted-foreground",
          )}
        >
          {row.status}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <div className="flex flex-wrap gap-2">
          {(def?.capabilities ?? []).slice(0, 4).map((c) => (
            <span
              key={c}
              className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-foreground"
            >
              {c.replace("_", " ")}
            </span>
          ))}
        </div>
        <p>
          Last sync:{" "}
          <span className="text-foreground">
            {row.last_sync_at
              ? new Date(row.last_sync_at).toLocaleString()
              : "—"}
          </span>
        </p>
        <p className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
          Credentials encrypted at rest · tenant-isolated RLS
        </p>
      </CardContent>
      <Separator className="bg-border/60" />
      <CardContent className="flex flex-wrap gap-2 pt-4">
        <Button type="button" size="sm" variant="outline" onClick={onConfigure}>
          <KeyRound className="mr-2 h-4 w-4" />
          Edit / rotate
        </Button>
        <Button
          type="button"
          size="sm"
          variant="cta"
          onClick={onSync}
          disabled={isSyncing}
          aria-busy={isSyncing}
        >
          {isSyncing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Sync now
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => toast.message("Test connection (simulated)")}
        >
          Test
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => toast.message("Disable flow uses connectors.update")}
        >
          Disable
        </Button>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const tenantSettingsQuery = useTenantSettingsQuery();
  const connectorsQuery = useConnectorsQuery();
  const healthQuery = useTenantHealthQuery();
  const upsertCreds = useUpsertCredentialsMutation();
  const triggerSync = useTriggerSyncMutation();

  const [credTarget, setCredTarget] = useState<ConnectorRow | null>(null);
  const [aiSafeMode, setAiSafeMode] = useState(true);
  const [retentionDays, setRetentionDays] = useState(365);
  const [demoFlag, setDemoFlag] = useState(false);

  const connectors = useMemo(
    () => (Array.isArray(connectorsQuery.data) ? connectorsQuery.data : []),
    [connectorsQuery.data],
  );

  const credForm = useForm<CredentialForm>({
    resolver: zodResolver(credentialSchema),
    defaultValues: {
      client_id: "",
      client_secret: "",
      api_key: "",
      redirect_url: "",
      auth_url: "",
      token_url: "",
      scopes: "",
    },
  });

  const providerForDialog = credTarget
    ? getProviderDefinition(credTarget.provider_key)
    : undefined;

  const onSubmitCredentials = (values: CredentialForm) => {
    if (!credTarget) return;
    const payload: Record<string, unknown> = {};
    if (values.client_id) payload.client_id = values.client_id;
    if (values.client_secret) payload.client_secret = values.client_secret;
    if (values.api_key) payload.api_key = values.api_key;
    if (values.redirect_url) payload.redirect_url = values.redirect_url;
    if (values.auth_url) payload.auth_url = values.auth_url;
    if (values.token_url) payload.token_url = values.token_url;
    if (values.scopes) payload.scopes = values.scopes.split(/[,\s]+/).filter(Boolean);

    upsertCreds.mutate(
      {
        connectorId: credTarget.id,
        credentials: payload,
        metadata: { method: providerForDialog?.auth ?? "oauth2" },
      },
      {
        onSuccess: () => {
          toast.success("Credentials stored encrypted");
          setCredTarget(null);
          credForm.reset();
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const summary = healthQuery.data?.summary;

  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="Settings"
        description="Tenant and user governance: company profile, access, integrations, AI policies, branding, retention, and flags."
      />

      <Tabs defaultValue="Company" className="space-y-6">
        <TabsList className="flex flex-wrap bg-surface-inner">
          {sections.map((s) => (
            <TabsTrigger key={s} value={s} className="text-xs">
              {s}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="Company">
          <TenantCompanySettingsForm
            tenant={tenantSettingsQuery.data}
            isLoading={tenantSettingsQuery.isLoading}
            loadError={tenantSettingsQuery.isError}
          />
        </TabsContent>

        <TabsContent value="Users & roles">
          <div className="space-y-6">
            <SettingsUsersRolesPanel />
            <Card className="border-border/80 bg-card/90">
              <CardHeader>
                <CardTitle>Role templates</CardTitle>
                <CardDescription>
                  Map Tenant Admin, Integrations Lead, and User scopes. Edge Functions enforce RBAC on
                  connector operations.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {["Tenant Admin", "Integrations Lead", "Analyst", "User"].map((role) => (
                  <div
                    key={role}
                    className="rounded-xl border border-border/60 bg-surface-inner p-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/30"
                  >
                    <p className="font-semibold text-foreground">{role}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Permissions bundle for {role.toLowerCase()} including integration credentials and
                      sync triggers.
                    </p>
                    <Button className="mt-3" size="sm" variant="outline" type="button">
                      Edit permissions
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="Email templates">
          <EmailTemplatesManager />
        </TabsContent>

        <TabsContent value="Integrations" className="space-y-6">
          <Card className="border-border/80 bg-card/90">
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Plug className="h-5 w-5 text-primary" />
                  Connector grid
                </CardTitle>
                <CardDescription>
                  OAuth2 / API key configuration with masked secrets, manual sync, and
                  health from the integrations Edge Function.
                </CardDescription>
              </div>
              {summary ? (
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="border-primary/40 text-primary">
                    {summary.total} connectors
                  </Badge>
                  <Badge variant="outline" className="border-success/40 text-success">
                    {summary.healthy} healthy
                  </Badge>
                  <Badge variant="outline" className="border-destructive/40 text-destructive">
                    {summary.errors} errors
                  </Badge>
                </div>
              ) : null}
            </CardHeader>
            <CardContent>
              {connectorsQuery.isLoading ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Skeleton className="h-48 rounded-xl bg-surface-inner" />
                  <Skeleton className="h-48 rounded-xl bg-surface-inner" />
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {connectors.map((c) => (
                    <ConnectorCard
                      key={c.id}
                      row={c}
                      onConfigure={() => {
                        setCredTarget(c);
                        credForm.reset();
                      }}
                      onSync={() => {
                        triggerSync.mutate(
                          {
                            connectorId: c.id,
                            idempotencyKey: `settings-${c.id}-${Date.now()}`,
                          },
                          {
                            onSuccess: () => toast.success("Sync completed"),
                            onError: (e) => toast.error(e.message),
                          },
                        );
                      }}
                      isSyncing={triggerSync.isPending}
                    />
                  ))}
                </div>
              )}
              {!connectorsQuery.isLoading && connectors.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No connectors yet. Use Integration Connection Setup or create one from
                  onboarding.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/90">
            <CardHeader>
              <CardTitle>Available providers</CardTitle>
              <CardDescription>
                Install from the registry — capabilities declare OAuth, API keys, and
                webhooks.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48 pr-3">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {CONNECTOR_PROVIDERS.map((p) => (
                    <li
                      key={p.key}
                      className="flex items-center justify-between rounded-lg border border-border/50 bg-surface-inner px-3 py-2"
                    >
                      <span className="font-medium text-foreground">{p.label}</span>
                      <span className="text-xs uppercase tracking-wide">{p.auth}</span>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="Notifications">
          <NotificationsPreferencesTab />
        </TabsContent>

        <TabsContent value="Alert rules">
          <AlertRulesTab />
        </TabsContent>

        <TabsContent value="Schedules">
          <NotificationSchedulesTab />
        </TabsContent>

        <TabsContent value="AI">
          <Card className="border-border/80 bg-card/90">
            <CardHeader>
              <CardTitle>AI & security</CardTitle>
              <CardDescription>
                Grounding, action gating, and prompt safety for the AI Workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-surface-inner px-4 py-3">
                <div>
                  <Label htmlFor="ai-safe">Safe action mode</Label>
                  <p className="text-xs text-muted-foreground">
                    Require explicit approval for cross-system writes suggested by AI.
                  </p>
                </div>
                <Switch
                  id="ai-safe"
                  checked={aiSafeMode}
                  onCheckedChange={setAiSafeMode}
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="h-4 w-4 text-primary" aria-hidden />
                Prompt templates and vector retrieval stay tenant-scoped with RLS.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="Branding">
          {tenantSettingsQuery.isLoading ? (
            <Skeleton className="h-56 w-full max-w-2xl rounded-xl bg-surface-inner" />
          ) : tenantSettingsQuery.isError ? (
            <p className="text-sm text-muted-foreground">
              Branding settings require tenant administrator access.
            </p>
          ) : (
            <BrandingPanel settings={tenantSettingsQuery.data?.settings} />
          )}
        </TabsContent>

        <TabsContent value="Data policies">
          <Card className="border-border/80 bg-card/90">
            <CardHeader>
              <CardTitle>Data retention</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-surface-inner px-4 py-3">
                <div>
                  <Label htmlFor="retention">Retention window (days)</Label>
                  <p className="text-xs text-muted-foreground">
                    Applies to sync logs and AI conversation archives per tenant policy.
                  </p>
                </div>
                <Input
                  id="retention"
                  type="number"
                  className="w-24 bg-surface-inner"
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(Number(e.target.value) || 0)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="Feature flags">
          <Card className="border-border/80 bg-card/90">
            <CardHeader>
              <CardTitle>Feature flags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-surface-inner px-4 py-3">
                <div>
                  <Label htmlFor="demo-flag">Demo integrations UI</Label>
                  <p className="text-xs text-muted-foreground">
                    Toggles experimental connector cards and mapping previews.
                  </p>
                </div>
                <Switch id="demo-flag" checked={demoFlag} onCheckedChange={setDemoFlag} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(credTarget)} onOpenChange={(o) => !o && setCredTarget(null)}>
        <DialogContent className="max-w-lg border-border/80 bg-card">
          <DialogHeader>
            <DialogTitle>Connector credentials</DialogTitle>
            <DialogDescription>
              Secrets are encrypted server-side. Never commit client secrets to the
              repository.
            </DialogDescription>
          </DialogHeader>
          <Form {...credForm}>
            <form className="space-y-3" onSubmit={credForm.handleSubmit(onSubmitCredentials)}>
              {providerForDialog?.auth === "oauth2" ||
              providerForDialog?.auth === "both" ? (
                <>
                  <FormField
                    control={credForm.control}
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
                    control={credForm.control}
                    name="client_secret"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client secret</FormLabel>
                        <FormControl>
                          <Input
                            className="bg-surface-inner"
                            type="password"
                            autoComplete="off"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={credForm.control}
                    name="redirect_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Redirect URL</FormLabel>
                        <FormControl>
                          <Input className="bg-surface-inner" placeholder="https://…" {...field} />
                        </FormControl>
                        <FormDescription>OAuth redirect registered with provider.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={credForm.control}
                    name="auth_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Auth URL (optional)</FormLabel>
                        <FormControl>
                          <Input className="bg-surface-inner" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={credForm.control}
                    name="token_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Token URL (optional)</FormLabel>
                        <FormControl>
                          <Input className="bg-surface-inner" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={credForm.control}
                    name="scopes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Scopes</FormLabel>
                        <FormControl>
                          <Input
                            className="bg-surface-inner"
                            placeholder="chat:write, channels:read"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              ) : null}
              {providerForDialog?.auth === "api_key" ||
              providerForDialog?.auth === "both" ? (
                <FormField
                  control={credForm.control}
                  name="api_key"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>API key</FormLabel>
                      <FormControl>
                        <Input
                          className="bg-surface-inner"
                          type="password"
                          autoComplete="off"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}
              <DialogFooter className="gap-2">
                <Button type="button" variant="ghost" onClick={() => setCredTarget(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="cta" disabled={upsertCreds.isPending}>
                  {upsertCreds.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Save encrypted
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </AnimatedPage>
  );
}
