import { useState } from "react";

import { Bot, Send } from "lucide-react";

import { edgeApi } from "@/api/edge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type ChatMessage = { role: "user" | "assistant"; content: string };

export type AIChatWidgetProps = {
  departmentId: string;
  departmentName: string;
  contextEntitiesSummary?: string;
  className?: string;
};

export function AIChatWidget({
  departmentId,
  departmentName,
  contextEntitiesSummary,
  className,
}: AIChatWidgetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;
    if (!isSupabaseConfigured) {
      setMessages((m) => [
        ...m,
        { role: "user", content: trimmed },
        {
          role: "assistant",
          content:
            "Supabase is not configured. Connect the project to enable the department-scoped assistant.",
        },
      ]);
      setInput("");
      return;
    }

    const systemPreamble = [
      "You are the department AI assistant for Connected AI Business OS.",
      `Department id: ${departmentId}. Department name: ${departmentName}.`,
      "Only answer using provided context; do not fabricate tenant data.",
      contextEntitiesSummary
        ? `Unified context (truncated):\n${contextEntitiesSummary.slice(0, 3500)}`
        : "No additional unified entity context was provided.",
    ].join("\n");

    const nextMessages: { role: string; content: string }[] = [
      { role: "system", content: systemPreamble },
      ...messages.map((x) => ({ role: x.role, content: x.content })),
      { role: "user", content: trimmed },
    ];

    setMessages((m) => [...m, { role: "user", content: trimmed }]);
    setInput("");
    setIsSending(true);
    try {
      const data = await edgeApi.invoke<{
        choices?: { message?: { content?: string } }[];
      }>("llm-proxy", { messages: nextMessages });
      const text =
        data?.choices?.[0]?.message?.content ??
        "The model did not return a response.";
      setMessages((m) => [...m, { role: "assistant", content: String(text) }]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "Unable to reach the AI service. Try again shortly.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Card className={cn("border-border/80 bg-card/90 shadow-card", className)}>
      <CardHeader className="flex flex-row items-center gap-2">
        <Bot className="h-5 w-5 text-primary" aria-hidden />
        <CardTitle className="text-base">Department AI assistant</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ScrollArea
          className="h-64 rounded-lg border border-border/60 bg-surface-inner/60 p-3"
          type="always"
          aria-label="Chat messages"
        >
          <div className="space-y-3 pr-2">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ask about priorities, blockers, or documents scoped to this department.
              </p>
            ) : null}
            {messages.map((m, idx) => (
              <div
                key={`${idx}-${m.role}`}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm",
                  m.role === "user"
                    ? "ml-6 bg-primary/10 text-foreground"
                    : "mr-6 bg-muted/40 text-muted-foreground",
                )}
              >
                {m.content}
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question…"
            className="min-h-[80px] flex-1 resize-none"
            aria-label="Message to department assistant"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />
          <Button
            type="button"
            variant="cta"
            className="sm:self-end"
            disabled={isSending || !input.trim()}
            onClick={() => void handleSend()}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
            Send
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
