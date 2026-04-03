import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowDownAZ,
  Filter,
  LayoutGrid,
  PackageOpen,
  RotateCcw,
  Search,
} from "lucide-react";

import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import { fetchModuleVersions, summarizeBindings } from "@/api/modules";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  useDeleteModuleMutation,
  useDeployModuleMutation,
  useInstallTemplateMutation,
  useInternalModulesList,
  useMarketplaceTemplatesQuery,
  useRollbackModuleMutation,
} from "@/hooks/use-modules";
import { isSupabaseConfigured } from "@/lib/supabase";
import type {
  InternalModuleRow,
  MarketplaceTemplateRow,
  ModuleDataBinding,
} from "@/types/modules";

function statusBadgeVariant(
  status: string,
): "default" | "secondary" | "outline" | "destructive" {
  const s = status.toLowerCase();
  if (s === "published") return "default";
  if (s === "draft") return "secondary";
  if (s === "deprecated") return "outline";
  if (s === "archived") return "destructive";
  return "outline";
}

export default function ModulesHubPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | "all">("all");
  const [tagFilter, setTagFilter] = useState("");
  const [sort, setSort] = useState<"updated" | "name">("updated");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [installName, setInstallName] = useState("");

  const listParams = useMemo(
    () => ({
      search: search.trim() || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      tag: tagFilter.trim() || undefined,
    }),
    [search, statusFilter, tagFilter],
  );

  const { data: modules = [], isLoading, isError, refetch } =
    useInternalModulesList(listParams);
  const { data: templates = [], isLoading: templatesLoading } =
    useMarketplaceTemplatesQuery();
  const installMutation = useInstallTemplateMutation();
  const deleteMutation = useDeleteModuleMutation();
  const deployMutation = useDeployModuleMutation();
  const rollbackMutation = useRollbackModuleMutation();

  const rows = Array.isArray(modules) ? modules : [];
  const tplRows = Array.isArray(templates) ? templates : [];

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    if (sort === "name") {
      copy.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      copy.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
    }
    return copy;
  }, [rows, sort]);

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const base = Array.isArray(prev) ? prev : [];
      if (checked) return [...base, id];
      return base.filter((x) => x !== id);
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(sortedRows.map((m) => m.id));
    } else {
      setSelectedIds([]);
    }
  };

  const selectedSet = new Set(selectedIds);

  const runBulkUninstall = async () => {
    const ids = Array.isArray(selectedIds) ? selectedIds : [];
    if (ids.length === 0) return;
    let ok = 0;
    for (const id of ids) {
      const done = await deleteMutation.mutateAsync(id);
      if (done) ok += 1;
    }
    toast.success(`Removed ${ok} module${ok === 1 ? "" : "s"}`);
    setSelectedIds([]);
  };

  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="Internal modules hub"
        description="Registry, marketplace install, permissions, versions, and deployment health — tenant-isolated."
        actions={
          <Button variant="cta" size="sm" asChild>
            <Link to="/dashboard/modules/new">Create module</Link>
          </Button>
        }
      />

      {!isSupabaseConfigured ? (
        <Card className="border-border/80 bg-card/90">
          <CardHeader>
            <CardTitle>Supabase not configured</CardTitle>
            <CardDescription>
              Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, apply migrations,
              and deploy the modules-api Edge Function to load live data.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="border-border/80 bg-card/90 shadow-card lg:col-span-8">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="font-display flex items-center gap-2 text-lg">
                <LayoutGrid className="h-5 w-5 text-primary" />
                Installed modules
              </CardTitle>
              <CardDescription>
                Filter, sort, bulk uninstall, deploy, and open manage.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1 self-start"
              onClick={() => void refetch()}
            >
              <RotateCcw className="h-4 w-4" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="bg-surface-inner pl-9"
                  placeholder="Search by name…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search modules"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
                >
                  <SelectTrigger className="w-[160px] bg-surface-inner">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="deprecated">Deprecated</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  className="w-[140px] bg-surface-inner"
                  placeholder="Tag"
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  aria-label="Filter by tag"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => setSort(sort === "name" ? "updated" : "name")}
                >
                  <ArrowDownAZ className="h-4 w-4" />
                  {sort === "name" ? "Name" : "Updated"}
                </Button>
              </div>
            </div>

            {isError ? (
              <p className="text-sm text-destructive">
                Failed to load modules. Deploy modules-api and run migrations.
              </p>
            ) : null}

            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : sortedRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 bg-surface-inner/30 p-8 text-center text-sm text-muted-foreground">
                <p className="mb-2 font-medium text-foreground">
                  No modules yet
                </p>
                <p className="mb-4">
                  Install from the marketplace or create a custom module.
                </p>
                <Button variant="cta" asChild>
                  <Link to="/dashboard/modules/new">Create module</Link>
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-[min(520px,60vh)] rounded-xl border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-10">
                        <Checkbox
                          checked={
                            sortedRows.length > 0 &&
                            selectedIds.length === sortedRows.length
                          }
                          onCheckedChange={(c) => toggleSelectAll(c === true)}
                          aria-label="Select all modules"
                        />
                      </TableHead>
                      <TableHead>Module</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Bindings</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRows.map((m: InternalModuleRow & { active_version?: string | null }) => (
                      <TableRow
                        key={m.id}
                        className="transition-colors duration-150 hover:bg-muted/40"
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedSet.has(m.id)}
                            onCheckedChange={(c) =>
                              toggleSelect(m.id, c === true)
                            }
                            aria-label={`Select ${m.name}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-foreground">
                            {m.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {(Array.isArray(m.tags) ? m.tags : []).join(", ") ||
                              "—"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(m.status)}>
                            {m.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {m.active_version ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {summarizeBindings(
                            (Array.isArray(m.data_bindings)
                              ? m.data_bindings
                              : []) as ModuleDataBinding[],
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button size="sm" variant="outline" asChild>
                              <Link
                                to={`/dashboard/modules/${m.id}/manage`}
                              >
                                Manage
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={deployMutation.isPending}
                              onClick={async () => {
                                const res = await deployMutation.mutateAsync(
                                  m.id,
                                );
                                if (res) {
                                  toast.success("Deployed", {
                                    description: m.name,
                                  });
                                } else {
                                  toast.error("Deploy failed");
                                }
                              }}
                            >
                              Deploy
                            </Button>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="ghost">
                                  Rollback
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="border-border/80 bg-card">
                                <DialogHeader>
                                  <DialogTitle>Quick rollback</DialogTitle>
                                </DialogHeader>
                                <p className="text-sm text-muted-foreground">
                                  Reverts to the most recent inactive version
                                  snapshot. Use Manage for full history.
                                </p>
                                <DialogFooter>
                                  <Button
                                    variant="cta"
                                    disabled={rollbackMutation.isPending}
                                    onClick={async () => {
                                      const vers = await fetchModuleVersions(
                                        m.id,
                                      );
                                      const list = Array.isArray(vers)
                                        ? vers
                                        : [];
                                      const inactive = list.filter(
                                        (v) => !v.is_active,
                                      );
                                      const target = inactive[0];
                                      if (!target) {
                                        toast.error("No prior version");
                                        return;
                                      }
                                      const r = await rollbackMutation.mutateAsync(
                                        {
                                          moduleId: m.id,
                                          versionId: target.id,
                                        },
                                      );
                                      if (r?.ok) {
                                        toast.success("Rolled back", {
                                          description: (
                                            r.migrationPlan?.steps ?? []
                                          ).join(" "),
                                        });
                                      } else {
                                        toast.error("Rollback failed");
                                      }
                                    }}
                                  >
                                    Roll back
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}

            {selectedIds.length > 0 ? (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/80 bg-surface-inner/40 p-4">
                <span className="text-sm text-muted-foreground">
                  {selectedIds.length} selected
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleteMutation.isPending}
                  onClick={() => void runBulkUninstall()}
                >
                  Uninstall selected
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/90 shadow-card transition-all duration-150 hover:-translate-y-1 lg:col-span-4">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2 text-lg">
              <PackageOpen className="h-5 w-5 text-primary" />
              Marketplace
            </CardTitle>
            <CardDescription>
              Install seeded templates into your tenant registry.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {templatesLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : tplRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No templates.</p>
            ) : (
              tplRows.map((t: MarketplaceTemplateRow) => {
                const deps = Array.isArray(t.dependencies)
                  ? t.dependencies
                  : [];
                return (
                  <div
                    key={t.id}
                    className="flex items-start justify-between gap-2 rounded-xl border border-border/60 bg-card/50 p-3 transition-all duration-150 hover:border-primary/30"
                  >
                    <div>
                      <p className="font-medium text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.description ?? "—"}
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-primary/90">
                        {t.slug ? `${t.slug} · ` : ""}
                        {t.preview_ui}
                      </p>
                    </div>
                    <Dialog
                      onOpenChange={(open) => {
                        if (open) setInstallName(t.name);
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button size="sm" variant="cta">
                          Install
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="border-border/80 bg-card">
                        <DialogHeader>
                          <DialogTitle>Install {t.name}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3 py-2">
                          <div>
                            <Label htmlFor="install-module-name">
                              Module name (optional)
                            </Label>
                            <Input
                              id="install-module-name"
                              className="mt-1 bg-surface-inner"
                              value={installName}
                              onChange={(e) => setInstallName(e.target.value)}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Dependencies:{" "}
                            {deps.length > 0
                              ? deps.map(String).join(", ")
                              : "—"}
                          </p>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="cta"
                            disabled={installMutation.isPending}
                            onClick={async () => {
                              const name =
                                installName.trim().length > 0
                                  ? installName.trim()
                                  : undefined;
                              const mod = await installMutation.mutateAsync({
                                templateId: t.id,
                                name,
                              });
                              if (mod) {
                                toast.success("Installed", {
                                  description: mod.name,
                                });
                              } else {
                                toast.error("Install failed — name conflict?");
                              }
                            }}
                          >
                            Confirm install
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </AnimatedPage>
  );
}
