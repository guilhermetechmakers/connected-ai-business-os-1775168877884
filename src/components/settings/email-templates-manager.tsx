import { Copy, Eye, Loader2, Pencil } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import {
  useCloneEmailTemplateMutation,
  useEmailTemplatesListQuery,
  usePreviewEmailTemplateMutation,
  useUpsertEmailTemplateMutation,
} from "@/hooks/use-email-templates";
import { cn } from "@/lib/utils";
import type { EmailTemplateBuiltin, EmailTemplateRow } from "@/api/transactional-email";

const editorSchema = z.object({
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(50000),
});

type EditorValues = z.infer<typeof editorSchema>;

export function EmailTemplatesManager() {
  const listQuery = useEmailTemplatesListQuery();
  const upsertMut = useUpsertEmailTemplateMutation();
  const cloneMut = useCloneEmailTemplateMutation();
  const previewMut = usePreviewEmailTemplateMutation();

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [cloneSource, setCloneSource] = useState<string | null>(null);
  const [cloneNewKey, setCloneNewKey] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewText, setPreviewText] = useState("");

  const form = useForm<EditorValues>({
    resolver: zodResolver(editorSchema),
    defaultValues: { subject: "", body: "" },
  });

  const builtins = Array.isArray(listQuery.data?.builtins) ? listQuery.data!.builtins : [];
  const overrides = Array.isArray(listQuery.data?.overrides) ? listQuery.data!.overrides : [];

  const openEditor = (key: string, subject: string, body: string) => {
    setEditingKey(key);
    form.reset({ subject, body });
  };

  const saveEditor = async (values: EditorValues) => {
    if (!editingKey) return;
    const row = await upsertMut.mutateAsync({
      templateKey: editingKey,
      subject: values.subject,
      body: values.body,
    });
    if (!row) {
      toast.error("Could not save template");
      return;
    }
    toast.success("Template saved");
    setEditingKey(null);
  };

  const runPreview = async (key: string) => {
    const sample: Record<string, string> = {
      companyName: "Acme Corp",
      displayName: "Alex",
      verificationLink: "https://app.example/verify",
      reportName: "Weekly KPIs",
      period: "Q1",
      dashboardUrl: "https://app.example/dashboard",
      alertTitle: "Sync delay",
      message: "Connector slack exceeded SLA.",
      severity: "warning",
    };
    const res = await previewMut.mutateAsync({ templateKey: key, sample });
    if (!res) {
      toast.error("Preview failed");
      return;
    }
    setPreviewText(`Subject: ${res.subject}\n\n${res.body}`);
    setPreviewOpen(true);
  };

  const submitClone = async () => {
    if (!cloneSource || !cloneNewKey.trim()) {
      toast.error("Enter a new template key");
      return;
    }
    const row = await cloneMut.mutateAsync({
      sourceKey: cloneSource,
      newKey: cloneNewKey.trim().replace(/\s+/g, "_"),
    });
    if (!row) {
      toast.error("Clone failed");
      return;
    }
    toast.success("Template cloned");
    setCloneSource(null);
    setCloneNewKey("");
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/80 bg-card/90 shadow-card">
        <CardHeader>
          <CardTitle>Transactional email templates</CardTitle>
          <CardDescription>
            Brand-aligned defaults (verification, onboarding, reports, alerts). Clone to customize
            per tenant; preview uses sample placeholder values.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {listQuery.isLoading ? (
            <div className="space-y-2" aria-busy="true">
              <Skeleton className="h-10 w-full bg-surface-inner" />
              <Skeleton className="h-10 w-full bg-surface-inner" />
            </div>
          ) : null}

          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Built-in catalog</p>
            <ul className="space-y-2" role="list">
              {builtins.map((b: EmailTemplateBuiltin) => {
                const ph = Array.isArray(b.placeholders) ? b.placeholders : [];
                const override = overrides.find((o) => o.template_key === b.key);
                return (
                  <li
                    key={b.key}
                    className={cn(
                      "flex flex-col gap-2 rounded-xl border border-border/60 bg-surface-inner/50 p-4 transition-all duration-150",
                      "sm:flex-row sm:items-center sm:justify-between",
                    )}
                  >
                    <div>
                      <p className="font-mono text-sm text-primary">{b.key}</p>
                      <p className="text-xs text-muted-foreground">{b.subject}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {ph.map((p) => (
                          <Badge key={p} variant="outline" className="text-[10px] font-normal">
                            {`{{${p}}}`}
                          </Badge>
                        ))}
                      </div>
                      {override ? (
                        <p className="mt-1 text-[10px] text-success">Tenant override active</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          openEditor(
                            b.key,
                            override?.subject ?? b.subject,
                            override?.body ?? b.body,
                          )
                        }
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden />
                        {override ? "Edit override" : "Customize"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => runPreview(b.key)}
                        disabled={previewMut.isPending}
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" aria-hidden />
                        Preview
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setCloneSource(b.key);
                          setCloneNewKey(`${b.key}_copy`);
                        }}
                      >
                        <Copy className="mr-1 h-3.5 w-3.5" aria-hidden />
                        Clone
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {overrides.length > 0 ? (
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Tenant overrides</p>
              <ScrollArea className="h-48 rounded-lg border border-border/60">
                <ul className="p-2 text-sm">
                  {overrides.map((o: EmailTemplateRow) => (
                    <li
                      key={o.id}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-surface-inner"
                    >
                      <span className="font-mono text-xs text-primary">{o.template_key}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditor(o.template_key, o.subject, o.body)}
                      >
                        Edit
                      </Button>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={Boolean(editingKey)} onOpenChange={(o) => !o && setEditingKey(null)}>
        <DialogContent className="max-w-lg border-border/80 bg-card">
          <DialogHeader>
            <DialogTitle>Edit template</DialogTitle>
            <DialogDescription>Key: {editingKey}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(saveEditor)} className="space-y-4">
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <FormControl>
                      <Input className="bg-surface-inner" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="body"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Body</FormLabel>
                    <FormControl>
                      <Textarea className="min-h-[200px] bg-surface-inner font-mono text-xs" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setEditingKey(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="cta" disabled={upsertMut.isPending}>
                  {upsertMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(cloneSource)} onOpenChange={(o) => !o && setCloneSource(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clone template</DialogTitle>
            <DialogDescription>From {cloneSource}</DialogDescription>
          </DialogHeader>
          <Input
            value={cloneNewKey}
            onChange={(e) => setCloneNewKey(e.target.value)}
            placeholder="new_template_key"
            className="bg-surface-inner"
            aria-label="New template key"
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setCloneSource(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="cta"
              disabled={cloneMut.isPending}
              onClick={() => void submitClone()}
            >
              {cloneMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Clone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Preview</DialogTitle>
          </DialogHeader>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-border/60 bg-surface-inner p-3 text-xs text-muted-foreground">
            {previewText}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
