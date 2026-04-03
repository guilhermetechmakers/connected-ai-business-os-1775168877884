import { Bot, Send, Sparkles } from "lucide-react";
import { useState } from "react";

import { generateDepartmentAiResponse } from "@/api/department-workspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type ChatMessage = { role: "user" | "assistant"; content: string };

export type AIWorkspacePanelProps = {
  departmentId: string;
  departmentName: string;
  contextSummary: string;
  className?: string;
};

const TEMPLATES: { label: string; text: string }[] = [
  { label: "Weekly brief", text: "Summarize top priorities and risks for this department this week." },
  { label: "Blockers", text: "List likely blockers based on the unified task context." },
  { label: "Next actions", text: "Suggest three concrete next actions for the department lead." },
];

export function AIWorkspacePanel({
  departmentId,
  departmentName,
  contextSummary,
  className,
}: AIWorkspacePanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"ask" | "analyze" | "report" | "action">("ask");
  const [isSending, setIsSending] = useState(false);
  const [sources, setSources] = useState<string[]>([]);

  async function sendPrompt(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    if (!isSupabaseConfigured) {
      setMessages((m) => [
        ...m,
        { role: "user", content: trimmed },
        {
          role: "assistant",
          content:
            "Connect Supabase to use the department-scoped AI edge function (department-workspace-api).",
        },
      ]);
      return;
    }

    setMessages((m) => [...m, { role: "user", content: trimmed }]);
    setInput("");
    setIsSending(true);
    setSources([]);

    const { data, error } = await generateDepartmentAiResponse({
      departmentId,
      departmentName,
      prompt: trimmed,
      contextSummary,
      mode,
    });

    if (error || !data) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: error ?? "The assistant could not complete this request.",
        },
      ]);
    } else {
      const cite = (data.citations ?? [])
        .map((c) => `${c.type}:${c.id.slice(0, 8)}…`)
        .filter(Boolean);
      setSources(cite);
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    }
    setIsSending(false);
  }

  return (
    <Card className={cn("border-border/80 bg-card/90 shadow-card", className)}>
      <CardHeader className="space-y-4">
        <div className="flex flex-row items-center gap-2">
          <Bot className="h-5 w-5 text-primary" aria-hidden />
          <CardTitle className="text-base">Department AI assistant</CardTitle>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">Mode</p>
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(v) => {
              if (v === "ask" || v === "analyze" || v === "report" || v === "action") {
                setMode(v);
              }
            }}
            className="flex flex-wrap justify-start gap-1"
            aria-label="AI interaction mode"
          >
            {(["ask", "analyze", "report", "action"] as const).map((m) => (
              <ToggleGroupItem
                key={m}
                value={m}
                className="rounded-full px-3 text-xs capitalize data-[state=on]:bg-primary/15 data-[state=on]:text-primary"
              >
                {m}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <Button
              key={t.label}
              type="button"
              variant="outline"
              size="sm"
              className="gap-1 border-primary/20 text-xs"
              onClick={() => void sendPrompt(t.text)}
              disabled={isSending}
              aria-label={`Insert template ${t.label}`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {t.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ScrollArea
          className="h-72 rounded-lg border border-border/60 bg-surface-inner/60 p-3"
          type="always"
          aria-label="AI conversation"
        >
          <div className="space-y-3 pr-2">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ask questions grounded in unified entities for {departmentName}. Sensitive actions require
                confirmation in production workflows.
              </p>
            ) : null}
            {messages.map((m, idx) => (
              <div
                key={`${idx}-${m.role}`}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm transition-colors duration-150",
                  m.role === "user"
                    ? "ml-8 bg-primary/10 text-foreground"
                    : "mr-8 bg-muted/30 text-muted-foreground",
                )}
              >
                {m.content}
              </div>
            ))}
          </div>
        </ScrollArea>
        {sources.length > 0 ? (
          <p className="text-xs text-muted-foreground" aria-label="Source references">
            Sources: {sources.join(" · ")}
          </p>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message the department assistant…"
            className="min-h-[88px] flex-1 bg-surface-inner"
            aria-label="AI message input"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendPrompt(input);
              }
            }}
          />
          <Button
            type="button"
            variant="cta"
            className="sm:self-end"
            disabled={isSending}
            onClick={() => void sendPrompt(input)}
            aria-label="Send message"
          >
            <Send className="mr-2 h-4 w-4" />
            Send
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
