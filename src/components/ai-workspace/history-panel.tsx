import { useMemo, useState } from "react";
import { Download, History } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AiChatMode, AiConversationRow, AiMessageRow } from "@/types/ai";

function downloadBlob(filename: string, body: string, mime: string) {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function messagesToTranscript(messages: AiMessageRow[]): string {
  const list = Array.isArray(messages) ? messages : [];
  return list
    .map((m) => {
      const who = m.role === "user" ? "User" : m.role === "assistant" ? "Assistant" : "System";
      return `[${who}] ${m.created_at}\n${m.content}\n`;
    })
    .join("\n");
}

export function HistoryPanel({
  conversations,
  activeConversationId,
  onSelectConversation,
  messages,
  className,
}: {
  conversations: AiConversationRow[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  messages: AiMessageRow[];
  className?: string;
}) {
  const [modeFilter, setModeFilter] = useState<"all" | AiChatMode>("all");
  const convs = Array.isArray(conversations) ? conversations : [];
  const filtered = useMemo(() => {
    if (modeFilter === "all") return convs;
    return convs.filter((c) => c.mode === modeFilter);
  }, [convs, modeFilter]);

  const exportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      conversationId: activeConversationId,
      messages: Array.isArray(messages) ? messages : [],
    };
    downloadBlob(
      `ai-workspace-${activeConversationId ?? "export"}.json`,
      JSON.stringify(payload, null, 2),
      "application/json",
    );
    toast.success("Exported JSON");
  };

  const exportCsv = () => {
    const list = Array.isArray(messages) ? messages : [];
    const header = "role,created_at,content\n";
    const rows = list
      .map((m) => {
        const content = JSON.stringify(m.content ?? "").slice(1, -1);
        return `${m.role},${m.created_at},${content}`;
      })
      .join("\n");
    downloadBlob(
      `ai-workspace-${activeConversationId ?? "export"}.csv`,
      header + rows,
      "text/csv",
    );
    toast.success("Exported CSV");
  };

  const exportTranscript = () => {
    const text = messagesToTranscript(messages);
    downloadBlob(
      `ai-workspace-${activeConversationId ?? "transcript"}.txt`,
      text,
      "text/plain",
    );
    toast.success("Exported transcript");
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
          <History className="h-4 w-4 text-primary" aria-hidden />
          History &amp; export
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Filter threads by mode; export the active conversation for audit or compliance.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="hist-mode" className="text-xs uppercase tracking-wider">
            Mode filter
          </Label>
          <Select
            value={modeFilter}
            onValueChange={(v) => setModeFilter(v as "all" | AiChatMode)}
          >
            <SelectTrigger id="hist-mode" className="bg-surface-inner h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All modes</SelectItem>
              <SelectItem value="Ask">Ask</SelectItem>
              <SelectItem value="Analyze">Analyze</SelectItem>
              <SelectItem value="Report">Report</SelectItem>
              <SelectItem value="Action">Action</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ul className="max-h-[140px] space-y-1 overflow-auto rounded-lg border border-border/50 bg-surface-inner/50 p-2 text-xs">
          {filtered.length === 0 ? (
            <li className="text-muted-foreground">No conversations match.</li>
          ) : (
            filtered.slice(0, 20).map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={cn(
                    "w-full rounded-md px-2 py-1.5 text-left transition-colors duration-150",
                    c.id === activeConversationId
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted/60",
                  )}
                  onClick={() => onSelectConversation(c.id)}
                >
                  <span className="line-clamp-1 font-medium">{c.title ?? c.mode}</span>
                  <span className="block text-[10px] text-muted-foreground">{c.mode}</span>
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1 text-xs"
            disabled={!activeConversationId || messages.length === 0}
            onClick={() => exportJson()}
          >
            <Download className="h-3.5 w-3.5" />
            JSON
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1 text-xs"
            disabled={!activeConversationId || messages.length === 0}
            onClick={() => exportCsv()}
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1 text-xs"
            disabled={!activeConversationId || messages.length === 0}
            onClick={() => exportTranscript()}
          >
            <Download className="h-3.5 w-3.5" />
            Transcript
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
