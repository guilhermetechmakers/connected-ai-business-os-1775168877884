import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";

import { ModuleLivePreview, type PreviewContext } from "@/components/modules/module-live-preview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MODULE_ACTIONS, type ModuleDataBinding } from "@/types/modules";

const bindingSchema = z.object({
  bindingName: z.string().min(1, "Binding name required"),
  sourceContext: z.string().min(1, "Source required"),
  targetEntity: z.string().min(1, "Target entity required"),
  fieldMapKey: z.string().optional(),
  fieldMapValue: z.string().optional(),
});

const formSchema = z
  .object({
    name: z.string().min(2, "Name at least 2 characters"),
    description: z.string().max(4000).optional(),
    uiEntry: z.string().min(1, "UI entry required"),
    tagsRaw: z.string().optional(),
    scopeCurrent: z.boolean(),
    scopeSubsidiaries: z.boolean(),
    bindings: z.array(bindingSchema).default([]),
    roleId: z.union([z.string().uuid(), z.literal("")]).optional(),
    roleActions: z.array(z.string()).default([]),
  })
  .superRefine((data, ctx) => {
    if (!data.scopeCurrent && !data.scopeSubsidiaries) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select at least one tenant scope",
        path: ["scopeCurrent"],
      });
    }
  });

export type CreateModulePanelValues = z.infer<typeof formSchema>;

type CreateModulePanelProps = {
  previewContext: PreviewContext;
  roleOptions: Array<{ id: string; name: string }>;
  onSubmitValid: (payload: {
    name: string;
    description: string;
    uiEntry: string;
    tenantScope: string[];
    tags: string[];
    dataBindings: ModuleDataBinding[];
    permissions: Array<{ roleId: string; actions: string[]; scope?: string }>;
  }) => void;
  isSubmitting: boolean;
};

const UI_PRESETS = [
  { value: "/dashboard/modules/preview", label: "Default preview route" },
  { value: "widget:deal-summary", label: "Widget: deal summary" },
  { value: "widget:cs-health", label: "Widget: CS health" },
  { value: "route:/workspace/custom", label: "Custom route" },
] as const;

export function CreateModulePanel({
  previewContext,
  roleOptions,
  onSubmitValid,
  isSubmitting,
}: CreateModulePanelProps) {
  const roles = Array.isArray(roleOptions) ? roleOptions : [];

  const form = useForm<CreateModulePanelValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      uiEntry: "/dashboard/modules/preview",
      tagsRaw: "",
      scopeCurrent: true,
      scopeSubsidiaries: false,
      bindings: [
        {
          bindingName: "primary",
          sourceContext: "unified_entities",
          targetEntity: "deal",
          fieldMapKey: "stage",
          fieldMapValue: "payload.stage",
        },
      ],
      roleId: "",
      roleActions: ["View", "Use"],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "bindings",
  });

  const watched = form.watch([
    "uiEntry",
    "bindings",
    "name",
    "description",
  ]);

  const previewBindings: ModuleDataBinding[] = useMemo(() => {
    const raw = watched[1];
    const list = Array.isArray(raw) ? raw : [];
    return list.map((b) => {
      const fm: Record<string, string> = {};
      if (b.fieldMapKey && b.fieldMapValue) {
        fm[b.fieldMapKey] = b.fieldMapValue;
      }
      return {
        bindingName: b.bindingName,
        sourceContext: b.sourceContext,
        targetEntity: b.targetEntity,
        fieldMappings: fm,
      };
    });
  }, [watched]);

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <div className="space-y-6 lg:col-span-7">
        <Card className="border-border/80 bg-card/90 shadow-card transition-all duration-150 hover:-translate-y-1">
          <CardHeader>
            <CardTitle className="font-display">Module manifest</CardTitle>
            <p className="text-sm text-muted-foreground">
              Metadata, tenant scope, and unified data bindings. Version{" "}
              <span className="text-primary">1.0.0</span> is created on save.
            </p>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                className="space-y-6"
                onSubmit={form.handleSubmit((v) => {
                  const tenantScope: string[] = [];
                  if (v.scopeCurrent) tenantScope.push("current");
                  if (v.scopeSubsidiaries) tenantScope.push("subsidiaries");
                  const tags = (v.tagsRaw ?? "")
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean);
                  const dataBindings: ModuleDataBinding[] = (v.bindings ?? []).map(
                    (b) => {
                      const fieldMappings: Record<string, string> = {};
                      if (b.fieldMapKey && b.fieldMapValue) {
                        fieldMappings[b.fieldMapKey] = b.fieldMapValue;
                      }
                      return {
                        bindingName: b.bindingName,
                        sourceContext: b.sourceContext,
                        targetEntity: b.targetEntity,
                        fieldMappings,
                      };
                    },
                  );
                  const permissions =
                    v.roleId && z.string().uuid().safeParse(v.roleId).success
                      ? [
                          {
                            roleId: v.roleId,
                            actions: Array.isArray(v.roleActions)
                              ? v.roleActions
                              : [],
                            scope: "module",
                          },
                        ]
                      : [];
                  onSubmitValid({
                    name: v.name.trim(),
                    description: (v.description ?? "").trim(),
                    uiEntry: v.uiEntry.trim(),
                    tenantScope,
                    tags,
                    dataBindings,
                    permissions,
                  });
                })}
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Module name</FormLabel>
                      <FormControl>
                        <Input
                          className="bg-surface-inner"
                          placeholder="e.g. Deal desk"
                          autoComplete="off"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          className="bg-surface-inner"
                          placeholder="What this mini-app does for your tenant."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="uiEntry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>UI entry</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-surface-inner">
                              <SelectValue placeholder="Select entry" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {UI_PRESETS.map((p) => (
                              <SelectItem key={p.value} value={p.value}>
                                {p.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tagsRaw"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tags</FormLabel>
                        <FormControl>
                          <Input
                            className="bg-surface-inner"
                            placeholder="comma separated"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-3 rounded-xl border border-border/80 bg-surface-inner/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Tenant scope
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <FormField
                      control={form.control}
                      name="scopeCurrent"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center gap-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              aria-label="Current tenant"
                            />
                          </FormControl>
                          <FormLabel className="!mt-0 font-normal">
                            Current tenant
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="scopeSubsidiaries"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center gap-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              aria-label="Subsidiary tenants"
                            />
                          </FormControl>
                          <FormLabel className="!mt-0 font-normal">
                            Subsidiary tenants
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                  {(form.formState.errors.scopeCurrent?.message ||
                    form.formState.errors.scopeSubsidiaries?.message) && (
                    <p className="text-sm font-medium text-destructive">
                      {form.formState.errors.scopeCurrent?.message ??
                        form.formState.errors.scopeSubsidiaries?.message}
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Data bindings
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() =>
                        append({
                          bindingName: "",
                          sourceContext: "unified_entities",
                          targetEntity: "",
                          fieldMapKey: "",
                          fieldMapValue: "",
                        })
                      }
                    >
                      <Plus className="h-4 w-4" />
                      Add binding
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {fields.map((f, index) => (
                      <div
                        key={f.id}
                        className="space-y-3 rounded-xl border border-border/60 bg-card/50 p-4"
                      >
                        <div className="flex justify-end">
                          {fields.length > 1 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => remove(index)}
                              aria-label="Remove binding"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <FormField
                            control={form.control}
                            name={`bindings.${index}.bindingName`}
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
                            name={`bindings.${index}.sourceContext`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Source context</FormLabel>
                                <FormControl>
                                  <Input className="bg-surface-inner" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`bindings.${index}.targetEntity`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Target entity</FormLabel>
                                <FormControl>
                                  <Input className="bg-surface-inner" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <FormField
                            control={form.control}
                            name={`bindings.${index}.fieldMapKey`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Field key</FormLabel>
                                <FormControl>
                                  <Input
                                    className="bg-surface-inner"
                                    placeholder="e.g. stage"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`bindings.${index}.fieldMapValue`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Maps to</FormLabel>
                                <FormControl>
                                  <Input
                                    className="bg-surface-inner"
                                    placeholder="payload.stage"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-border/80 bg-surface-inner/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Permissions (starter row)
                  </p>
                  {roles.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No roles found — create roles under Settings, or save without
                      permissions and map later in the hub.
                    </p>
                  ) : (
                    <>
                      <FormField
                        control={form.control}
                        name="roleId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Role</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value || undefined}
                            >
                              <FormControl>
                                <SelectTrigger className="bg-surface-inner">
                                  <SelectValue placeholder="Optional" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {roles.map((r) => (
                                  <SelectItem key={r.id} value={r.id}>
                                    {r.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="roleActions"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-muted-foreground">
                              Allowed actions
                            </FormLabel>
                            <div className="mt-2 flex flex-wrap gap-4">
                              {MODULE_ACTIONS.map((action) => (
                                <label
                                  key={action}
                                  className="flex cursor-pointer items-center gap-2 text-sm font-normal"
                                >
                                  <Checkbox
                                    checked={(field.value ?? []).includes(
                                      action,
                                    )}
                                    onCheckedChange={(checked) => {
                                      const cur = field.value ?? [];
                                      if (checked) {
                                        field.onChange([...cur, action]);
                                      } else {
                                        field.onChange(
                                          cur.filter((a) => a !== action),
                                        );
                                      }
                                    }}
                                    aria-label={action}
                                  />
                                  {action}
                                </label>
                              ))}
                            </div>
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="cta"
                  className="transition-transform duration-150 hover:scale-[1.02]"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Creating…" : "Create module · v1.0.0"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-5">
        <ModuleLivePreview
          uiEntry={watched[0] || ""}
          bindings={previewBindings}
          context={previewContext}
        />
      </div>
    </div>
  );
}
