import { zodResolver } from "@hookform/resolvers/zod";
import { Bell, Loader2, Mail, Plus, Smartphone, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  useAlertRulesQuery,
  useChannelSettingsQuery,
  useCreateAlertRuleMutation,
  useCreateScheduleMutation,
  useDeleteAlertRuleMutation,
  useNotificationPreferencesQuery,
  useNotificationSchedulesQuery,
  useTestFcmMutation,
  useTestResendMutation,
  useUpdateAlertRuleMutation,
  useUpsertChannelSecretsMutation,
  useUpsertChannelSettingsMutation,
  useUpsertPreferencesMutation,
} from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";
import type { AlertRuleRow, NotificationScheduleRow } from "@/types/notifications";

const preferencesFormSchema = z.object({
  channelsInApp: z.boolean(),
  channelsEmail: z.boolean(),
  channelsPush: z.boolean(),
  quietStart: z.string().optional(),
  quietEnd: z.string().optional(),
  dataRetentionDays: z.coerce.number().min(1).max(3650),
});

type PreferencesForm = z.infer<typeof preferencesFormSchema>;

const channelMetaSchema = z.object({
  resend_from_email: z.string().email().optional().or(z.literal("")),
  resend_reply_to: z.string().email().optional().or(z.literal("")),
  fcm_sender_id: z.string().optional(),
  webhook_delivery_url: z.string().optional(),
});

const ruleSchema = z.object({
  name: z.string().min(1).max(200),
  trigger_type: z.enum(["kpi", "workflow", "ai"]),
  conditionsJson: z.string().min(2),
  actionsJson: z.string().min(2),
  enabled: z.boolean(),
});

const scheduleSchema = z.object({
  name: z.string().min(1).max(200),
  cronExpression: z.string().min(1),
  payloadJson: z.string().optional(),
  active: z.boolean(),
});

export function NotificationsPreferencesTab() {
  const prefQ = useNotificationPreferencesQuery();
  const upsertPref = useUpsertPreferencesMutation();
  const chQ = useChannelSettingsQuery();
  const upsertMeta = useUpsertChannelSettingsMutation();
  const upsertSecrets = useUpsertChannelSecretsMutation();
  const testResend = useTestResendMutation();
  const testFcm = useTestFcmMutation();

  const prefData = prefQ.data ?? {};
  const channels = Array.isArray(prefData.channels) ? prefData.channels : [];
  const qh =
    prefData.quiet_hours && typeof prefData.quiet_hours === "object"
      ? (prefData.quiet_hours as { start?: string; end?: string })
      : {};

  const form = useForm<PreferencesForm>({
    resolver: zodResolver(preferencesFormSchema),
    values: {
      channelsInApp: channels.includes("in_app"),
      channelsEmail: channels.includes("email"),
      channelsPush: channels.includes("push"),
      quietStart: typeof qh.start === "string" ? qh.start : "",
      quietEnd: typeof qh.end === "string" ? qh.end : "",
      dataRetentionDays:
        typeof prefData.data_retention_days === "number"
          ? prefData.data_retention_days
          : 365,
    },
  });

  const metaForm = useForm<z.infer<typeof channelMetaSchema>>({
    resolver: zodResolver(channelMetaSchema),
    values: {
      resend_from_email: String(chQ.data?.resend_from_email ?? ""),
      resend_reply_to: String(chQ.data?.resend_reply_to ?? ""),
      fcm_sender_id: String(chQ.data?.fcm_sender_id ?? ""),
      webhook_delivery_url: String(chQ.data?.webhook_delivery_url ?? ""),
    },
  });

  const [resendKey, setResendKey] = useState("");
  const [fcmKey, setFcmKey] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [testToken, setTestToken] = useState("");

  const onSavePrefs = (v: PreferencesForm) => {
    const ch: string[] = [];
    if (v.channelsInApp) ch.push("in_app");
    if (v.channelsEmail) ch.push("email");
    if (v.channelsPush) ch.push("push");
    const quiet_hours =
      v.quietStart?.trim() && v.quietEnd?.trim()
        ? { start: v.quietStart.trim(), end: v.quietEnd.trim() }
        : null;

    upsertPref.mutate(
      {
        channels: ch.length > 0 ? ch : ["in_app"],
        preferences: {},
        quiet_hours,
        data_retention_days: v.dataRetentionDays,
      },
      {
        onSuccess: () => toast.success("Notification preferences saved"),
        onError: () => toast.error("Could not save preferences"),
      },
    );
  };

  const hint =
    "Secrets are encrypted with CREDENTIALS_MASTER_KEY via Edge Function (service role).";

  return (
    <div className="space-y-6">
      <Card className="border-border/80 bg-card/90 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Personal notification preferences
          </CardTitle>
          <CardDescription>
            Channels, quiet hours, and retention — stored per user with RLS.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {prefQ.isLoading ? (
            <Skeleton className="h-40 w-full rounded-xl bg-surface-inner" />
          ) : (
            <Form {...form}>
              <form
                className="space-y-4 max-w-xl"
                onSubmit={form.handleSubmit(onSavePrefs)}
              >
                <div className="space-y-3 rounded-lg border border-border/60 bg-surface-inner p-4">
                  <p className="text-sm font-medium text-foreground">Channels</p>
                  <FormField
                    control={form.control}
                    name="channelsInApp"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <FormLabel>In-app</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="channelsEmail"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <FormLabel className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Email
                        </FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="channelsPush"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <FormLabel className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4" />
                          Push
                        </FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="quietStart"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quiet hours start</FormLabel>
                        <FormControl>
                          <Input className="bg-surface-inner" placeholder="22:00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="quietEnd"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quiet hours end</FormLabel>
                        <FormControl>
                          <Input className="bg-surface-inner" placeholder="07:00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="dataRetentionDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data retention (days)</FormLabel>
                      <FormControl>
                        <Input type="number" className="bg-surface-inner max-w-xs" {...field} />
                      </FormControl>
                      <FormDescription>
                        Notification preference retention hint for this user.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" variant="cta" disabled={upsertPref.isPending}>
                  {upsertPref.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Save preferences
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/80 bg-card/90 shadow-card">
          <CardHeader>
            <CardTitle>Channel metadata</CardTitle>
            <CardDescription>
              From addresses and webhook URL (non-secret). Requires admin / integrations role.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chQ.isLoading ? (
              <Skeleton className="h-40 rounded-xl bg-surface-inner" />
            ) : (
              <Form {...metaForm}>
                <form
                  className="space-y-3"
                  onSubmit={metaForm.handleSubmit((vals) => {
                    upsertMeta.mutate(
                      {
                        resend_from_email: vals.resend_from_email || null,
                        resend_reply_to: vals.resend_reply_to || null,
                        fcm_sender_id: vals.fcm_sender_id || null,
                        webhook_delivery_url: vals.webhook_delivery_url || null,
                      },
                      {
                        onSuccess: () => toast.success("Channel settings saved"),
                        onError: () => toast.error("Save failed — check role permissions"),
                      },
                    );
                  })}
                >
                  <FormField
                    control={metaForm.control}
                    name="resend_from_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Resend from email</FormLabel>
                        <FormControl>
                          <Input className="bg-surface-inner" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={metaForm.control}
                    name="resend_reply_to"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reply-to (optional)</FormLabel>
                        <FormControl>
                          <Input className="bg-surface-inner" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={metaForm.control}
                    name="fcm_sender_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>FCM sender ID</FormLabel>
                        <FormControl>
                          <Input className="bg-surface-inner" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={metaForm.control}
                    name="webhook_delivery_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Delivery webhook URL</FormLabel>
                        <FormControl>
                          <Input className="bg-surface-inner" placeholder="https://…" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" size="sm" variant="outline" disabled={upsertMeta.isPending}>
                    Save metadata
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/90 shadow-card">
          <CardHeader>
            <CardTitle>Encrypted API keys</CardTitle>
            <CardDescription>{hint}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Resend API key</Label>
              <Input
                className="bg-surface-inner"
                type="password"
                autoComplete="off"
                value={resendKey}
                onChange={(e) => setResendKey(e.target.value)}
                placeholder="re_…"
              />
              <Button
                type="button"
                size="sm"
                variant="cta"
                disabled={upsertSecrets.isPending || resendKey.length < 10}
                onClick={() => {
                  upsertSecrets.mutate(
                    { provider: "resend", resend_api_key: resendKey },
                    {
                      onSuccess: (ok) => {
                        if (ok) {
                          toast.success("Resend key stored");
                          setResendKey("");
                        } else toast.error("Could not store key");
                      },
                    },
                  );
                }}
              >
                Store Resend key
              </Button>
            </div>
            <Separator className="bg-border/60" />
            <div className="space-y-2">
              <Label>FCM server key</Label>
              <Input
                className="bg-surface-inner"
                type="password"
                autoComplete="off"
                value={fcmKey}
                onChange={(e) => setFcmKey(e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                variant="cta"
                disabled={upsertSecrets.isPending || fcmKey.length < 10}
                onClick={() => {
                  upsertSecrets.mutate(
                    { provider: "fcm", fcm_server_key: fcmKey },
                    {
                      onSuccess: (ok) => {
                        if (ok) {
                          toast.success("FCM key stored");
                          setFcmKey("");
                        } else toast.error("Could not store key");
                      },
                    },
                  );
                }}
              >
                Store FCM key
              </Button>
            </div>
            <Separator className="bg-border/60" />
            <div className="space-y-2">
              <Label htmlFor="resend-test">Test email recipient</Label>
              <Input
                id="resend-test"
                className="bg-surface-inner"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={testResend.isPending || !testEmail}
                onClick={() => {
                  testResend.mutate(testEmail, {
                    onSuccess: (r) => {
                      if (r.ok) toast.success("Resend test sent");
                      else toast.error(r.error ?? "Resend test failed");
                    },
                  });
                }}
              >
                {testResend.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Test Resend
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fcm-test">FCM device token</Label>
              <Input
                id="fcm-test"
                className="bg-surface-inner font-mono text-xs"
                value={testToken}
                onChange={(e) => setTestToken(e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={testFcm.isPending || testToken.length < 10}
                onClick={() => {
                  testFcm.mutate(testToken, {
                    onSuccess: (r) => {
                      if (r.ok) toast.success("FCM test dispatched");
                      else toast.error(r.error ?? "FCM test failed");
                    },
                  });
                }}
              >
                {testFcm.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Test FCM
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function AlertRulesTab() {
  const rulesQ = useAlertRulesQuery();
  const createR = useCreateAlertRuleMutation();
  const updateR = useUpdateAlertRuleMutation();
  const delR = useDeleteAlertRuleMutation();

  const rules = Array.isArray(rulesQ.data) ? rulesQ.data : [];

  const form = useForm<z.infer<typeof ruleSchema>>({
    resolver: zodResolver(ruleSchema),
    defaultValues: {
      name: "KPI threshold",
      trigger_type: "kpi",
      conditionsJson: JSON.stringify(
        { kpi_id: "", op: "gte", threshold: 100 },
        null,
        2,
      ),
      actionsJson: JSON.stringify(
        [
          {
            channels: ["in_app", "email"],
            title: "KPI alert",
            message: "Threshold crossed",
          },
        ],
        null,
        2,
      ),
      enabled: true,
    },
  });

  return (
    <div className="space-y-6">
      <Card className="border-border/80 bg-card/90 shadow-card">
        <CardHeader>
          <CardTitle>Create alert rule</CardTitle>
          <CardDescription>
            KPI rules use <code className="text-primary">kpi_id</code>, <code className="text-primary">op</code>{" "}
            (<span className="text-muted-foreground">gte | lte | eq</span>), and{" "}
            <code className="text-primary">threshold</code>. Actions are a JSON array of channel bundles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              className="space-y-4 max-w-2xl"
              onSubmit={form.handleSubmit((v) => {
                let conditions: Record<string, unknown> = {};
                let actionsParsed: unknown;
                try {
                  conditions = JSON.parse(v.conditionsJson) as Record<string, unknown>;
                  actionsParsed = JSON.parse(v.actionsJson);
                } catch {
                  toast.error("Invalid JSON in conditions or actions");
                  return;
                }
                const actions = Array.isArray(actionsParsed)
                  ? actionsParsed
                  : [actionsParsed];
                createR.mutate(
                  {
                    name: v.name,
                    trigger_type: v.trigger_type,
                    conditions,
                    actions,
                    enabled: v.enabled,
                  },
                  {
                    onSuccess: () => {
                      toast.success("Rule created");
                      form.reset();
                    },
                    onError: () => toast.error("Could not create rule"),
                  },
                );
              })}
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input className="bg-surface-inner" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="trigger_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trigger</FormLabel>
                    <FormControl>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-surface-inner px-3 text-sm"
                        {...field}
                      >
                        <option value="kpi">KPI</option>
                        <option value="workflow">Workflow</option>
                        <option value="ai">AI insight</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="conditionsJson"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conditions (JSON)</FormLabel>
                    <FormControl>
                      <Textarea className="min-h-[120px] bg-surface-inner font-mono text-xs" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="actionsJson"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Actions (JSON array)</FormLabel>
                    <FormControl>
                      <Textarea className="min-h-[120px] bg-surface-inner font-mono text-xs" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">Enabled</FormLabel>
                  </FormItem>
                )}
              />
              <Button type="submit" variant="cta" disabled={createR.isPending}>
                {createR.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Add rule
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/90 shadow-card">
        <CardHeader>
          <CardTitle>Active rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rulesQ.isLoading ? (
            <Skeleton className="h-24 w-full rounded-xl bg-surface-inner" />
          ) : rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No alert rules yet.</p>
          ) : (
            rules.map((r: AlertRuleRow) => (
              <div
                key={r.id}
                className="flex flex-col gap-3 rounded-xl border border-border/60 bg-surface-inner p-4 transition-all duration-150 hover:border-primary/30 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-semibold text-foreground">{r.name}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Badge variant="outline">{r.trigger_type}</Badge>
                    <Badge variant={r.enabled ? "default" : "secondary"}>
                      {r.enabled ? "on" : "off"}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() =>
                      updateR.mutate(
                        { id: r.id, enabled: !r.enabled },
                        {
                          onSuccess: () => toast.success("Rule updated"),
                          onError: () => toast.error("Update failed"),
                        },
                      )
                    }
                  >
                    Toggle
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    type="button"
                    onClick={() =>
                      delR.mutate(r.id, {
                        onSuccess: () => toast.success("Rule removed"),
                        onError: () => toast.error("Delete failed"),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function NotificationSchedulesTab() {
  const schQ = useNotificationSchedulesQuery();
  const createS = useCreateScheduleMutation();
  const schedules = Array.isArray(schQ.data) ? schQ.data : [];

  const form = useForm<z.infer<typeof scheduleSchema>>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      name: "Weekly report digest",
      cronExpression: "0 8 * * 1",
      payloadJson: JSON.stringify({ template: "exec_weekly" }, null, 2),
      active: true,
    },
  });

  return (
    <div className="space-y-6">
      <Card className="border-border/80 bg-card/90 shadow-card">
        <CardHeader>
          <CardTitle>Scheduled deliveries</CardTitle>
          <CardDescription>
            Cron + payload templates. A worker should advance <code className="text-xs">next_run_at</code>{" "}
            in production.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              className="space-y-4 max-w-xl"
              onSubmit={form.handleSubmit((v) => {
                let payload_template: Record<string, unknown> = {};
                if (v.payloadJson?.trim()) {
                  try {
                    payload_template = JSON.parse(v.payloadJson) as Record<string, unknown>;
                  } catch {
                    toast.error("Invalid payload JSON");
                    return;
                  }
                }
                createS.mutate(
                  {
                    name: v.name,
                    cron_expression: v.cronExpression,
                    payload_template,
                    active: v.active,
                  },
                  {
                    onSuccess: () => {
                      toast.success("Schedule created");
                      form.reset();
                    },
                    onError: () => toast.error("Could not create schedule"),
                  },
                );
              })}
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input className="bg-surface-inner" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cronExpression"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cron expression</FormLabel>
                    <FormControl>
                      <Input className="bg-surface-inner font-mono text-sm" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="payloadJson"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payload template (JSON)</FormLabel>
                    <FormControl>
                      <Textarea className="min-h-[100px] bg-surface-inner font-mono text-xs" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">Active</FormLabel>
                  </FormItem>
                )}
              />
              <Button type="submit" variant="cta" disabled={createS.isPending}>
                {createS.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Save schedule
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/90 shadow-card">
        <CardHeader>
          <CardTitle>Existing schedules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {schQ.isLoading ? (
            <Skeleton className="h-20 w-full rounded-xl bg-surface-inner" />
          ) : schedules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No schedules yet.</p>
          ) : (
            schedules.map((s: NotificationScheduleRow) => (
              <div
                key={s.id}
                className={cn(
                  "rounded-lg border border-border/60 px-3 py-2 text-sm",
                  s.active ? "border-success/30" : "opacity-70",
                )}
              >
                <p className="font-medium text-foreground">{s.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{s.cron_expression}</p>
                {s.next_run_at ? (
                  <p className="text-xs text-muted-foreground">
                    Next: {new Date(s.next_run_at).toLocaleString()}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
