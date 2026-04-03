import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { History, Plus, Trash2 } from "lucide-react";

import { ModuleLivePreview } from "@/components/modules/module-live-preview";
import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import {
  useCompanyDepartmentsQuery,
  useCompanyRolesQuery,
  useDeleteModuleMutation,
  useInternalModuleDetail,
  useModuleAudit,
  usePublishModuleVersionMutation,
  useRollbackModuleMutation,
  useSetModuleDepartmentsMutation,
  useUpdateModuleMutation,
} from "@/hooks/use-modules";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  MODULE_ACTIONS,
  type ModuleDataBinding,
  type ModulePermissionRow,
} from "@/types/modules";

const bindingSchema = z.object({
  bindingName: z.string().min(1),
  sourceContext: z.string().min(1),
  targetEntity: z.string().min(1),
  fieldMapKey: z.string().optional(),
  fieldMapValue: z.string().optional(),
});

const editSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  ui_entry: z.string().min(1),
  status: z.enum(["draft", "published", "deprecated", "archived"]),
  tagsRaw: z.string().optional(),
  bindings: z.array(bindingSchema),
});

type EditFormValues = z.infer<typeof editSchema>;

function tagsToRaw(tags: unknown): string {
  const t = Array.isArray(tags) ? tags : [];
  return t.map(String).join(", ");
}

function permissionsToMap(rows: ModulePermissionRow[]): Record<string, string[]> {
  const m: Record<string, string[]> = {};
  const list = Array.isArray(rows) ? rows : [];
  for (const p of list) {
    if (!p.roleId) continue;
    m[p.roleId] = Array.isArray(p.actions) ? [...p.actions] : [];
  }
  return m;
}

export default function EditModulePage() {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const { tenant, profile } = useAuth();
  const { data: bundle, isLoading } = useInternalModuleDetail(moduleId);
  const { data: roles = [] } = useCompanyRolesQuery();
  const { data: departments = [] } = useCompanyDepartmentsQuery();
  const { data: audit = [] } = useModuleAudit(moduleId);

  const updateMutation = useUpdateModuleMutation();
  const versionMutation = usePublishModuleVersionMutation();
  const rollbackMutation = useRollbackModuleMutation();
  const deleteMutation = useDeleteModuleMutation();
  const deptMutation = useSetModuleDepartmentsMutation();

  const [rollbackTarget, setRollbackTarget] = useState<string | null>(null);
  const [permDraft, setPermDraft] = useState<Record<string, string[]>>({});
  const [deptSelected, setDeptSelected] = useState<string[]>([]);
  const [bindingsDirty, setBindingsDirty] = useState(false);

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: "",
      description: "",
      ui_entry: "",
      status: "draft",
      tagsRaw: "",
      bindings: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "bindings",
  });

  useEffect(() => {
    if (!bundle?.module) return;
    const m = bundle.module;
    const rawBindings = Array.isArray(m.data_bindings)
      ? (m.data_bindings as ModuleDataBinding[])
      : [];
    const bindings = rawBindings.map((b) => {
      const fm =
        b.fieldMappings && typeof b.fieldMappings === "object"
          ? b.fieldMappings
          : {};
      const keys = Object.keys(fm);
      const fieldMapKey = keys[0] ?? "";
      const fieldMapValue = keys[0] ? String(fm[keys[0]]) : "";
      return {
        bindingName: b.bindingName ?? "",
        sourceContext: b.sourceContext ?? "",
        targetEntity: b.targetEntity ?? "",
        fieldMapKey,
        fieldMapValue,
      };
    });
    if (bindings.length === 0) {
      bindings.push({
        bindingName: "primary",
        sourceContext: "unified_entities",
        targetEntity: "",
        fieldMapKey: "",
        fieldMapValue: "",
      });
    }
    form.reset({
      name: m.name,
      description: m.description ?? "",
      ui_entry: m.ui_entry ?? "",
      status: (m.status?.toLowerCase() as EditFormValues["status"]) ?? "draft",
      tagsRaw: tagsToRaw(m.tags),
      bindings,
    });
    setBindingsDirty(false);

    const perms = Array.isArray(m.permissions) ? m.permissions : [];
    setPermDraft(permissionsToMap(perms as ModulePermissionRow[]));

    const dbs = Array.isArray(bundle.departmentBindings)
      ? bundle.departmentBindings
      : [];
    setDeptSelected(dbs.map((d) => d.department_id).filter(Boolean));
  }, [bundle, form]);

  const watched = form.watch(["ui_entry", "bindings", "name"]);

  const previewBindings = useMemo(() => {
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

  const versions = useMemo(() => {
    const v = bundle?.versions;
    return Array.isArray(v)
      ? [...v].sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime(),
        )
      : [];
  }, [bundle?.versions]);

  const auditRows = Array.isArray(audit) ? audit : [];
  const roleRows = Array.isArray(roles) ? roles : [];
  const deptRows = Array.isArray(departments) ? departments : [];

  const onSave = form.handleSubmit(async (v) => {
    if (!moduleId) return;
    const tags = (v.tagsRaw ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const data_bindings = (v.bindings ?? []).map((b) => {
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
    });

    const permPayload: ModulePermissionRow[] = Object.entries(permDraft).map(
      ([roleId, actions]) => ({
        roleId,
        actions: Array.isArray(actions) ? actions : [],
        scope: "module",
      }),
    );

    const result = await updateMutation.mutateAsync({
      id: moduleId,
      name: v.name.trim(),
      description: (v.description ?? "").trim(),
      ui_entry: v.ui_entry.trim(),
      status: v.status,
      tags,
      data_bindings,
      permissions: permPayload,
    });

    if (!result?.module) {
      toast.error("Save failed");
      return;
    }

    if (result.migrationHint) {
      toast.message("Migration note", { description: result.migrationHint });
    }

    const deptOk = await deptMutation.mutateAsync({
      moduleId,
      bindings: deptSelected.map((id) => ({
        departmentId: id,
        accessLevel: "read" as const,
      })),
    });
    if (!deptOk) toast.error("Department assignment failed");

    toast.success("Module saved");
    setBindingsDirty(false);
  });

  if (!moduleId) {
    return (
      <AnimatedPage>
        <p className="text-muted-foreground">Missing module id.</p>
      </AnimatedPage>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <AnimatedPage>
        <Card>
          <CardHeader>
            <CardTitle>Supabase required</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild variant="cta">
              <Link to="/dashboard/modules">Back to hub</Link>
            </Button>
          </CardContent>
        </Card>
      </AnimatedPage>
    );
  }

  if (isLoading && !bundle) {
    return (
      <AnimatedPage className="space-y-6">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-[520px] w-full" />
      </AnimatedPage>
    );
  }

  if (!bundle?.module) {
    return (
      <AnimatedPage>
        <Card>
          <CardHeader>
            <CardTitle>Module not found</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button asChild variant="cta">
              <Link to="/dashboard/modules">Back to hub</Link>
            </Button>
          </CardContent>
        </Card>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title={bundle.module.name}
        description="Version history, rollback, department assignment, permissions, and audit trail."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/dashboard/modules">← Modules hub</Link>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={async () => {
                const ok = await deleteMutation.mutateAsync(moduleId);
                if (ok) {
                  toast.success("Module uninstalled");
                  navigate("/dashboard/modules", { replace: true });
                } else toast.error("Uninstall failed");
              }}
            >
              Uninstall
            </Button>
            <Button
              variant="cta"
              size="sm"
              disabled={updateMutation.isPending}
              onClick={() => void onSave()}
            >
              Save changes
            </Button>
          </div>
        }
      />

      {bindingsDirty ? (
        <div
          role="status"
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
        >
          Binding changes may require a migration: validate consumers and publish a
          new version when ready.
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <Card className="border-border/80 bg-card/90 shadow-card">
            <CardHeader>
              <CardTitle className="font-display">Edit manifest</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
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
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={3}
                            className="bg-surface-inner"
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
                      name="ui_entry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>UI entry</FormLabel>
                          <FormControl>
                            <Input className="bg-surface-inner" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="bg-surface-inner">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="published">Published</SelectItem>
                              <SelectItem value="deprecated">
                                Deprecated
                              </SelectItem>
                              <SelectItem value="archived">Archived</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="tagsRaw"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tags</FormLabel>
                        <FormControl>
                          <Input className="bg-surface-inner" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Data bindings
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => {
                          append({
                            bindingName: "",
                            sourceContext: "unified_entities",
                            targetEntity: "",
                            fieldMapKey: "",
                            fieldMapValue: "",
                          });
                          setBindingsDirty(true);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        Add
                      </Button>
                    </div>
                    {fields.map((f, index) => (
                      <div
                        key={f.id}
                        className="space-y-2 rounded-xl border border-border/60 bg-surface-inner/30 p-3"
                      >
                        <div className="flex justify-end">
                          {fields.length > 1 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => {
                                remove(index);
                                setBindingsDirty(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <FormField
                            control={form.control}
                            name={`bindings.${index}.bindingName`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Name</FormLabel>
                                <FormControl>
                                  <Input
                                    className="bg-surface-inner"
                                    {...field}
                                    onChange={(e) => {
                                      field.onChange(e);
                                      setBindingsDirty(true);
                                    }}
                                  />
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
                                <FormLabel>Source</FormLabel>
                                <FormControl>
                                  <Input
                                    className="bg-surface-inner"
                                    {...field}
                                    onChange={(e) => {
                                      field.onChange(e);
                                      setBindingsDirty(true);
                                    }}
                                  />
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
                                <FormLabel>Target</FormLabel>
                                <FormControl>
                                  <Input
                                    className="bg-surface-inner"
                                    {...field}
                                    onChange={(e) => {
                                      field.onChange(e);
                                      setBindingsDirty(true);
                                    }}
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
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/90">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Version history
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Input
                  className="max-w-[140px] bg-surface-inner"
                  placeholder="1.1.0"
                  id="new-version-tag"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={versionMutation.isPending}
                  onClick={async () => {
                    const el = document.getElementById(
                      "new-version-tag",
                    ) as HTMLInputElement | null;
                    const tag = el?.value?.trim();
                    if (!tag) {
                      toast.error("Enter version tag");
                      return;
                    }
                    const v = await versionMutation.mutateAsync({
                      moduleId,
                      versionTag: tag,
                      changelog: "Published from manage screen",
                      bindingDiff: {},
                    });
                    if (v) toast.success(`Version ${tag} created`);
                    else toast.error("Version create failed");
                  }}
                >
                  Publish version
                </Button>
              </div>
              <ScrollArea className="h-48 rounded-lg border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tag</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead>When</TableHead>
                      <TableHead className="text-right">Rollback</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {versions.map((ver) => (
                      <TableRow key={ver.id}>
                        <TableCell className="font-mono text-xs">
                          {ver.version_tag}
                        </TableCell>
                        <TableCell>
                          {ver.is_active ? (
                            <Badge>active</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(ver.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {!ver.is_active ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setRollbackTarget(ver.id)}
                            >
                              Rollback
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/90">
            <CardHeader>
              <CardTitle className="font-display">Department assignment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {deptRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No departments — create under Departments first.
                </p>
              ) : (
                deptRows.map((d) => (
                  <label
                    key={d.id}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={deptSelected.includes(d.id)}
                      onCheckedChange={(c) => {
                        if (c === true) {
                          setDeptSelected((prev) => [...prev, d.id]);
                        } else {
                          setDeptSelected((prev) =>
                            prev.filter((x) => x !== d.id),
                          );
                        }
                      }}
                    />
                    {d.name}
                  </label>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/90">
            <CardHeader>
              <CardTitle className="font-display">Role permissions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {roleRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No roles.</p>
              ) : (
                roleRows.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-lg border border-border/60 p-3"
                  >
                    <p className="mb-2 text-sm font-medium">{r.name}</p>
                    <div className="flex flex-wrap gap-3">
                      {MODULE_ACTIONS.map((action) => (
                        <label
                          key={action}
                          className="flex items-center gap-2 text-xs"
                        >
                          <Checkbox
                            checked={(permDraft[r.id] ?? []).includes(action)}
                            onCheckedChange={(c) => {
                              setPermDraft((prev) => {
                                const cur = [...(prev[r.id] ?? [])];
                                if (c === true) {
                                  if (!cur.includes(action)) cur.push(action);
                                } else {
                                  const i = cur.indexOf(action);
                                  if (i >= 0) cur.splice(i, 1);
                                }
                                return { ...prev, [r.id]: cur };
                              });
                            }}
                          />
                          {action}
                        </label>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/90">
            <CardHeader>
              <CardTitle className="font-display">Audit trail</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-40">
                <ul className="space-y-2 text-xs text-muted-foreground">
                  {auditRows.length === 0 ? (
                    <li>No audit entries yet.</li>
                  ) : (
                    auditRows.map((a) => (
                      <li key={a.id} className="border-b border-border/40 pb-2">
                        <span className="text-foreground">{a.event_type}</span> ·{" "}
                        {new Date(a.created_at).toLocaleString()}
                      </li>
                    ))
                  )}
                </ul>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-5">
          <ModuleLivePreview
            uiEntry={watched[0] || ""}
            bindings={previewBindings}
            context={{
              tenantLabel: tenant?.name ?? "Tenant",
              userRole:
                Array.isArray(profile?.roles) && profile.roles.length > 0
                  ? String(profile.roles[0])
                  : "member",
              department:
                deptSelected.length > 0
                  ? `${deptSelected.length} departments`
                  : "All departments",
            }}
          />
        </div>
      </div>

      <AlertDialog
        open={!!rollbackTarget}
        onOpenChange={(o) => !o && setRollbackTarget(null)}
      >
        <AlertDialogContent className="border-border/80 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm rollback</AlertDialogTitle>
            <AlertDialogDescription>
              Restores manifest from the selected snapshot. Review bindings and
              permissions afterward.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!rollbackTarget) return;
                const res = await rollbackMutation.mutateAsync({
                  moduleId,
                  versionId: rollbackTarget,
                });
                setRollbackTarget(null);
                if (res?.ok) {
                  toast.success("Rolled back", {
                    description: (res.migrationPlan?.steps ?? []).join(" "),
                  });
                } else toast.error("Rollback failed");
              }}
            >
              Confirm rollback
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AnimatedPage>
  );
}
