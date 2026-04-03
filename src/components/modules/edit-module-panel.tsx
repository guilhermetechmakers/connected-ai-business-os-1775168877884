import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import {
  AlertTriangle,
  History,
  Rocket,
  Trash2,
  Undo2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { ModuleLivePreview } from "@/components/modules/module-live-preview";
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
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import {
  useCompanyDepartmentsQuery,
  useCompanyRolesQuery,
  useDeleteModuleMutation,
  useDeployModuleMutation,
  useInternalModuleDetail,
  useModuleAudit,
  usePublishModuleVersionMutation,
  usePutModulePermissionsMutation,
  useRollbackModuleMutation,
  useSetModuleDepartmentsMutation,
  useUpdateModuleMutation,
} from "@/hooks/use-modules";
import {
  normalizeModuleDataBindings,
  normalizeModulePermissions,
  summarizeBindings,
} from "@/api/modules";
import type { InternalModuleDepartmentBindingRow } from "@/types/modules";
import { MODULE_ACTIONS, type ModulePermissionRow } from "@/types/modules";

const editSchema = z.object({
  name: z.string().min(2),
  description: z.string().max(5000).optional(),
  ui_entry: z.string().min(1),
  tagsRaw: z.string().optional(),
});

type EditForm = z.infer<typeof editSchema>;

export function EditModulePanel({ moduleId }: { moduleId: string }) {
  const navigate = useNavigate();
  const { tenant, profile } = useAuth();
  const { data: detail, isLoading, isError, refetch } =
    useInternalModuleDetail(moduleId);
  const { data: departments = [] } = useCompanyDepartmentsQuery();
  const { data: roles = [] } = useCompanyRolesQuery();
  const { data: audit = [] } = useModuleAudit(moduleId);

  const updateMutation = useUpdateModuleMutation();
  const deleteMutation = useDeleteModuleMutation();
  const deployMutation = useDeployModuleMutation();
  const publishMutation = usePublishModuleVersionMutation();
  const rollbackMutation = useRollbackModuleMutation();
  const deptMutation = useSetModuleDepartmentsMutation();
  const permMutation = usePutModulePermissionsMutation();

  const [versionTag, setVersionTag] = useState("");
  const [changelog, setChangelog] = useState("");
  const [rollbackId, setRollbackId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [permRows, setPermRows] = useState<ModulePermissionRow[]>([]);

  const form = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: "",
      description: "",
      ui_entry: "/dashboard/modules/preview",
      tagsRaw: "",
    },
  });

  const mod = detail?.module;
  const versions = Array.isArray(detail?.versions) ? detail!.versions : [];
  const deptBindings: InternalModuleDepartmentBindingRow[] = Array.isArray(
    detail?.departmentBindings,
  )
    ? detail!.departmentBindings
    : [];

  useEffect(() => {
    if (!mod) return;
    form.reset({
      name: mod.name,
      description: mod.description ?? "",
      ui_entry: mod.ui_entry,
      tagsRaw: (Array.isArray(mod.tags) ? mod.tags : []).join(", "),
    });
    setPermRows(normalizeModulePermissions(mod.permissions));
  }, [mod, form]);

  const deptList = Array.isArray(departments) ? departments : [];
  const roleList = Array.isArray(roles) ? roles : [];
  const selectedDeptIds = new Set(deptBindings.map((d) => d.department_id));

  const previewContext = useMemo(
    () => ({
      tenantLabel: tenant?.name ?? "Your tenant",
      userRole:
        Array.isArray(profile?.roles) && profile.roles.length > 0
          ? String(profile.roles[0])
          : "member",
      department: "All departments",
    }),
    [tenant?.name, profile?.roles],
  );

  const previewBindings = useMemo(() => {
    if (!mod) return [];
    return normalizeModuleDataBindings(mod.data_bindings);
  }, [mod]);

  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !mod) {
    return (
      <Card className="border-destructive/40 bg-card/80">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Module not found or failed to load.
        </CardContent>
      </Card>
    );
  }

  async function onSaveMetadata(values: EditForm) {
    const tags = (values.tagsRaw ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const res = await updateMutation.mutateAsync({
      id: moduleId,
      name: values.name,
      description: values.description,
      ui_entry: values.ui_entry,
      tags,
    });
    if (!res) {
      toast.error("Update failed");
      return;
    }
    if (res.migrationHint) {
      toast.message("Migration note", { description: res.migrationHint });
    } else {
      toast.success("Saved");
    }
    void refetch();
  }

  async function toggleDepartment(deptId: string, checked: boolean) {
    const next = new Set(selectedDeptIds);
    if (checked) next.add(deptId);
    else next.delete(deptId);
    const bindings = [...next].map((id) => ({
      departmentId: id,
      accessLevel: "read" as const,
    }));
    const ok = await deptMutation.mutateAsync({ moduleId, bindings });
    if (!ok) toast.error("Could not update departments");
    else toast.success("Department access updated");
    void refetch();
  }

  function updatePermRow(
    index: number,
    patch: Partial<ModulePermissionRow>,
  ) {
    setPermRows((rows) => {
      const list = [...rows];
      const cur = list[index] ?? { roleId: "", actions: [], scope: "module" };
      list[index] = { ...cur, ...patch };
      return list;
    });
  }

  async function savePermissions() {
    const ok = await permMutation.mutateAsync({
      moduleId,
      permissions: permRows.filter((r) => r.roleId.length > 0),
    });
    if (!ok) toast.error("Could not save permissions");
    else toast.success("Permissions saved");
    void refetch();
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/80 bg-card/90 shadow-card">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="font-display">Manifest</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Bindings: {summarizeBindings(previewBindings)}
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="gap-1"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Uninstall
            </Button>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSaveMetadata)}
                className="space-y-4"
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
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea rows={3} className="bg-surface-inner" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ui_entry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UI entry</FormLabel>
                      <FormControl>
                        <Input className="bg-surface-inner font-mono text-sm" {...field} />
                      </FormControl>
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
                        <Input className="bg-surface-inner" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" variant="cta" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving…" : "Save changes"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <ModuleLivePreview
          uiEntry={form.watch("ui_entry") || mod.ui_entry}
          bindings={previewBindings}
          context={previewContext}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/80 bg-card/90">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <History className="h-5 w-5 text-primary" aria-hidden />
              Version history
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScrollArea className="h-48 pr-3">
              <ul className="space-y-2 text-sm">
                {(versions ?? []).map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-surface-inner/40 px-3 py-2"
                  >
                    <span>
                      <span className="font-medium text-foreground">{v.version_tag}</span>
                      {v.is_active ? (
                        <span className="ml-2 text-xs text-success">active</span>
                      ) : null}
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {format(new Date(v.created_at), "PPp")}
                      </span>
                    </span>
                    {!v.is_active ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1 shrink-0"
                        onClick={() => setRollbackId(v.id)}
                      >
                        <Undo2 className="h-3.5 w-3.5" aria-hidden />
                        Rollback
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </ScrollArea>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="vtag">Publish new version</Label>
              <Input
                id="vtag"
                className="bg-surface-inner"
                placeholder="e.g. 1.1.0"
                value={versionTag}
                onChange={(e) => setVersionTag(e.target.value)}
              />
              <Textarea
                className="bg-surface-inner"
                placeholder="Changelog"
                value={changelog}
                onChange={(e) => setChangelog(e.target.value)}
                rows={2}
              />
              <Button
                type="button"
                variant="secondary"
                className="gap-1"
                disabled={publishMutation.isPending || !versionTag.trim()}
                onClick={async () => {
                  const v = await publishMutation.mutateAsync({
                    moduleId,
                    versionTag: versionTag.trim(),
                    changelog: changelog.trim(),
                  });
                  if (!v) toast.error("Publish failed");
                  else {
                    toast.success("Version published", { description: v.version_tag });
                    setVersionTag("");
                    setChangelog("");
                  }
                  void refetch();
                }}
              >
                Publish snapshot
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/90">
          <CardHeader>
            <CardTitle className="font-display">Deploy & health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Status: <span className="text-foreground">{mod.status}</span> · Health:{" "}
              <span className="text-foreground">{mod.health_status}</span>
            </p>
            {mod.last_deployed_at ? (
              <p>
                Last deployed:{" "}
                {format(new Date(mod.last_deployed_at), "PPp")}
              </p>
            ) : (
              <p>Not deployed yet.</p>
            )}
            <Button
              type="button"
              variant="cta"
              className="gap-2"
              disabled={deployMutation.isPending}
              onClick={async () => {
                const d = await deployMutation.mutateAsync(moduleId);
                if (!d) toast.error("Deploy failed");
                else toast.success("Deployed", { description: d.name });
                void refetch();
              }}
            >
              <Rocket className="h-4 w-4" aria-hidden />
              Deploy / publish live
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 bg-card/90">
        <CardHeader>
          <CardTitle className="font-display">Department assignment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {deptList.map((d) => (
              <label
                key={d.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/50 bg-surface-inner/40 px-3 py-2"
              >
                <Checkbox
                  checked={selectedDeptIds.has(d.id)}
                  onCheckedChange={(c) => toggleDepartment(d.id, Boolean(c))}
                />
                <span className="text-sm">{d.name}</span>
              </label>
            ))}
          </div>
          {deptList.length === 0 ? (
            <p className="text-sm text-muted-foreground">No departments in tenant.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/90">
        <CardHeader>
          <CardTitle className="font-display">Permission mapping</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {permRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No role rows yet. Add mappings to gate View / Use / DataRead per role.
            </p>
          ) : null}
          {permRows.map((row, index) => (
            <div
              key={`${row.roleId}-${index}`}
              className="space-y-3 rounded-xl border border-border/50 bg-surface-inner/40 p-4"
            >
              <div className="space-y-2">
                <Label>Role</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-surface-inner px-3 text-sm"
                  value={row.roleId ?? ""}
                  onChange={(e) => updatePermRow(index, { roleId: e.target.value })}
                >
                  <option value="">Select…</option>
                  {roleList.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-3">
                {MODULE_ACTIONS.map((act) => (
                  <label key={act} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={(row.actions ?? []).includes(act)}
                      onCheckedChange={(c) => {
                        const cur = row.actions ?? [];
                        updatePermRow(index, {
                          actions: c
                            ? [...cur, act]
                            : cur.filter((a) => a !== act),
                        });
                      }}
                    />
                    {act}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setPermRows((r) => [
                  ...r,
                  { roleId: roleList[0]?.id ?? "", actions: ["View"], scope: "module" },
                ])
              }
            >
              Add row
            </Button>
            <Button
              type="button"
              variant="cta"
              size="sm"
              disabled={permMutation.isPending}
              onClick={() => void savePermissions()}
            >
              Save permissions
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/90">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display">
            <AlertTriangle className="h-5 w-5 text-amber-400" aria-hidden />
            Audit trail
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-40">
            <ul className="space-y-2 text-xs text-muted-foreground">
              {(audit ?? []).length === 0 ? (
                <li>No related activity log entries yet.</li>
              ) : (
                (audit ?? []).map((a) => (
                  <li key={a.id} className="rounded-md bg-surface-inner/50 px-2 py-1">
                    <span className="text-foreground">{a.event_type}</span> ·{" "}
                    {format(new Date(a.created_at), "PPp")}
                  </li>
                ))
              )}
            </ul>
          </ScrollArea>
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(rollbackId)} onOpenChange={() => setRollbackId(null)}>
        <AlertDialogContent className="border-border/80 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Rollback module version?</AlertDialogTitle>
            <AlertDialogDescription>
              Restores snapshot bindings, permissions, and UI entry from the selected
              version. Review integrations and workflows afterward.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!rollbackId) return;
                const res = await rollbackMutation.mutateAsync({
                  moduleId,
                  versionId: rollbackId,
                });
                if (!res?.ok) toast.error("Rollback failed");
                else {
                  toast.success("Rolled back", {
                    description: (res.migrationPlan?.steps ?? []).join(" "),
                  });
                }
                setRollbackId(null);
                void refetch();
              }}
            >
              Confirm rollback
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="border-border/80 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this module?</AlertDialogTitle>
            <AlertDialogDescription>
              Removes the module, versions, and department bindings for this tenant.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                const ok = await deleteMutation.mutateAsync(moduleId);
                if (!ok) toast.error("Delete failed");
                else {
                  toast.success("Module removed");
                  navigate("/dashboard/modules");
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
