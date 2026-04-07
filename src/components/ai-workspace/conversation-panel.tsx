import { Check, Loader2, Sparkles, WrenchIcon, Zap } from "lucide-react";

import { ModeSwitch } from "@/components/ai-workspace/mode-switch";
import { SourceCitationsBlock } from "@/components/ai-workspace/source-citations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AiAgentToolCall, AiChatMode, AiConversationRow, AiMessageRow, AiSourceCitation } from "@/types/ai";

export function ConversationPanel({
  mode,
  onModeChange,
  conversations,
  conversationId,
  onSelectConversation,
  listLoading,
  detailLoading,
  messages,
  isStreaming,
  streamingText,
  liveCitations,
  input,
  onInputChange,
  onSend,
}: {
  mode: AiChatMode;
  onModeChange: (m: AiChatMode) => void;
  conversations: AiConversationRow[];
  conversationId: string | null;
  onSelectConversation: (id: string) => void;
  listLoading: boolean;
  detailLoading: boolean;
  messages: AiMessageRow[];
  isStreaming: boolean;
  streamingText: string;
  liveCitations: AiSourceCitation[];
  liveToolCalls: AiAgentToolCall[];
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
}) {
  const convoList = Array.isArray(conversations) ? conversations : [];
  const msgList = Array.isArray(messages) ? messages : [];
  const cites = Array.isArray(liveCitations) ? liveCitations : [];
  const toolCalls = Array.isArray(liveToolCalls) ? liveToolCalls : [];

  return (
    <Card className="border-border/80 bg-card/90 shadow-card lg:col-span-2">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-2 text-lg font-display">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden />
            Conversation
          </CardTitle>
          {listLoading ? (
            <span className="text-xs text-muted-foreground">Loading threads…</span>
          ) : convoList.length > 0 ? (
            <label className="sr-only" htmlFor="thread-select">
              Active thread
            </label>
          ) : null}
        </div>
        <ModeSwitch value={mode} onValueChange={onModeChange} />
      </CardHeader>
      <CardContent className="space-y-4">
        {convoList.length > 0 ? (
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Conversations">
            {convoList.slice(0, 8).map((c) => (
              <Button
                key={c.id}
                type="button"
                size="sm"
                variant={c.id === conversationId ? "secondary" : "ghost"}
                className="max-w-[200px] truncate text-xs transition-transform duration-150 hover:scale-[1.02]"
                onClick={() => onSelectConversation(c.id)}
              >
                {c.title ?? c.mode}
              </Button>
            ))}
          </div>
        ) : null}

        <ScrollArea
          className="h-[min(420px,50vh)] rounded-xl border border-border/60 bg-surface-inner/80 p-4"
          aria-label="Chat messages"
        >
          {detailLoading && conversationId ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading messages…
            </div>
          ) : (
            <ul className="space-y-4 text-sm">
              {msgList.map((m) => (
                <li key={m.id}>
                  <div
                    className={cn(
                      "rounded-xl border border-border/50 px-3 py-2 transition-all duration-150",
                      m.role === "user"
                        ? "ml-4 border-primary/20 bg-primary/5"
                        : "mr-4 bg-card/60",
                    )}
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                      {m.role === "user" ? "You" : m.role === "assistant" ? "AI" : "System"}
                    </span>
                    <p className="mt-1 whitespace-pre-wrap leading-relaxed text-foreground">{m.content}</p>
                    <div className="mt-2">
                      <SourceCitationsBlock citations={m.citations} />
                    </div>
                  </div>
                </li>
              ))}
              {isStreaming && toolCalls.length > 0 ? (
                <li aria-label="Agent tool activity">
                  <div className="mr-4 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                    <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                      <WrenchIcon className="h-3 w-3" aria-hidden />
                      Agent working
                    </span>
                    <ul className="mt-2 space-y-2">
                      {toolCalls.map((tc) => {
                        const argEntries = tc.args ? Object.entries(tc.args).slice(0, 3) : [];
                        const argSummary = argEntries
                          .map(([k, v]) => `${k}: ${String(v).slice(0, 40)}`)
                          .join(", ");
                        return (
                          <li key={tc.id} className="flex items-start gap-2 text-xs">
                            {tc.status === "running" ? (
                              <Loader2
                                className="mt-0.5 h-3 w-3 shrink-0 animate-spin text-amber-500"
                                aria-label="Running"
                              />
                            ) : (
                              <Check
                                className="mt-0.5 h-3 w-3 shrink-0 text-success"
                                aria-label="Done"
                              />
                            )}
                            <div className="min-w-0">
                              <span className="font-medium text-foreground">
                                {tc.name.replace(/_/g, " ")}
                              </span>
                              {argSummary ? (
                                <span className="ml-1 text-muted-foreground">
                                  ({argSummary})
                                </span>
                              ) : null}
                              {tc.preview ? (
                                <p className="mt-0.5 truncate text-muted-foreground">
                                  {tc.preview.slice(0, 120)}
                                  {tc.preview.length > 120 ? "…" : ""}
                                </p>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </li>
              ) : null}
              {isStreaming ? (
                <li>
                  <div className="mr-4 rounded-xl border border-success/30 bg-card/60 px-3 py-2">
                    <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                      <span className="relative flex h-2 w-2" aria-label="Streaming">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/80 opacity-60 motion-reduce:hidden" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                      </span>
                      AI
                    </span>
                    <p className="mt-1 whitespace-pre-wrap leading-relaxed text-muted-foreground">
                      {streamingText || "…"}
                    </p>
                    {cites.length > 0 ? (
                      <div className="mt-2">
                        <SourceCitationsBlock citations={cites} />
                      </div>
                    ) : null}
                  </div>
                </li>
              ) : null}
            </ul>
          )}
        </ScrollArea>

        <Textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={`${mode}: type your message…`}
          className="min-h-[100px] bg-surface-inner focus-visible:ring-primary/20"
          disabled={isStreaming}
          aria-label="Message composer"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void onSend();
            }
          }}
        />
        <Button
          variant="cta"
          disabled={isStreaming || !input.trim()}
          className="transition-transform duration-150 hover:scale-[1.02]"
          onClick={() => void onSend()}
        >
          {isStreaming ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Streaming…
            </>
          ) : (
            <>
              <Zap className="mr-2 h-4 w-4" />
              Send
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
