import { useMemo, useRef, useState } from "react";
import { Upload, RefreshCcw, Trash2, FileStack } from "lucide-react";
import { toast } from "sonner";

import {
  useCompanyDepartmentNamesQuery,
  useCompanyRoleNamesQuery,
  useKnowledgeBaseDeleteMutation,
  useKnowledgeBaseDocumentsQuery,
  useKnowledgeBaseIngestMutation,
  useKnowledgeBaseReindexMutation,
} from "@/hooks/use-knowledge-base";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { KbIngestDocumentInput } from "@/types/knowledge-base";

const KB_ACCEPT = ".pdf,.docx,.csv,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/csv,text/plain,text/markdown";

type VisibilityScope = "tenant" | "restricted";

async function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const out = typeof fr.result === "string" ? fr.result : "";
      const base64 = out.includes(",") ? out.split(",")[1] ?? "" : out;
      if (!base64) {
        reject(new Error("Could not read file data"));
        return;
      }
      resolve(base64);
    };
    fr.onerror = () => reject(new Error("Could not read file data"));
    fr.readAsDataURL(file);
  });
}

function statusTone(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "ready") return "secondary";
  if (status === "failed") return "destructive";
  if (status === "indexing") return "default";
  return "outline";
}

export function KnowledgeBasePanel() {
  const uploadRef = useRef<HTMLInputElement>(null);
  const [sourceFilter, setSourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "indexing" | "ready" | "failed">("all");
  const [scope, setScope] = useState<VisibilityScope>("tenant");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [lastResults, setLastResults] = useState<Array<{ filename: string; indexStatus: string; message: string }>>([]);

  const { data: docs = [], isLoading: docsLoading } = useKnowledgeBaseDocumentsQuery({
    sourceFilter,
    statusFilter: statusFilter === "all" ? undefined : statusFilter,
  });
  const { data: roleNames = [] } = useCompanyRoleNamesQuery();
  const { data: departmentNames = [] } = useCompanyDepartmentNamesQuery();

  const ingestMutation = useKnowledgeBaseIngestMutation();
  const reindexMutation = useKnowledgeBaseReindexMutation();
  const deleteMutation = useKnowledgeBaseDeleteMutation();

  const sortedDocs = useMemo(() => {
    const list = Array.isArray(docs) ? docs : [];
    return [...list].sort((a, b) => {
      const at = Date.parse(a.updatedAt ?? "");
      const bt = Date.parse(b.updatedAt ?? "");
      return bt - at;
    });
  }, [docs]);

  const onSelectFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const picked = Array.from(files);
    const visibility =
      scope === "tenant"
        ? { scope: "tenant" as const }
        : {
            scope: "restricted" as const,
            roles: selectedRoles,
            departments: selectedDepartments,
          };

    try {
      const payload: KbIngestDocumentInput[] = [];
      for (const file of picked) {
        const base64 = await toBase64(file);
        payload.push({
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          base64,
          provider: "uploads",
          metadata: {
            uploadedFrom: "ai-workspace",
          },
          visibility,
        });
      }

      const out = await ingestMutation.mutateAsync(payload);
      const rows = Array.isArray(out?.results) ? out.results : [];
      setLastResults(rows.map((r) => ({ filename: r.filename, indexStatus: r.indexStatus, message: r.message })));
      if (out) {
        toast.success(`Indexed ${out.summary.ready}/${out.summary.total} document(s)`);
      } else {
        toast.error("Ingestion failed.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload documents");
    }
  };

  const toggleInList = (list: string[], value: string): string[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  return (
    <Card className="border-border/70 bg-card/90">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-display">
          <FileStack className="h-4 w-4 text-primary" aria-hidden />
          Knowledge base
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Upload company documents, index vectors, and manage visibility for tenant RAG.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={uploadRef}
          type="file"
          accept={KB_ACCEPT}
          multiple
          className="sr-only"
          onChange={(e) => {
            void onSelectFiles(e.currentTarget.files);
            e.currentTarget.value = "";
          }}
        />

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wider">Visibility</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as VisibilityScope)}>
              <SelectTrigger className="h-9 bg-surface-inner text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tenant">Tenant-wide</SelectItem>
                <SelectItem value="restricted">Restricted (roles/departments)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              type="button"
              className="h-9 w-full gap-2"
              disabled={ingestMutation.isPending}
              onClick={() => uploadRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              {ingestMutation.isPending ? "Uploading..." : "Upload documents"}
            </Button>
          </div>
        </div>

        {scope === "restricted" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 rounded-lg border border-border/60 bg-surface-inner/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Roles</p>
              <div className="space-y-2">
                {roleNames.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No roles found.</p>
                ) : (
                  roleNames.map((role) => (
                    <label key={role} className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={selectedRoles.includes(role)}
                        onCheckedChange={() => setSelectedRoles((cur) => toggleInList(cur, role))}
                      />
                      <span>{role}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-border/60 bg-surface-inner/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Departments</p>
              <div className="space-y-2">
                {departmentNames.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No departments found.</p>
                ) : (
                  departmentNames.map((dep) => (
                    <label key={dep} className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={selectedDepartments.includes(dep)}
                        onCheckedChange={() =>
                          setSelectedDepartments((cur) => toggleInList(cur, dep))
                        }
                      />
                      <span>{dep}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}

        {lastResults.length > 0 ? (
          <div className="rounded-lg border border-border/60 bg-surface-inner/50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Latest upload</p>
            <ul className="space-y-1 text-xs">
              {lastResults.map((row) => (
                <li key={`${row.filename}-${row.message}`} className="flex items-center justify-between gap-2">
                  <span className="truncate">{row.filename}</span>
                  <span className={row.indexStatus === "ready" ? "text-success" : "text-destructive"}>
                    {row.indexStatus}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid gap-2 md:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wider">Source filter</Label>
            <Input
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="h-9 bg-surface-inner text-sm"
              placeholder="uploads, notion, drive"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wider">Status filter</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="h-9 bg-surface-inner text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="indexing">Indexing</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {docsLoading ? (
          <p className="text-xs text-muted-foreground">Loading knowledge base...</p>
        ) : sortedDocs.length === 0 ? (
          <p className="text-xs text-muted-foreground">No knowledge base documents indexed yet.</p>
        ) : (
          <ScrollArea className="h-[240px] pr-2">
            <ul className="space-y-2">
              {sortedDocs.map((doc) => (
                <li key={doc.id} className="rounded-lg border border-border/60 bg-surface-inner/50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{doc.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {doc.sourceProvider} · {doc.chunkCount} chunks
                      </p>
                    </div>
                    <Badge variant={statusTone(doc.indexStatus)} className="text-[10px] uppercase">
                      {doc.indexStatus}
                    </Badge>
                  </div>
                  {doc.indexError ? (
                    <p className="mt-2 text-[11px] text-destructive">{doc.indexError}</p>
                  ) : null}
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-xs"
                      disabled={reindexMutation.isPending}
                      onClick={async () => {
                        const row = await reindexMutation.mutateAsync(doc.id);
                        if (row) toast.success("Document reindexed");
                        else toast.error("Reindex failed");
                      }}
                    >
                      <RefreshCcw className="h-3.5 w-3.5" />
                      Reindex
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-xs text-destructive"
                      disabled={deleteMutation.isPending}
                      onClick={async () => {
                        const ok = await deleteMutation.mutateAsync(doc.id);
                        if (ok) toast.success("Document deleted");
                        else toast.error("Delete failed");
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
