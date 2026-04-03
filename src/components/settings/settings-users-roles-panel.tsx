import { format } from "date-fns";
import { Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTenantUsersQuery } from "@/hooks/use-tenant-settings";
import { safeStringArray } from "@/lib/auth-api";
import { cn } from "@/lib/utils";

export function SettingsUsersRolesPanel() {
  const q = useTenantUsersQuery();
  const rows = Array.isArray(q.data) ? q.data : [];

  return (
    <Card className="border-border/80 bg-card/90">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-primary" aria-hidden />
          Team directory
        </CardTitle>
        <CardDescription>
          Tenant-scoped profiles from the auth service. Role edits use your IdP or admin provisioning
          flows.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full rounded-lg bg-surface-inner" />
            <Skeleton className="h-10 w-full rounded-lg bg-surface-inner" />
          </div>
        ) : q.isError ? (
          <p className="text-sm text-destructive">
            {q.error instanceof Error ? q.error.message : "Could not load users"}
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No profiles in this tenant yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((u) => (
                  <TableRow
                    key={u.id}
                    className="transition-colors duration-150 hover:bg-muted/40"
                  >
                    <TableCell className="font-medium text-foreground">
                      {u.display_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(safeStringArray(u.roles).length ? safeStringArray(u.roles) : ["member"]).map(
                          (r) => (
                            <Badge
                              key={r}
                              variant="outline"
                              className="border-primary/30 text-[10px] uppercase tracking-wide text-primary"
                            >
                              {r}
                            </Badge>
                          ),
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "text-xs",
                          u.status === "active" ? "text-success" : "text-muted-foreground",
                        )}
                      >
                        {u.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {format(new Date(u.created_at), "PP")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
