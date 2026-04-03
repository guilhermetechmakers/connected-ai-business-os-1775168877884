import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  useDeleteOnboardingTemplateMutation,
  useOnboardingTemplatesAdminQuery,
  useUpsertOnboardingTemplateMutation,
} from "@/hooks/use-tenants-module";

export function OnboardingTemplatesPanel() {
  const templatesQuery = useOnboardingTemplatesAdminQuery(true);
  const upsertTpl = useUpsertOnboardingTemplateMutation();
  const deleteTpl = useDeleteOnboardingTemplateMutation();

  const [name, setName] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [dataJson, setDataJson] = useState("{}");

  const rows = Array.isArray(templatesQuery.data) ? templatesQuery.data : [];

  return (
    <div className="space-y-6">
      <Card className="border-border/80 bg-card/90">
        <CardHeader>
          <CardTitle>Onboarding / environment templates</CardTitle>
          <p className="text-sm text-muted-foreground">
            Global templates use an empty tenant id. Tenant-scoped templates apply only to the
            selected company UUID.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="ot-name">Name</Label>
            <Input
              id="ot-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-input border-border/60"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="ot-tid">Tenant company ID (optional)</Label>
            <Input
              id="ot-tid"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="UUID — leave empty for global"
              className="font-mono text-xs bg-input border-border/60"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="ot-json">Data (JSON)</Label>
            <Textarea
              id="ot-json"
              value={dataJson}
              onChange={(e) => setDataJson(e.target.value)}
              rows={5}
              className="font-mono text-xs bg-input border-border/60"
            />
          </div>
          <Button
            type="button"
            variant="cta"
            className="md:col-span-2"
            disabled={upsertTpl.isPending || !name.trim()}
            onClick={() => {
              let data: Record<string, unknown> = {};
              try {
                data = JSON.parse(dataJson || "{}") as Record<string, unknown>;
              } catch {
                toast.error("Invalid JSON");
                return;
              }
              const tid = tenantId.trim();
              void upsertTpl
                .mutateAsync({
                  name: name.trim(),
                  templateType: "onboarding",
                  data,
                  tenantId: tid ? tid : null,
                  isActive: true,
                })
                .then((r) => {
                  if (r) {
                    toast.success("Template saved");
                    setName("");
                    setTenantId("");
                    setDataJson("{}");
                  } else toast.error("Save failed");
                });
            }}
          >
            Save onboarding template
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/90">
        <CardHeader>
          <CardTitle>Catalog</CardTitle>
        </CardHeader>
        <CardContent>
          {templatesQuery.isLoading ? (
            <Skeleton className="h-24 w-full bg-surface-inner" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/60">
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rows ?? []).map((t) => (
                  <TableRow key={t.id} className="border-border/60">
                    <TableCell>{t.name}</TableCell>
                    <TableCell>{t.template_type}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {t.tenant_id ?? "global"}
                    </TableCell>
                    <TableCell>{t.version}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Delete ${t.name}`}
                        onClick={() => {
                          void deleteTpl.mutateAsync(t.id).then((ok) => {
                            if (ok) toast.success("Deleted");
                            else toast.error("Delete failed");
                          });
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!templatesQuery.isLoading && rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No onboarding templates.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
