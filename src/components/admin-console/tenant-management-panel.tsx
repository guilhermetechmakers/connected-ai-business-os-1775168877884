import { format } from "date-fns";
import { ChevronDown, ChevronUp, MoreHorizontal } from "lucide-react";
import { Fragment, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";

import { IntegrationStatus } from "@/components/tenancy/integration-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  useAdminIntegrationOverviewQuery,
  useAdminTenantsQuery,
} from "@/hooks/use-integrations";
import {
  useBulkDeprovisionTenantsMutation,
  usePatchTenantModuleMutation,
  useTenantIntegrationMonitorQuery,
  useTenantsAdminListQuery,
} from "@/hooks/use-tenants-module";
import { cn } from "@/lib/utils";
import type { TenantCompanyRecord } from "@/types/tenancy";

function TenantMonitorPanel({
  companyId,
  open,
}: {
  companyId: string;
  open: boolean;
}) {
  const q = useTenantIntegrationMonitorQuery(companyId, open);
  if (!open) return null;
  if (q.isLoading) {
    return (
      <div className="p-4">
        <Skeleton className="h-16 w-full bg-surface-inner" />
      </div>
    );
  }
  const connectors = Array.isArray(q.data?.connectors) ? q.data.connectors : [];
  return (
    <div className="border-t border-border/60 bg-surface-inner/30 p-4 text-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
        Integration monitor
      </p>
      <div>
        <p className="mb-1 text-muted-foreground">Connectors</p>
        {connectors.length === 0 ? (
          <p className="text-muted-foreground">None</p>
        ) : (
          <ul className="space-y-2">
            {connectors.map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-border/50 px-2 py-1.5"
              >
                <p className="font-mono text-xs text-foreground">
                  {c.provider_key}
                </p>
                <IntegrationStatus
                  status={c.status}
                  lastSyncAt={c.last_sync_at}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

type TenantManagementPanelProps = {
  isSuper: boolean;
  isPrivileged: boolean;
};

export function TenantManagementPanel({
  isSuper,
  isPrivileged,
}: TenantManagementPanelProps) {
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);
  const [expandedTenantId, setExpandedTenantId] = useState<string | null>(null);

  const tenantsQuery = useAdminTenantsQuery();
  const tenantsModuleQuery = useTenantsAdminListQuery({
    enabled: isPrivileged,
    limit: 80,
    search: appliedSearch.trim() || undefined,
    tenantStatus:
      statusFilter === "all"
        ? undefined
        : (statusFilter as TenantCompanyRecord["tenant_status"]),
  });
  const overviewQuery = useAdminIntegrationOverviewQuery();
  const bulkDeprovision = useBulkDeprovisionTenantsMutation();
  const patchTenant = usePatchTenantModuleMutation();

  const moduleTenants = Array.isArray(tenantsModuleQuery.data?.tenants)
    ? tenantsModuleQuery.data.tenants
    : [];
  const legacyTenants = Array.isArray(tenantsQuery.data) ? tenantsQuery.data : [];
  const tenants =
    isPrivileged && moduleTenants.length > 0 ? moduleTenants : legacyTenants;
  const overview = Array.isArray(overviewQuery.data) ? overviewQuery.data : [];

  const tenantsLoading =
    tenantsQuery.isLoading || (isPrivileged && tenantsModuleQuery.isLoading);

  const toggleTenantSelect = (id: string, checked: boolean) => {
    setSelectedTenantIds((prev) => {
      const cur = Array.isArray(prev) ? prev : [];
      if (checked) return cur.includes(id) ? cur : [...cur, id];
      return cur.filter((x) => x !== id);
    });
  };

  const allVisibleSelected =
    tenants.length > 0 &&
    tenants.every((t) => selectedTenantIds.includes(t.id));

  const applySearch = () => setAppliedSearch(search);

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") applySearch();
  };

  const runPatchStatus = async (
    companyId: string,
    tenantStatus: TenantCompanyRecord["tenant_status"],
  ) => {
    const row = await patchTenant.mutateAsync({ companyId, tenantStatus });
    if (row) {
      toast.success(`Tenant marked ${tenantStatus}`);
    } else {
      toast.error("Update failed or forbidden");
    }
  };

  return (
    <Card className="border-border/80 bg-card/90">
      <CardHeader className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Tenants</CardTitle>
            <p className="text-sm text-muted-foreground">
              Search, filter by status, monitor connectors, and run lifecycle
              actions.
            </p>
          </div>
          {isSuper ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
                disabled={
                  selectedTenantIds.length === 0 || bulkDeprovision.isPending
                }
                onClick={() => {
                  void bulkDeprovision
                    .mutateAsync(selectedTenantIds)
                    .then((rows) => {
                      const ok = (rows ?? []).filter((r) => r.ok).length;
                      toast.success(`Deprovisioned ${ok} tenant(s)`);
                      setSelectedTenantIds([]);
                    });
                }}
              >
                {bulkDeprovision.isPending
                  ? "Deprovisioning…"
                  : `Bulk deprovision (${selectedTenantIds.length})`}
              </Button>
            </div>
          ) : null}
        </div>
        {isPrivileged ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="tenant-search">Search tenants</Label>
              <Input
                id="tenant-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Name, legal name, or display name"
                className="bg-input border-border/60"
              />
            </div>
            <div className="w-full space-y-2 sm:w-48">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-input border-border/60">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="provisioning">Provisioning</SelectItem>
                  <SelectItem value="deprovisioned">Deprovisioned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={applySearch}>
              Apply
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        {tenantsLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full bg-surface-inner" />
            <Skeleton className="h-10 w-full bg-surface-inner" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border/60 hover:bg-transparent">
                {isSuper ? (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={(c) => {
                        const on = c === true;
                        if (on) {
                          setSelectedTenantIds(tenants.map((x) => x.id));
                        } else {
                          setSelectedTenantIds([]);
                        }
                      }}
                      aria-label="Select all tenants"
                    />
                  </TableHead>
                ) : null}
                <TableHead>Name</TableHead>
                {isSuper ? <TableHead>Status</TableHead> : null}
                {isSuper ? <TableHead>Plan</TableHead> : null}
                <TableHead>Created</TableHead>
                <TableHead>Connectors</TableHead>
                <TableHead>Health</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((t) => {
                const match = overview.find((o) => o.companyId === t.id);
                const count = match?.connectorCount ?? 0;
                const healthy = match?.healthy ?? 0;
                const healthLabel =
                  count === 0
                    ? "idle"
                    : healthy === count
                      ? "green"
                      : "amber";
                const row = t as {
                  id: string;
                  name: string;
                  created_at: string;
                  tenant_status?: string;
                  plan?: string;
                  region?: string;
                };
                const expanded = expandedTenantId === row.id;
                return (
                  <Fragment key={row.id}>
                    <TableRow className="border-border/60">
                      {isSuper ? (
                        <TableCell>
                          <Checkbox
                            checked={selectedTenantIds.includes(row.id)}
                            onCheckedChange={(c) =>
                              toggleTenantSelect(row.id, c === true)
                            }
                            aria-label={`Select ${row.name}`}
                          />
                        </TableCell>
                      ) : null}
                      <TableCell className="font-medium text-foreground">
                        <div className="flex flex-col">
                          <span>{row.name}</span>
                          {row.region ? (
                            <span className="text-xs text-muted-foreground">
                              {row.region}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      {isSuper ? (
                        <TableCell className="text-muted-foreground">
                          {row.tenant_status ?? "—"}
                        </TableCell>
                      ) : null}
                      {isSuper ? (
                        <TableCell className="text-muted-foreground">
                          {row.plan ?? "—"}
                        </TableCell>
                      ) : null}
                      <TableCell className="text-muted-foreground">
                        {(() => {
                          try {
                            return format(new Date(row.created_at), "PP");
                          } catch {
                            return row.created_at;
                          }
                        })()}
                      </TableCell>
                      <TableCell>{count}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            healthLabel === "green" &&
                              "border-success/50 text-success",
                            healthLabel === "amber" &&
                              "border-primary/50 text-primary",
                            healthLabel === "idle" && "text-muted-foreground",
                          )}
                        >
                          {healthLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {isSuper ? (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                type="button"
                                onClick={() =>
                                  setExpandedTenantId((cur) =>
                                    cur === row.id ? null : row.id,
                                  )
                                }
                                aria-expanded={expanded}
                              >
                                {expanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                                <span className="sr-only">Toggle monitor</span>
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    type="button"
                                    className="border-border/60"
                                    aria-label={`Actions for ${row.name}`}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="border-border/70 bg-card"
                                >
                                  <DropdownMenuItem
                                    onClick={() =>
                                      void runPatchStatus(row.id, "suspended")
                                    }
                                  >
                                    Suspend tenant
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      void runPatchStatus(row.id, "active")
                                    }
                                  >
                                    Activate tenant
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => {
                                      toast.message("Escalation recorded", {
                                        description:
                                          "Route to on-call and attach tenant id in your ITSM ticket.",
                                      });
                                    }}
                                  >
                                    Escalate to on-call
                                  </DropdownMenuItem>
                                  <DropdownMenuItem disabled>
                                    Impersonate (coming soon)
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              type="button"
                              disabled
                            >
                              Impersonate
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {isSuper && expanded ? (
                      <TableRow className="border-0">
                        <TableCell
                          colSpan={isSuper ? 8 : 5}
                          className="p-0"
                        >
                          <TenantMonitorPanel
                            companyId={row.id}
                            open={expanded}
                          />
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
        {!tenantsLoading && tenants.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tenants returned. Assign platform roles or seed companies.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
