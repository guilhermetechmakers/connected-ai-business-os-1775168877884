import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Shield,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { AnimatedPage } from "@/components/animated-page";
import { PublicChrome } from "@/components/layout/public-chrome";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useCreateConnectorMutation,
  useReplaceMappingsMutation,
  useTriggerSyncMutation,
  useUpsertCredentialsMutation,
} from "@/hooks/use-integrations";
import { CONNECTOR_PROVIDERS } from "@/lib/connector-registry";
import type { ProviderDefinition } from "@/types/integrations";
import { cn } from "@/lib/utils";

const steps = ["Choose provider", "Authorize", "Map fields", "Test & schedule"] as const;

const authFormSchema = z.object({
  client_id: z.string().optional(),
  client_secret: z.string().optional(),
  api_key: z.string().optional(),
});

type AuthForm = z.infer<typeof authFormSchema>;

const ENTITY_OPTIONS = [
  "Conversation",
  "Message",
  "Document",
  "Account",
  "Contact",
  "Opportunity",
  "Activity",
  "User",
] as const;

export default function IntegrationSetupPage() {
  const [step, setStep] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState<ProviderDefinition | null>(
    null,
  );
  const [mappingOverrides, setMappingOverrides] = useState<
    Record<string, (typeof ENTITY_OPTIONS)[number]>
  >({});
  const [createdConnectorId, setCreatedConnectorId] = useState<string | null>(null);
  const [autoSync, setAutoSync] = useState(true);

  const createConnector = useCreateConnectorMutation();
  const upsertCreds = useUpsertCredentialsMutation();
  const replaceMappings = useReplaceMappingsMutation();
  const triggerSync = useTriggerSyncMutation();

  const authForm = useForm<AuthForm>({
    resolver: zodResolver(authFormSchema),
    defaultValues: { client_id: "", client_secret: "", api_key: "" },
  });

  const progress = useMemo(() => ((step + 1) / steps.length) * 100, [step]);

  const activeMappings = useMemo(() => {
    if (!selectedProvider) return [];
    return selectedProvider.defaultMappings.map((m) => ({
      ...m,
      targetEntity: mappingOverrides[m.sourceField] ?? m.targetEntity,
    }));
  }, [selectedProvider, mappingOverrides]);

  const beginProvider = (p: ProviderDefinition) => {
    setSelectedProvider(p);
    setStep(1);
    setCreatedConnectorId(null);
    setMappingOverrides({});
    authForm.reset();
  };

  const handleSaveAuth = authForm.handleSubmit(() => {
    if (!selectedProvider) return;
    createConnector.mutate(
      { providerKey: selectedProvider.key, displayName: selectedProvider.label },
      {
        onSuccess: (res) => {
          const id = res.connector?.id;
          if (!id) {
            toast.error("Connector id missing");
            return;
          }
          setCreatedConnectorId(id);
          const values = authForm.getValues();
          const creds: Record<string, unknown> = {};
          if (values.client_id) creds.client_id = values.client_id;
          if (values.client_secret) creds.client_secret = values.client_secret;
          if (values.api_key) creds.api_key = values.api_key;

          upsertCreds.mutate(
            {
              connectorId: id,
              credentials: creds,
              metadata: { flow: "onboarding" },
            },
            {
              onSuccess: () => {
                toast.success("Credentials secured");
                setStep(2);
              },
              onError: (e) => toast.error(e.message),
            },
          );
        },
        onError: (e) => toast.error(e.message),
      },
    );
  });

  const saveMappings = () => {
    if (!createdConnectorId) return;
    replaceMappings.mutate(
      {
        connectorId: createdConnectorId,
        mappings: activeMappings.map((m) => ({
          sourceField: m.sourceField,
          targetEntity: m.targetEntity,
          targetField: m.targetField,
          dataType: m.dataType,
        })),
      },
      {
        onSuccess: () => {
          toast.success("Mappings saved");
          setStep(3);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const runTestSync = () => {
    if (!createdConnectorId) return;
    triggerSync.mutate(
      {
        connectorId: createdConnectorId,
        idempotencyKey: `onboarding-${createdConnectorId}`,
      },
      {
        onSuccess: () => toast.success("Test sync finished"),
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <PublicChrome>
      <AnimatedPage className="px-6 py-16 lg:px-24">
        <div className="mx-auto max-w-5xl space-y-10">
          <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/80 p-8 shadow-card">
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              aria-hidden
            >
              <div className="absolute -left-24 top-0 h-64 w-64 rounded-full bg-primary/20 blur-3xl animate-pulse" />
              <div className="absolute -right-16 bottom-0 h-56 w-56 rounded-full bg-secondary/40 blur-3xl" />
            </div>
            <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                  Onboarding
                </p>
                <h1 className="mt-2 font-display text-4xl font-extrabold md:text-5xl">
                  Connect <span className="text-gradient-accent">integrations</span>
                </h1>
                <p className="mt-2 max-w-2xl text-muted-foreground">
                  Guided OAuth/API key capture, field mapping preview, idempotent test
                  sync, and scheduling. All secrets stay server-side via Edge Functions.
                </p>
              </div>
              <Button variant="cta" asChild>
                <Link to="/dashboard">Go to dashboard</Link>
              </Button>
            </div>
          </div>

          <Card className="border-border/80 bg-card/90 shadow-card">
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Stepper
                  </CardTitle>
                  <CardDescription>
                    Progressive disclosure: credentials → mapping preview → validation.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="border-primary/40 text-primary">
                  Step {step + 1} of {steps.length}
                </Badge>
              </div>
              <Progress value={progress} className="mt-4 h-2" />
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {steps.map((label, i) => (
                  <div
                    key={label}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm transition-all duration-150",
                      i === step
                        ? "border-primary/50 bg-primary/10 text-foreground"
                        : i < step
                          ? "border-success/40 bg-success/10 text-success"
                          : "border-border/60 bg-surface-inner text-muted-foreground",
                    )}
                  >
                    {label}
                  </div>
                ))}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {step === 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {CONNECTOR_PROVIDERS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => beginProvider(p)}
                      className={cn(
                        "rounded-2xl border border-border/70 bg-surface-inner p-4 text-left transition-all duration-150",
                        "hover:-translate-y-1 hover:border-primary/40 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-display text-lg font-semibold text-foreground">
                            {p.label}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {p.description}
                          </p>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-[10px] uppercase">
                          {p.auth}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {p.capabilities.slice(0, 3).map((c) => (
                          <span
                            key={c}
                            className="rounded-full border border-border/50 px-2 py-0.5 text-[10px] text-foreground"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}

              {step === 1 && selectedProvider ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Shield className="h-4 w-4 text-primary" />
                    Scopes are least-privilege by default. Values are masked after save.
                  </div>
                  <Form {...authForm}>
                    <form className="grid gap-4 md:grid-cols-2">
                      {selectedProvider.auth === "oauth2" ||
                      selectedProvider.auth === "both" ? (
                        <>
                          <FormField
                            control={authForm.control}
                            name="client_id"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Client ID</FormLabel>
                                <FormControl>
                                  <Input className="bg-surface-inner" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={authForm.control}
                            name="client_secret"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Client secret</FormLabel>
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
                        </>
                      ) : null}
                      {selectedProvider.auth === "api_key" ||
                      selectedProvider.auth === "both" ? (
                        <FormField
                          control={authForm.control}
                          name="api_key"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel>API key</FormLabel>
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
                      ) : null}
                    </form>
                  </Form>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="ghost" onClick={() => setStep(0)}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button
                      type="button"
                      variant="cta"
                      onClick={handleSaveAuth}
                      disabled={createConnector.isPending || upsertCreds.isPending}
                    >
                      {(createConnector.isPending || upsertCreds.isPending) && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Save & continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : null}

              {step === 2 && selectedProvider ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Map provider fields to unified entities. Adjust targets to match your
                    canonical model.
                  </p>
                  <div className="overflow-hidden rounded-xl border border-border/60">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/60 hover:bg-transparent">
                          <TableHead>Source field</TableHead>
                          <TableHead>Unified entity</TableHead>
                          <TableHead>Target field</TableHead>
                          <TableHead>Type</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeMappings.map((row) => (
                          <TableRow key={row.sourceField} className="border-border/60">
                            <TableCell className="font-mono text-xs text-primary">
                              {row.sourceField}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={row.targetEntity}
                                onValueChange={(v) =>
                                  setMappingOverrides((prev) => ({
                                    ...prev,
                                    [row.sourceField]: v as (typeof ENTITY_OPTIONS)[number],
                                  }))
                                }
                              >
                                <SelectTrigger
                                  aria-label={`Target entity for ${row.sourceField}`}
                                  className="bg-surface-inner"
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ENTITY_OPTIONS.map((opt) => (
                                    <SelectItem key={opt} value={opt}>
                                      {opt}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-sm">{row.targetField}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {row.dataType}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button
                      type="button"
                      variant="cta"
                      onClick={saveMappings}
                      disabled={!createdConnectorId || replaceMappings.isPending}
                    >
                      {replaceMappings.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Save mappings
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-success/30 bg-success/10 p-4 text-sm text-foreground">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
                      <div>
                        <p className="font-semibold">Ready to sync</p>
                        <p className="text-muted-foreground">
                          Manual sync uses idempotency keys. Auto-sync respects the
                          connector interval once enabled.
                        </p>
                      </div>
                    </div>
                  </div>
                  <label className="flex items-center justify-between rounded-lg border border-border/60 bg-surface-inner px-4 py-3 text-sm">
                    <span>Enable auto-sync schedule</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={autoSync}
                      onChange={(e) => setAutoSync(e.target.checked)}
                      aria-label="Enable auto sync"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="ghost" onClick={() => setStep(2)}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button
                      type="button"
                      variant="cta"
                      onClick={runTestSync}
                      disabled={!createdConnectorId || triggerSync.isPending}
                    >
                      {triggerSync.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Test sync
                    </Button>
                    <Button type="button" variant="outline" asChild>
                      <Link to="/dashboard/settings">Open settings</Link>
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
            <CardFooter className="flex flex-wrap gap-3 border-t border-border/60">
              <p className="text-xs text-muted-foreground">
                Provider:{" "}
                <span className="text-foreground">
                  {selectedProvider?.label ?? "Not selected"}
                </span>
                {selectedProvider?.auth === "oauth2" ? " · OAuth2" : null}
              </p>
            </CardFooter>
          </Card>

          <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/10 p-4 text-sm text-foreground">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
            <div>
              <p className="font-semibold">Health checks</p>
              <p className="text-muted-foreground">
                Each connector reports rate limits, schema drift, and last sync in the
                Activity log with redaction rules applied.
              </p>
            </div>
          </div>
        </div>
      </AnimatedPage>
    </PublicChrome>
  );
}
