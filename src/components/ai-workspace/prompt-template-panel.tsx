import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { assemblePrompt } from "@/lib/ai-api";
import type { AiPromptTemplateRow } from "@/types/ai";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LOCAL_FALLBACKS: AiPromptTemplateRow[] = [
  {
    id: "local-weekly-brief",
    name: "Weekly executive brief",
    department: null,
    purpose: "Report",
    template_text:
      "Summarize operational risks and wins for {{focus_area}} this week using only tenant context provided.",
    slots: ["focus_area"],
    is_active: true,
  },
  {
    id: "local-bottleneck",
    name: "Bottleneck analysis",
    department: null,
    purpose: "Analyze",
    template_text:
      "Analyze likely bottlenecks for {{team}} from tasks and projects in context. Give 3 hypotheses and what data would confirm each.",
    slots: ["team"],
    is_active: true,
  },
];

function slotNamesFromRow(row: AiPromptTemplateRow): string[] {
  const s = row.slots;
  if (Array.isArray(s)) {
    return s.filter((x): x is string => typeof x === "string");
  }
  if (s && typeof s === "object" && Array.isArray((s as { names?: unknown }).names)) {
    return ((s as { names: unknown[] }).names).filter((x): x is string => typeof x === "string");
  }
  const re = /\{\{\s*(\w+)\s*\}\}/g;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(row.template_text)) !== null) found.add(m[1]);
  return [...found];
}

export function PromptTemplatePanel({
  templates,
  isLoading,
  onApplyText,
}: {
  templates: AiPromptTemplateRow[];
  isLoading: boolean;
  onApplyText: (text: string) => void;
}) {
  const safeTemplates = Array.isArray(templates) ? templates : [];
  const merged = useMemo(
    () => (safeTemplates.length > 0 ? safeTemplates : LOCAL_FALLBACKS),
    [safeTemplates],
  );
  const [templateId, setTemplateId] = useState<string>("");
  const [slotValues, setSlotValues] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  const effectiveId = templateId || merged[0]?.id || "";

  useEffect(() => {
    if (merged.length && !merged.some((t) => t.id === templateId)) {
      setTemplateId(merged[0].id);
      setSlotValues({});
    }
  }, [merged, templateId]);

  const selected = useMemo(
    () => merged.find((t) => t.id === effectiveId),
    [merged, effectiveId],
  );
  const slots = selected ? slotNamesFromRow(selected) : [];

  const assemble = async () => {
    if (!effectiveId) {
      toast.error("Select a template");
      return;
    }
    setPending(true);
    try {
      if (String(effectiveId).startsWith("local-")) {
        let text = selected?.template_text ?? "";
        for (const k of slots) {
          text = text.replaceAll(
            new RegExp(`\\{\\{\\s*${k}\\s*\\}}`, "g"),
            slotValues[k] ?? `{{${k}}}`,
          );
        }
        onApplyText(text);
        toast.success("Template applied to composer");
        return;
      }
      const assembled = await assemblePrompt(effectiveId, slotValues);
      onApplyText(assembled);
      toast.success("Template applied to composer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Assembly failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="border-border/80 bg-card/90 shadow-card transition-transform duration-150 hover:-translate-y-0.5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Prompt templates</CardTitle>
        <p className="text-xs text-muted-foreground">
          Role-aware templates from your tenant; slots fill into the composer.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && safeTemplates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading templates…</p>
        ) : (
          <>
            {safeTemplates.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No tenant templates in <code className="text-primary">ai_prompt_templates</code>{" "}
                — showing starters below.
              </p>
            ) : null}
            <div className="space-y-1">
              <Label htmlFor="tpl-select" className="text-xs uppercase tracking-wider">
                Template
              </Label>
              <Select value={effectiveId} onValueChange={setTemplateId}>
                <SelectTrigger id="tpl-select" className="bg-surface-inner">
                  <SelectValue placeholder="Choose template" />
                </SelectTrigger>
                <SelectContent>
                  {merged.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {slots.map((name) => (
              <div key={name} className="space-y-1">
                <Label htmlFor={`slot-${name}`} className="text-xs">
                  {name}
                </Label>
                <Input
                  id={`slot-${name}`}
                  value={slotValues[name] ?? ""}
                  onChange={(e) =>
                    setSlotValues((prev) => ({ ...prev, [name]: e.target.value }))
                  }
                  className="bg-surface-inner"
                />
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full transition-transform duration-150 hover:scale-[1.02]"
              disabled={pending}
              onClick={() => void assemble()}
            >
              {pending ? "Assembling…" : "Apply to composer"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
