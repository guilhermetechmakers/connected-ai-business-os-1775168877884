import { Loader2, UserCog } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useProfileRoleAssignmentsTenantQuery,
  useReplaceProfileRolesMutation,
  useSettingsRolesQuery,
} from "@/hooks/use-settings-hub";
import { useTenantUsersQuery } from "@/hooks/use-tenant-settings";
import type { ProfileRoleAssignmentPair } from "@/lib/settings-hub-api";

function rolesForProfile(
  profileId: string,
  assignments: ProfileRoleAssignmentPair[],
): string[] {
  const list = Array.isArray(assignments) ? assignments : [];
  return list.filter((a) => a.profile_id === profileId).map((a) => a.role_id);
}

export function UsersRoleAssignmentSection() {
  const usersQ = useTenantUsersQuery();
  const rolesQ = useSettingsRolesQuery();
  const assignQ = useProfileRoleAssignmentsTenantQuery();
  const setMut = useReplaceProfileRolesMutation();

  const users = Array.isArray(usersQ.data) ? usersQ.data : [];
  const roles = Array.isArray(rolesQ.data) ? rolesQ.data : [];
  const assignments = Array.isArray(assignQ.data) ? assignQ.data : [];

  const [draft, setDraft] = useState<Record<string, string[]>>({});

  const effectiveRoles = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const u of users ?? []) {
      const id = u.id;
      if (draft[id] !== undefined) m[id] = draft[id] ?? [];
      else m[id] = rolesForProfile(id, assignments);
    }
    return m;
  }, [users, assignments, draft]);

  const toggleRole = (profileId: string, roleId: string) => {
    setDraft((prev) => {
      const priorList =
        prev[profileId] !== undefined
          ? [...(prev[profileId] ?? [])]
          : [...rolesForProfile(profileId, assignments)];
      const set = new Set(priorList);
      if (set.has(roleId)) set.delete(roleId);
      else set.add(roleId);
      return { ...prev, [profileId]: Array.from(set) };
    });
  };

  const saveProfile = (profileId: string) => {
    const ids = effectiveRoles[profileId] ?? [];
    setMut.mutate(
      { profileId, roleIds: ids },
      {
        onSuccess: () => {
          toast.success("Roles updated");
          setDraft((d) => {
            const next = { ...d };
            delete next[profileId];
            return next;
          });
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  };

  const loading = usersQ.isLoading || rolesQ.isLoading || assignQ.isLoading;

  return (
    <Card className="border-border/80 bg-card/90">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <UserCog className="h-5 w-5 text-primary" aria-hidden />
          Formal role assignments
        </CardTitle>
        <CardDescription>
          Map directory users to canonical roles in <code className="text-xs">roles</code>. This supplements
          profile <code className="text-xs">roles</code> labels from auth.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-40 w-full rounded-xl bg-surface-inner" />
        ) : usersQ.isError ? (
          <p className="text-sm text-destructive">
            {usersQ.error instanceof Error ? usersQ.error.message : "Could not load users"}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>User</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead className="text-right">Save</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(users ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      No users in this tenant.
                    </TableCell>
                  </TableRow>
                ) : (
                  (users ?? []).map((u) => (
                    <TableRow key={u.id} className="align-top">
                      <TableCell className="font-medium text-foreground">
                        <div>{u.display_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{u.email ?? ""}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-2">
                          {(roles ?? []).length === 0 ? (
                            <span className="text-xs text-muted-foreground">
                              Create roles in Roles &amp; permissions first.
                            </span>
                          ) : (
                            (roles ?? []).map((r) => {
                              const checked = (effectiveRoles[u.id] ?? []).includes(r.id);
                              return (
                                <label
                                  key={r.id}
                                  className="flex cursor-pointer items-center gap-2 text-sm"
                                >
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={() => toggleRole(u.id, r.id)}
                                    aria-label={`${r.name} for ${u.display_name ?? u.email}`}
                                  />
                                  <span>{r.name}</span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={setMut.isPending || (roles ?? []).length === 0}
                          onClick={() => saveProfile(u.id)}
                        >
                          {setMut.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Save"
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
