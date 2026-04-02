import { FileBarChart } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReportTemplateRow } from "@/types/unified";

export type ReportCardProps = {
  template: ReportTemplateRow;
  onOpen?: (template: ReportTemplateRow) => void;
};

export function ReportCard({ template, onOpen }: ReportCardProps) {
  return (
    <Card
      className="border-border/80 bg-card/90 shadow-card transition-all duration-150 hover:-translate-y-1 hover:shadow-card-hover"
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={() => onOpen?.(template)}
      onKeyDown={(e) => {
        if (!onOpen) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(template);
        }
      }}
    >
      <CardHeader className="flex flex-row items-start gap-3 space-y-0">
        <FileBarChart className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1">
          <CardTitle className="text-base leading-snug">{template.name}</CardTitle>
          <p className="text-xs text-muted-foreground">
            Updated {new Date(template.updated_at).toLocaleString()}
          </p>
        </div>
        {template.department_id ? (
          <Badge variant="outline" className="shrink-0 text-[10px] uppercase">
            Dept
          </Badge>
        ) : (
          <Badge variant="secondary" className="shrink-0 text-[10px] uppercase">
            Global
          </Badge>
        )}
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">
        Template definition stored as structured JSON in the unified reporting layer.
      </CardContent>
    </Card>
  );
}
