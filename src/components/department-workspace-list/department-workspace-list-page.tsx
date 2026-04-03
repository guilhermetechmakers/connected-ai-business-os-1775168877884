import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Filter, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";

import { DepartmentCard } from "@/components/department-workspace-list/department-card";
import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
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
import {
  useCreateDepartmentWorkspaceMutation,
  useDepartmentWorkspaceListCatalog,
} from "@/hooks/use-department-workspace-list";
import { cn } from "@/lib/utils";
import type { DepartmentWorkspaceListItem } from "@/types/department-workspace-list";

const createDeptSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  departmentType: z.string().max(80).optional(),
  leadUserId: z
    .string()
    .max(80)
    .optional()
    .refine(
      (s) => !s?.trim() || /^[0-9a-f-]{36}$/i.test(s.trim()),
      "Lead user id must be a UUID",
    ),
  workspaceStatus: z.enum(["active", "paused", "inactive"]).optional(),
  headcount: z.coerce.number().int().min(0).max(500_000).optional(),
});

type CreateDeptValues = z.infer<typeof createDeptSchema>;

const TYPE_OPTIONS = ["All types", "Sales", "Ops", "HR", "Finance", "Product"] as const;

function normalizeSearch(q: string): string {
  return q.trim().toLowerCase();
}

function canCreateDepartment(roles: string[]): boolean {
  const r = new Set((roles ?? []).map((x) => String(x).toLowerCase()));
  return r.has("admin") || r.has("company admin");
}

export function DepartmentWorkspaceListPage() {
  const navigate = useNavigate();
  const { profile, tenant } = useAuth();
  const tenantId = tenant?.id ?? profile?.company_id ?? undefined;
  const roles = Array.isArray(profile?.roles) ? profile.roles : [];
  const showCreate = canCreateDepartment(roles);

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const [typeFilter, setTypeFilter] = useState<string>("All types");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "paused" | "inactive"
  >("all");
  const [manageableOnly, setManageableOnly] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailDept, setDetailDept] = useState<DepartmentWorkspaceListItem | null>(
    null,
  );

  const { data: rawList, isLoading, isError, error } =
    useDepartmentWorkspaceListCatalog(tenantId);
  const createMutation = useCreateDepartmentWorkspaceMutation(tenantId);

  const departments = useMemo(() => {
    const list = Array.isArray(rawList) ? rawList : [];
    return list;
  }, [rawList]);

  const typeValuesInData = useMemo(() => {
    const s = new Set<string>();
    for (const d of departments) {
      if (d?.type && String(d.type).trim()) s.add(String(d.type).trim());
    }
    return [...s].sort();
  }, [departments]);

  const typeSelectOptions = useMemo(() => {
    const opts: string[] = ["All types"];
    const seen = new Set<string>(opts);
    for (const t of TYPE_OPTIONS) {
      if (t !== "All types" && !seen.has(t)) {
        opts.push(t);
        seen.add(t);
      }
    }
    for (const t of typeValuesInData) {
      if (t && !seen.has(t)) {
        opts.push(t);
        seen.add(t);
      }
    }
    return opts;
  }, [typeValuesInData]);

  const isGlobalAdmin = useMemo(
    () =>
      roles.some((r) =>
        ["admin", "company admin"].includes(String(r).toLowerCase()),
      ),
    [roles],
  );

  const filtered = useMemo(() => {
    const q = normalizeSearch(debouncedSearch);
    const safe = Array.isArray(departments) ? departments : [];
    return safe.filter((d) => {
      if (!d?.id) return false;
      if (
        manageableOnly &&
        !isGlobalAdmin &&
        d.userRole !== "Manager"
      ) {
        return false;
      }
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (typeFilter !== "All types") {
        const t = d.type ? String(d.type).trim() : "";
        if (t !== typeFilter) return false;
      }
      if (!q) return true;
      const name = typeof d.name === "string" ? d.name.toLowerCase() : "";
      const lead = d.leadName ? String(d.leadName).toLowerCase() : "";
      const typ = d.type ? String(d.type).toLowerCase() : "";
      return name.includes(q) || lead.includes(q) || typ.includes(q);
    });
  }, [
    departments,
    debouncedSearch,
    isGlobalAdmin,
    manageableOnly,
    statusFilter,
    typeFilter,
  ]);

  const form = useForm<CreateDeptValues>({
    resolver: zodResolver(createDeptSchema),
    defaultValues: {
      name: "",
      departmentType: "",
      leadUserId: "",
      workspaceStatus: "active",
      headcount: undefined,
    },
  });

  function onCreateSubmit(values: CreateDeptValues) {
    const lead = values.leadUserId?.trim();
    createMutation.mutate(
      {
        name: values.name,
        departmentType: values.departmentType?.trim() || undefined,
        leadUserId: lead && lead.length > 0 ? lead : null,
        workspaceStatus: values.workspaceStatus,
        headcount:
          values.headcount !== undefined && Number.isFinite(values.headcount)
            ? values.headcount
            : null,
      },
      {
        onSuccess: (res) => {
          if (res.error) {
            toast.error(res.error);
            return;
          }
          toast.success("Department workspace created");
          setCreateOpen(false);
          form.reset({
            name: "",
            departmentType: "",
            leadUserId: "",
            workspaceStatus: "active",
            headcount: undefined,
          });
        },
        onError: () => {
          toast.error("Could not create department");
        },
      },
    );
  }

  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="Department workspaces"
        description="Search, filter, and open scoped workspaces with KPIs, workflows, and AI context."
        actions={
          showCreate ? (
            <Button
              variant="cta"
              type="button"
              className="transition-transform duration-150 hover:scale-[1.02] motion-reduce:hover:scale-100"
              onClick={() => setCreateOpen(true)}
              aria-label="Create new department workspace"
            >
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              New department
            </Button>
          ) : null
        }
      />

      <Card className="border-border/80 bg-card/80 shadow-card">
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="relative min-w-0 flex-1 max-w-xl">
              <label className="sr-only" htmlFor="dept-search">
                Search departments
              </label>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="dept-search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search departments…"
                className="h-11 border-[rgb(21_78_120/0.4)] bg-surface-inner/60 pl-10 pr-10"
                aria-label="Search departments"
              />
              {searchQuery ? (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" aria-hidden />
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Filters
                </span>
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger
                  className="h-11 w-full min-w-[140px] border-[rgb(21_78_120/0.4)] bg-surface-inner/60 sm:w-[160px]"
                  aria-label="Filter by department type"
                >
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  {(typeSelectOptions ?? []).map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={statusFilter}
                onValueChange={(v) =>
                  setStatusFilter(v as typeof statusFilter)
                }
              >
                <SelectTrigger
                  className="h-11 w-full min-w-[140px] border-[rgb(21_78_120/0.4)] bg-surface-inner/60 sm:w-[160px]"
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
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border border-border/50 px-3 py-2",
                  "text-sm text-muted-foreground transition-colors hover:bg-muted/30",
                )}
              >
                <Checkbox
                  checked={manageableOnly}
                  onCheckedChange={(c) => setManageableOnly(c === true)}
                  aria-label="Show only departments I can manage"
                />
                <span>My departments only</span>
              </label>
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
              className="col-span-12 h-72 rounded-xl sm:col-span-6 xl:col-span-4"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-border/60 bg-surface-inner/40">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="font-display text-lg font-semibold text-foreground">
              No departments match
            </p>
            <p className="max-w-md text-sm text-muted-foreground">
              Try clearing filters or search. Admins can create a new department workspace
              to get started.
            </p>
            {showCreate ? (
              <Button variant="cta" type="button" onClick={() => setCreateOpen(true)}>
                Create department
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-12 gap-4">
          {(filtered ?? []).map((d, i) => (
            <div
              key={d.id}
              className="col-span-12 animate-fade-in-up motion-reduce:animate-none"
              style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
            >
              <DepartmentCard
                department={d}
                onOpenWorkspace={() => {
                  navigate(`/departments/${d.id}`);
                }}
                onOpenAI={() => {
                  navigate(`/departments/${d.id}?tab=ai`);
                }}
                onViewDetails={() => setDetailDept(d)}
              />
            </div>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="border-border/80 bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              New department workspace
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onCreateSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="border-[rgb(21_78_120/0.4)] bg-surface-inner/60"
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
                    <FormLabel>Type / template</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g. Sales, Ops"
                        className="border-[rgb(21_78_120/0.4)] bg-surface-inner/60"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="leadUserId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead user ID (optional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="UUID of profile"
                        className="border-[rgb(21_78_120/0.4)] bg-surface-inner/60"
                      />
                    </FormControl>
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
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? "active"}
                    >
                      <FormControl>
                        <SelectTrigger className="border-[rgb(21_78_120/0.4)] bg-surface-inner/60">
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
                        type="number"
                        min={0}
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          field.onChange(v === "" ? undefined : Number(v));
                        }}
                        className="border-[rgb(21_78_120/0.4)] bg-surface-inner/60"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="gap-2 sm:gap-0">
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

      <Dialog open={detailDept !== null} onOpenChange={(o) => !o && setDetailDept(null)}>
        <DialogContent className="border-border/80 bg-card sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {detailDept?.name ?? "Department"}
            </DialogTitle>
          </DialogHeader>
          {detailDept ? (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Lead: </span>
                {detailDept.leadName ?? "—"}
              </p>
              <p>
                <span className="font-medium text-foreground">Status: </span>
                {detailDept.status}
              </p>
              <p>
                <span className="font-medium text-foreground">Your role: </span>
                {detailDept.userRole}
              </p>
              <p>
                <span className="font-medium text-foreground">Open tasks: </span>
                {detailDept.metrics?.openTasks ?? 0}
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  variant="cta"
                  size="sm"
                  type="button"
                  onClick={() => {
                    navigate(`/departments/${detailDept.id}`);
                    setDetailDept(null);
                  }}
                >
                  Open workspace
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={detailDept.aiAvailable === false}
                  onClick={() => {
                    navigate(`/departments/${detailDept.id}?tab=ai`);
                    setDetailDept(null);
                  }}
                >
                  Open AI assistant
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </AnimatedPage>
  );
}
