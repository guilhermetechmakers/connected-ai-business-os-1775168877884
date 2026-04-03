import { Plus } from "lucide-react";
import type { UseFieldArrayReturn } from "react-hook-form";

import { DepartmentRow } from "@/components/tenancy/department-row";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { CompanySetupFormValues } from "@/lib/company-setup-form-schema";
import { cn } from "@/lib/utils";

export interface DefaultDepartmentTemplate {
  id: string;
  name: string;
  order: number;
}

interface DepartmentsTemplateEditorProps {
  fields: UseFieldArrayReturn<CompanySetupFormValues, "departments", "id">["fields"];
  append: UseFieldArrayReturn<CompanySetupFormValues, "departments", "id">["append"];
  remove: UseFieldArrayReturn<CompanySetupFormValues, "departments", "id">["remove"];
  watchDepartmentName: (index: number) => string;
  setDepartmentName: (index: number, value: string) => void;
  defaultTemplates: DefaultDepartmentTemplate[];
  enabledTemplateIds: Record<string, boolean>;
  onToggleTemplate: (id: string, checked: boolean) => void;
}

export function DepartmentsTemplateEditor({
  fields,
  append,
  remove,
  watchDepartmentName,
  setDepartmentName,
  defaultTemplates,
  enabledTemplateIds,
  onToggleTemplate,
}: DepartmentsTemplateEditorProps) {
  const templates = Array.isArray(defaultTemplates) ? defaultTemplates : [];

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">Default department templates</p>
        <p className="text-sm text-muted-foreground">
          Enable starter workspaces; you can rename departments later in settings.
        </p>
        <ul className="grid gap-2 sm:grid-cols-2" role="list">
          {templates.map((t) => {
            const checked = enabledTemplateIds[t.id] !== false;
            return (
              <li
                key={t.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl border border-border/60 bg-surface-inner/50 p-3 transition-all duration-150",
                  "hover:border-primary/30 hover:-translate-y-0.5",
                )}
              >
                <Checkbox
                  id={`dept-tpl-${t.id}`}
                  checked={checked}
                  onCheckedChange={(c) => onToggleTemplate(t.id, c === true)}
                  aria-label={`Include ${t.name} department`}
                />
                <Label
                  htmlFor={`dept-tpl-${t.id}`}
                  className="cursor-pointer text-sm font-normal leading-none text-foreground"
                >
                  {t.name}
                </Label>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="space-y-2 border-t border-border/60 pt-6">
        <p className="text-sm font-medium text-foreground">Custom departments</p>
        <div className="space-y-2">
          {(fields ?? []).map((f, index) => (
            <DepartmentRow
              key={f.id}
              index={index}
              value={watchDepartmentName(index)}
              onChange={(v) => setDepartmentName(index, v)}
              onRemove={() => remove(index)}
              canRemove={(fields ?? []).length > 1}
            />
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-primary/30"
          onClick={() => append({ name: "" })}
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          Add custom department
        </Button>
      </div>
    </div>
  );
}
