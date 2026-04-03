import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
const FIELD_OPTIONS = [
  { id: "id", label: "ID" },
  { id: "type", label: "Type" },
  { id: "title", label: "Title" },
  { id: "snippet", label: "Snippet" },
  { id: "source", label: "Source" },
  { id: "date", label: "Date" },
  { id: "owner", label: "Owner" },
  { id: "departmentId", label: "Department" },
] as const;

export type SearchExportModalProps = {
  query: string;
  disabled?: boolean;
  onExport: (input: {
    format: "csv" | "json";
    fields: string[];
  }) => Promise<{ content: string; filename: string; mimeType: string } | null>;
};

function triggerDownload(payload: { content: string; filename: string; mimeType: string }) {
  const blob = new Blob([payload.content], { type: payload.mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = payload.filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function SearchExportModal({ query, disabled, onExport }: SearchExportModalProps) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(FIELD_OPTIONS.map((f) => f.id)),
  );
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 border-border/70"
          disabled={disabled || query.trim().length < 2}
        >
          <Download className="h-4 w-4" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="border-border/80 bg-card sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Export results</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as "csv" | "json")}>
              <SelectTrigger className="bg-surface-inner">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">Fields</legend>
            <div className="grid grid-cols-2 gap-2">
              {FIELD_OPTIONS.map((f) => (
                <label
                  key={f.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border/50 px-2 py-1.5 text-sm"
                >
                  <Checkbox
                    checked={selected.has(f.id)}
                    onCheckedChange={() => toggle(f.id)}
                    aria-label={f.label}
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="cta"
            disabled={busy || selected.size === 0}
            onClick={async () => {
              setBusy(true);
              try {
                const out = await onExport({
                  format,
                  fields: [...selected],
                });
                if (!out) {
                  toast.error("Export failed.");
                  return;
                }
                triggerDownload(out);
                toast.success("Download started.");
                setOpen(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Preparing…" : "Download"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
