import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus, Shield, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  useSettingsRoleCreateMutation,
  useSettingsRoleDeleteMutation,
  useSettingsRolePatchMutation,
  useSettingsRolesQuery,
} from "@/hooks/use-settings-hub";
import type { SettingsRoleRow } from "@/lib/settings-hub-api";
import { SETTINGS_PERMISSION_CATALOG } from "@/types/settings-hub";

const roleFormSchema = z.object({
  name: z.string().min(1, "Name required").max(120),
  description: z.string().max(500).optional(),
});

type RoleFormValues = z.infer<typeof roleFormSchema>;

function permissionSet(role: SettingsRoleRow | null): Set<string> {
  const p = role?.permissions;
  if (!Array.isArray(p)) return new Set();
  return new Set(p.filter((x): x is string => typeof x === "string"));
}

export function RolesPermissionsEditor() {
  const rolesQuery = useSettingsRolesQuery();
  const createMut = useSettingsRoleCreateMutation();
  const patchMut = useSettingsRolePatchMutation();
  const deleteMut = useSettingsRoleDeleteMutation();

  const [editing, setEditing] = useState<SettingsRoleRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<SettingsRoleRow | null>(null);
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());

  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: { name: "", description: "" },
  });

  const roles = Array.isArray(rolesQuery.data) ? rolesQuery.data : [];

  const openEdit = (r: SettingsRoleRow) => {
    setEditing(r);
    setCreating(false);
    form.reset({ name: r.name, description: r.description ?? "" });
    setSelectedPerms(permissionSet(r));
  };

  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    form.reset({ name: "", description: "" });
    setSelectedPerms(new Set());
  };

  const togglePerm = (key: string) => {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const onSubmit = (vals: RoleFormValues) => {
    const perms = Array.from(selectedPerms);
    if (creating) {
      createMut.mutate(
        {
          name: vals.name.trim(),
          description: vals.description?.trim(),
          permissions: perms,
        },
        {
          onSuccess: () => {
            toast.success("Role created");
            setCreating(false);
            form.reset();
            setSelectedPerms(new Set());
          },
          onError: (e: Error) => toast.error(e.message),
        },
      );
      return;
    }
    if (editing) {
      patchMut.mutate(
        {
          roleId: editing.id,
          name: vals.name.trim(),
          description: vals.description?.trim() || undefined,
          permissions: perms,
        },
        {
          onSuccess: () => {
            toast.success("Role updated");
            setEditing(null);
          },
          onError: (e: Error) => toast.error(e.message),
        },
      );
    }
  };

  const onConfirmDelete = () => {
    if (!deleting) return;
    deleteMut.mutate(deleting.id, {
      onSuccess: () => {
        toast.success("Role removed");
        setDeleting(null);
        if (editing?.id === deleting.id) {
          setEditing(null);
        }
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const busy = createMut.isPending || patchMut.isPending;

  return (
    <>
      <Card className="border-border/80 bg-card/90">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-primary" aria-hidden />
              Roles &amp; permissions
            </CardTitle>
            <CardDescription>
              Tenant-scoped roles with granular permission keys. Edge Function enforces admin-only
              mutations.
            </CardDescription>
          </div>
          <Button type="button" variant="cta" size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New role
          </Button>
        </CardHeader>
        <CardContent>
          {rolesQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full rounded-lg bg-surface-inner" />
              <Skeleton className="h-10 w-full rounded-lg bg-surface-inner" />
            </div>
          ) : rolesQuery.isError ? (
            <p className="text-sm text-destructive">
              {rolesQuery.error instanceof Error ? rolesQuery.error.message : "Could not load roles"}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(roles ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground">
                        No custom roles yet. Create one to assign granular access.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (roles ?? []).map((r) => {
                      const permCount = Array.isArray(r.permissions) ? r.permissions.length : 0;
                      return (
                        <TableRow key={r.id} className="transition-colors duration-150 hover:bg-muted/40">
                          <TableCell className="font-medium text-foreground">{r.name}</TableCell>
                          <TableCell className="max-w-xs truncate text-muted-foreground">
                            {r.description || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{permCount} keys</TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="mr-1"
                              onClick={() => openEdit(r)}
                            >
                              <Pencil className="mr-1 h-4 w-4" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => setDeleting(r)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={creating || Boolean(editing)}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false);
            setEditing(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-lg border-border/80 bg-card">
          <DialogHeader>
            <DialogTitle>{creating ? "Create role" : "Edit role"}</DialogTitle>
            <DialogDescription>
              Select permission keys that this role grants. Users can be linked to roles from the Users
              section.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role name</FormLabel>
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
                      <Textarea className="min-h-[72px] bg-surface-inner" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">Permissions</p>
                <ScrollArea className="h-52 rounded-lg border border-border/60 bg-surface-inner p-3">
                  <ul className="space-y-2">
                    {(SETTINGS_PERMISSION_CATALOG ?? []).map((item) => (
                      <li key={item.key} className="flex items-start gap-2">
                        <Checkbox
                          id={`perm-${item.key}`}
                          checked={selectedPerms.has(item.key)}
                          onCheckedChange={() => togglePerm(item.key)}
                          aria-label={item.label}
                        />
                        <label htmlFor={`perm-${item.key}`} className="cursor-pointer text-sm leading-tight">
                          <span className="font-medium text-foreground">{item.label}</span>
                          <span className="block text-xs text-muted-foreground">{item.key}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="ghost" onClick={() => (setCreating(false), setEditing(null))}>
                  Cancel
                </Button>
                <Button type="submit" variant="cta" disabled={busy}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save role
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent className="border-border/80 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete role?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the role and unlinks it from user assignments. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={onConfirmDelete}
            >
              {deleteMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
