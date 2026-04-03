import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
const ENTITY_OPTIONS = [
  "Conversation",
  "Message",
  "Document",
  "Account",
  "Contact",
  "Opportunity",
  "Activity",
  "User",
] as const;

export type MappingPreviewRow = {
  sourceField: string;
  targetEntity: string;
  targetField: string;
  dataType: string;
  sampleValue?: string;
};

export function DataMappingPreviewTable({
  rows,
  onEntityChange,
  readOnly = false,
}: {
  rows: MappingPreviewRow[];
  onEntityChange: (sourceField: string, entity: (typeof ENTITY_OPTIONS)[number]) => void;
  readOnly?: boolean;
}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  return (
    <div className="overflow-hidden rounded-xl border border-border/60">
      <Table>
        <TableHeader>
          <TableRow className="border-border/60 hover:bg-transparent">
            <TableHead>Source field</TableHead>
            <TableHead>Unified entity</TableHead>
            <TableHead>Target field</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Sample</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {safeRows.map((row) => (
            <TableRow key={row.sourceField} className="border-border/60">
              <TableCell className="font-mono text-xs text-primary">{row.sourceField}</TableCell>
              <TableCell>
                {readOnly ? (
                  <span className="text-sm text-foreground">{row.targetEntity}</span>
                ) : (
                  <Select
                    value={row.targetEntity}
                    onValueChange={(v) =>
                      onEntityChange(row.sourceField, v as (typeof ENTITY_OPTIONS)[number])
                    }
                  >
                    <SelectTrigger
                      aria-label={`Target entity for ${row.sourceField}`}
                      className="bg-surface-inner"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ENTITY_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </TableCell>
              <TableCell className="text-sm">{row.targetField}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{row.dataType}</TableCell>
              <TableCell className="max-w-[140px] truncate text-xs text-muted-foreground">
                {row.sampleValue ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export { ENTITY_OPTIONS };
