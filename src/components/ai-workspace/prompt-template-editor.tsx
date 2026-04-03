import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { FileEdit } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useUpsertPromptTemplate } from "@/hooks/use-ai";
import { cn } from "@/lib/utils";
import type { AiChatMode, AiPromptTemplateRow } from "@/types/ai";

const editorSchema = z.object({
  templateId: z.string().optional(),
  name: z.string().min(1, "Name required").max(200),
  templateText: z.string().min(1, "Template required").max(32000),
  workspaceMode: z.enum(["Ask", "Analyze", "Report", "Action"]),
  isActive: z.boolean(),
  version: z.coerce.number().int().min(1).max(9999),
});

type EditorValues = z.infer<typeof editorSchema>;

export function PromptTemplateEditor({
  mode,
  templates,
  canEdit,
  className,
}: {
  mode: AiChatMode;
  templates: AiPromptTemplateRow[];
  canEdit: boolean;
  className?: string;
}) {
  const upsert = useUpsertPromptTemplate();
  const safe = Array.isArray(templates) ? templates : [];
  const forMode = useMemo(
    () => safe.filter((t) => !t.workspace_mode || t.workspace_mode === mode),
    [safe, mode],
  );

  const form = useForm<EditorValues>({
    resolver: zodResolver(editorSchema),
    defaultValues: {
      templateId: "",
      name: "",
      templateText: "",
      workspaceMode: mode,
      isActive: true,
      version: 1,
    },
  });

  useEffect(() => {
    form.setValue("workspaceMode", mode);
    const first = forMode[0];
    if (!first) {
      form.reset({
        templateId: "",
        name: `${mode} template`,
        templateText: `You are assisting in ${mode} mode. Context: {{context}}`,
        workspaceMode: mode,
        isActive: true,
        version: 1,
      });
      return;
    }
    const currentId = form.getValues("templateId");
    const sel = forMode.find((t) => t.id === currentId) ?? first;
    form.reset({
      templateId: sel.id,
      name: sel.name,
      templateText: sel.template_text,
      workspaceMode: (sel.workspace_mode ?? mode) as AiChatMode,
      isActive: sel.is_active,
      version: sel.version ?? 1,
    });
  }, [forMode, mode, form]);

  const onSubmit = (values: EditorValues) => {
    if (!canEdit) {
      toast.error("Your role cannot publish prompt templates.");
      return;
    }
    upsert.mutate(
      {
        templateId: values.templateId || undefined,
        name: values.name,
        templateText: values.templateText,
        workspaceMode: values.workspaceMode,
        isActive: values.isActive,
        version: values.version,
        slots: [],
      },
      {
        onSuccess: (row) => {
          toast.success(values.templateId ? "Template updated" : "Template created");
          if (row?.id) form.setValue("templateId", row.id);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
      },
    );
  };

  return (
    <Card
      className={cn(
        "border-border/80 bg-card/90 shadow-card transition-transform duration-150 hover:-translate-y-0.5",
        className,
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-display">
          <FileEdit className="h-4 w-4 text-primary" aria-hidden />
          Prompt library editor
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {canEdit
            ? "Publish tenant-scoped templates per mode. Use {{placeholders}} for assembly."
            : "View only — admins, managers, and executives can publish templates."}
        </p>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            {forMode.length > 0 ? (
              <FormField
                control={form.control}
                name="templateId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Existing template</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v);
                        const sel = forMode.find((t) => t.id === v);
                        if (sel) {
                          form.setValue("name", sel.name);
                          form.setValue("templateText", sel.template_text);
                          form.setValue("isActive", sel.is_active);
                          form.setValue("version", sel.version ?? 1);
                        }
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-surface-inner">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {forMode.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name} (v{t.version})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Name</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-surface-inner" disabled={!canEdit} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="templateText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Template body</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={6}
                      className="bg-surface-inner font-mono text-xs"
                      disabled={!canEdit}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex flex-wrap items-center gap-4">
              <FormField
                control={form.control}
                name="workspaceMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Mode</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => field.onChange(v as AiChatMode)}
                      disabled={!canEdit}
                    >
                      <FormControl>
                        <SelectTrigger className="h-9 w-[140px] bg-surface-inner">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Ask">Ask</SelectItem>
                        <SelectItem value="Analyze">Analyze</SelectItem>
                        <SelectItem value="Report">Report</SelectItem>
                        <SelectItem value="Action">Action</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="version"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Version</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        className="h-9 w-24 bg-surface-inner"
                        disabled={!canEdit}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-2 space-y-0 pt-6">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} disabled={!canEdit} />
                    </FormControl>
                    <FormLabel className="text-xs">Active</FormLabel>
                  </FormItem>
                )}
              />
            </div>
            <Button
              type="submit"
              variant="cta"
              size="sm"
              disabled={!canEdit || upsert.isPending}
              className="transition-transform duration-150 hover:scale-[1.02]"
            >
              {upsert.isPending ? "Saving…" : "Save / publish"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
