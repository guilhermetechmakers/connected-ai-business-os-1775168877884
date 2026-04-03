import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { AnimatedPage } from "@/components/animated-page";
import { DepartmentCard } from "@/components/departments-list/department-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/layout/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDepartments } from "@/hooks/use-departments";
import { createTenantDepartment } from "@/lib/departments-list-api";
import { cn } from "@/lib/utils";
import type { DepartmentWorkspaceListItem } from "@/types/department-workspace";

const DEPARTMENT_TYPES = [
  "Sales",
  "Ops",
  "HR",
  "Finance",
  "Product",
  "Engineering",
  "Other",
] as const;

const STATUS_OPTIONS = ["all", "active", "paused", "inactive"] as const;

const createDeptSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(200),
    departmentType: z.string().min(1, "Select a type"),
    workspaceStatus: z.enum(["active", "paused", "inactive"]),
    headcount: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    const h = val.headcount?.trim() ?? "";
    if (h !== "" && !/^[0-9]+$/.test(h)) {
      ctx.addIssue({
        code: "custom",
        message: "Headcount must be a whole number",
        path: ["headcount"],
      });
    }
  });

type CreateDeptValues = z.infer<typeof createDeptSchema>;

function normalizeRoles(roles: string[] | null | undefined): Set<string> {
  return new Set((roles ?? []).map((r) => String(r).toLowerCase()));
}

function canCreateDepartment(roles: string[] | null | undefined): boolean {
  const r = normalizeRoles(roles);
  return r.has("admin") || r.has("company admin");
}

export function DepartmentWorkspaceListPage() {
  const { profile, tenant, isConfigured } = useAuth();
  const tenantId = tenant?.id ?? profile?.company_id ?? null;
  const roles = Array.isArray(profile?.roles) ? profile.roles : [];
  const showCreate = canCreateDepartment(roles);

  const queryClient = useQueryClient();
  const { data: rawList, isLoading, isError, error } = useDepartments(
    isConfigured ? tenantId : "demo",
  );

  const departments = useMemo(() => {
    const list = Array.isArray(rawList) ? rawList : [];
    return list;
  }, [rawList]);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 320);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<
    (typeof STATUS_OPTIONS)[number]
  >("all");
  const [manageOnly, setManageOnly] = useState(false);

  const [detailsDept, setDetailsDept] = useState<DepartmentWorkspaceListItem | null>(
    null,
  );
  const [createOpen, setCreateOpen] = useState(false);

  const form = useForm<CreateDeptValues>({
    resolver: zodResolver(createDeptSchema),
    defaultValues: {
      name: "",
      departmentType: "Sales",
      workspaceStatus: "active",
      headcount: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: createTenantDepartment,
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Department workspace created");
      void queryClient.invalidateQueries({ queryKey: ["departments"] });
      setCreateOpen(false);
      form.reset({
        name: "",
        departmentType: "Sales",
        workspaceStatus: "active",
        headcount: "",
      });
    },
    onError: () => {
      toast.error("Could not create department");
    },
  });

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const items = departments ?? [];
    return items.filter((d) => {
      if (!d || typeof d !== "object") return false;
      if (manageOnly && d.userRole !== "Manager") return false;
      if (typeFilter !== "all") {
        const t = typeof d.type === "string" ? d.type : "";
        if (t.toLowerCase() !== typeFilter.toLowerCase()) return false;
      }
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (q) {
        const name = typeof d.name === "string" ? d.name.toLowerCase() : "";
        const lead =
          typeof d.leadName === "string" ? d.leadName.toLowerCase() : "";
        if (!name.includes(q) && !lead.includes(q)) return false;
      }
      return true;
    });
  }, [departments, debouncedSearch, manageOnly, typeFilter, statusFilter]);

  const onCreateSubmit = form.handleSubmit((values) => {
    const hcRaw = values.headcount?.trim() ?? "";
    const headcountParsed =
      hcRaw === "" ? null : Math.max(0, parseInt(hcRaw, 10));
    createMutation.mutate({
      name: values.name,
      departmentType: values.departmentType,
      workspaceStatus: values.workspaceStatus,
      headcount: headcountParsed,
    });
  });

  const missingTenant = isConfigured && !tenantId;

  return (
    <AnimatedPage className="relative space-y-8">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-40"
        aria-hidden
      >
        <div className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgb(7_18_40)_0%,rgb(11_26_42)_45%,transparent_70%)] animate-mesh-drift motion-reduce:animate-none" />
      </div>

      <PageHeader
        title="Department workspaces"
        description="Search, filter, and open scoped workspaces with KPIs, workflows, and AI context — tenant-isolated and role-aware."
        actions={
          showCreate ? (
            <Button
              variant="cta"
              type="button"
              className="gap-2 transition-transform duration-150 hover:scale-[1.02] motion-reduce:transform-none"
              onClick={() => setCreateOpen(true)}
              aria-label="Create new department workspace"
            >
              <Plus className="h-4 w-4" aria-hidden />
              New department
            </Button>
          ) : null
        }
      />

      {missingTenant ? (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 text-sm text-muted-foreground">
            No company context on your profile yet. Finish onboarding or contact an
            admin — department data will load once a tenant is linked.
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border/80 bg-card/90 shadow-card">
        <CardContent className="space-y-6 p-4 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="relative max-w-xl flex-1">
              <Label htmlFor="dept-search" className="sr-only">
                Search departments
              </Label>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="dept-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search departments…"
                className="h-11 border-border bg-surface-inner pl-10 pr-10"
                aria-label="Search departments"
              />
              {search ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Type</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger
                    className="h-11 w-full min-w-[140px] border-border bg-surface-inner sm:w-[160px]"
                    aria-label="Filter by department type"
                  >
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {(DEPARTMENT_TYPES ?? []).map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(v) =>
                    setStatusFilter(v as (typeof STATUS_OPTIONS)[number])
                  }
                >
                  <SelectTrigger
                    className="h-11 w-full min-w-[140px] border-border bg-surface-inner sm:w-[160px]"
                    aria-label="Filter by workspace status"
                  >
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pb-1 sm:pb-0">
                <Checkbox
                  id="manage-only"
                  checked={manageOnly}
                  onCheckedChange={(c) => setManageOnly(c === true)}
                  aria-label="Show only departments you can manage"
                />
                <Label
                  htmlFor="manage-only"
                  className="cursor-pointer text-sm font-medium leading-none text-foreground"
                >
                  Manage only
                </Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isError ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-6 text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load departments"}
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <div className="grid grid-cols-12 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton
              key={i}
              className="col-span-12 h-72 rounded-xl md:col-span-6 xl:col-span-4"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-border/80 bg-surface-inner/40">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground" aria-hidden />
            <div>
              <p className="font-display text-lg font-semibold text-foreground">
                No departments match
              </p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Adjust search or filters, or create a workspace if you have admin
                access.
              </p>
            </div>
            {showCreate ? (
              <Button variant="cta" type="button" onClick={() => setCreateOpen(true)}>
                Create department
              </Button>
            ) : null}
            <Button variant="outline" type="button" asChild>
              <Link to="/dashboard/global">Back to global dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-12 gap-4">
          {(filtered ?? []).map((d, i) => (
            <div
              key={d.id}
              className={cn(
                "col-span-12 animate-fade-in-up motion-reduce:animate-none",
              )}
              style={{ animationDelay: `${Math.min(i, 12) * 60}ms` }}
            >
              <DepartmentCard
                department={d}
                workspaceHref={`/dashboard/departments/${d.id}`}
                onViewDetails={setDetailsDept}
              />
            </div>
          ))}
        </div>
      )}

      <Dialog open={Boolean(detailsDept)} onOpenChange={() => setDetailsDept(null)}>
        <DialogContent className="border-border bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {detailsDept?.name ?? "Department"}
            </DialogTitle>
            <DialogDescription>
              Snapshot of workspace metadata and quick metrics. Export hooks into
              the reports center when enabled.
            </DialogDescription>
          </DialogHeader>
          {detailsDept ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Type</dt>
                <dd className="font-medium">{detailsDept.type ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-medium capitalize">{detailsDept.status}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Open tasks</dt>
                <dd className="font-medium tabular-nums">
                  {detailsDept.metrics?.openTasks ?? 0}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Documents</dt>
                <dd className="font-medium tabular-nums">
                  {detailsDept.metrics?.documents ?? 0}
                </dd>
              </div>
            </dl>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" asChild>
              <Link
                to={
                  detailsDept
                    ? `/dashboard/departments/${detailsDept.id}`
                    : "/dashboard/departments"
                }
              >
                Open workspace
              </Link>
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                toast.message("Export queued", {
                  description: "Connect reports center export for full CSV.",
                });
              }}
            >
              Export snapshot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="border-border bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">New department</DialogTitle>
            <DialogDescription>
              Creates a tenant-scoped workspace. You need company admin or admin
              role.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={onCreateSubmit} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="border-border bg-surface-inner"
                        autoComplete="off"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="departmentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="border-border bg-surface-inner">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(DEPARTMENT_TYPES ?? []).map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
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
                name="workspaceStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="border-border bg-surface-inner">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="headcount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Headcount (optional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value}
                        className="border-border bg-surface-inner"
                        inputMode="numeric"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="cta"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? "Creating…" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </AnimatedPage>
  );
}
