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
  useAdminSystemTemplatesQuery,
  useAdminTemplateDeleteMutation,
  useAdminTemplatesUpsertMutation,
} from "@/hooks/use-activity-logs";

export function TemplateManagementPanel() {
  const templatesQuery = useAdminSystemTemplatesQuery(true);
  const tplUpsert = useAdminTemplatesUpsertMutation();
  const tplDelete = useAdminTemplateDeleteMutation();

  const [tplKey, setTplKey] = useState("");
  const [tplName, setTplName] = useState("");
  const [tplCategory, setTplCategory] = useState("module");
  const [tplDef, setTplDef] = useState("{}");

  const templates = Array.isArray(templatesQuery.data) ? templatesQuery.data : [];

  return (
    <div className="space-y-6">
      <Card className="border-border/80 bg-card/90">
        <CardHeader>
          <CardTitle>Upsert template</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tk">Template key</Label>
            <Input
              id="tk"
              value={tplKey}
              onChange={(e) => setTplKey(e.target.value)}
              className="font-mono text-xs bg-input border-border/60"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tn2">Display name</Label>
            <Input
              id="tn2"
              value={tplName}
              onChange={(e) => setTplName(e.target.value)}
              className="bg-input border-border/60"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tc">Category</Label>
            <Input
              id="tc"
              value={tplCategory}
              onChange={(e) => setTplCategory(e.target.value)}
              className="bg-input border-border/60"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="tdj">Definition (JSON)</Label>
            <Textarea
              id="tdj"
              value={tplDef}
              onChange={(e) => setTplDef(e.target.value)}
              rows={6}
              className="font-mono text-xs bg-input border-border/60"
            />
          </div>
          <Button
            type="button"
            variant="cta"
            disabled={tplUpsert.isPending}
            onClick={() => {
              let parsed: Record<string, unknown> = {};
              try {
                parsed = JSON.parse(tplDef || "{}") as Record<string, unknown>;
              } catch {
                toast.error("Invalid JSON");
                return;
              }
              void tplUpsert
                .mutateAsync({
                  templateKey: tplKey.trim(),
                  name: tplName.trim(),
                  category: tplCategory.trim(),
                  definition: parsed,
                })
                .then((r) => {
                  if (r) toast.success("Template saved");
                  else toast.error("Save failed");
                });
            }}
          >
            Save template
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
                  <TableHead>Key</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(templates ?? []).map((t) => (
                  <TableRow key={t.id} className="border-border/60">
                    <TableCell className="font-mono text-xs">{t.template_key}</TableCell>
                    <TableCell>{t.name}</TableCell>
                    <TableCell>{t.version}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Delete ${t.template_key}`}
                        onClick={() => {
                          void tplDelete.mutateAsync(t.id).then((ok) => {
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
          {!templatesQuery.isLoading && templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No templates yet.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
