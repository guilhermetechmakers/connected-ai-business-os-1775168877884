import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Loader2,
  Plus,
  Sparkles,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { ActionConfirmDialog } from "@/components/ai-workspace/action-confirm-dialog";
import { PromptTemplatePanel } from "@/components/ai-workspace/prompt-template-panel";
import { SourceCitationsBlock } from "@/components/ai-workspace/source-citations";
import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAuth } from "@/contexts/auth-context";
import {
  aiQueryKeys,
  useAiActionPermissions,
  useAiConversationDetail,
  useAiConversationsList,
  useCreateAiConversation,
  useExecuteAiAction,
  usePromptTemplates,
  useUpdateAiConversation,
} from "@/hooks/use-ai";
import { streamAiChat } from "@/lib/ai-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { AiChatMode, AiMessageRow, AiPermittedAction, AiSourceCitation } from "@/types/ai";
import { useQueryClient } from "@tanstack/react-query";

const modes: AiChatMode[] = ["Ask", "Analyze", "Report", "Action"];

function normalizeMessages(rows: unknown): AiMessageRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter((m): m is AiMessageRow =>
    Boolean(
      m &&
        typeof m === "object" &&
        "role" in m &&
        "content" in m,
    ),
  );
}

export default function AIWorkspacePage() {
  const { profile } = useAuth();
  const roles = Array.isArray(profile?.roles) ? profile!.roles : [];
  const qc = useQueryClient();

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [mode, setMode] = useState<AiChatMode>("Ask");
  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [liveCitations, setLiveCitations] = useState<AiSourceCitation[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [actionDialog, setActionDialog] = useState<AiPermittedAction | null>(null);

  const { data: convoList = [], isLoading: listLoading } = useAiConversationsList(15);
  const conversations = Array.isArray(convoList) ? convoList : [];
  const { data: detail, isLoading: detailLoading } = useAiConversationDetail(conversationId);
  const { data: templates = [], isLoading: tplLoading } = usePromptTemplates();
  const templateRows = Array.isArray(templates) ? templates : [];
  const { data: permitted = [] } = useAiActionPermissions();
  const permittedActions = Array.isArray(permitted) ? permitted : [];

  const createConvo = useCreateAiConversation();
  const updateConvo = useUpdateAiConversation();
  const executeMutation = useExecuteAiAction();

  const messages = useMemo(
    () => normalizeMessages(detail?.messages),
    [detail?.messages],
  );

  useEffect(() => {
    if (!isSupabaseConfigured || conversationId) return;
    if (conversations.length > 0 && conversations[0]?.id) {
      setConversationId(conversations[0].id);
    }
  }, [conversations, conversationId]);

  useEffect(() => {
    if (detail?.conversation?.mode && modes.includes(detail.conversation.mode as AiChatMode)) {
      setMode(detail.conversation.mode as AiChatMode);
    }
  }, [detail?.conversation?.mode]);

  const startNewChat = useCallback(() => {
    if (!isSupabaseConfigured) {
      toast.error("Configure Supabase to use AI workspace.");
      return;
    }
    createConvo.mutate(
      { mode, title: `${mode} session` },
      {
        onSuccess: (row) => {
          setConversationId(row.id);
          setStreamingText("");
          setLiveCitations([]);
          void qc.invalidateQueries({ queryKey: aiQueryKeys.conversations() });
          toast.success("New conversation");
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create chat"),
      },
    );
  }, [createConvo, mode, qc]);

  const onModeChange = (next: AiChatMode) => {
    setMode(next);
    if (conversationId) {
      updateConvo.mutate({ conversationId, patch: { mode: next } });
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    if (!isSupabaseConfigured) {
      toast.error("Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      return;
    }

    let cid = conversationId;
    if (!cid) {
      try {
        const row = await createConvo.mutateAsync({ mode, title: `${mode} · chat` });
        cid = row.id;
        setConversationId(cid);
        void qc.invalidateQueries({ queryKey: aiQueryKeys.conversations() });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not start conversation");
        return;
      }
    }

    setInput("");
    setStreamingText("");
    setLiveCitations([]);
    setIsStreaming(true);

    await streamAiChat({
      conversationId: cid,
      userMessage: text,
      mode,
      workspaceId: "global",
      onCitations: (c) => {
        const next = Array.isArray(c) ? c : [];
        setLiveCitations(next);
      },
      onChunk: (c) => setStreamingText((prev) => prev + c),
      onDone: () => {
        setIsStreaming(false);
        void qc
          .invalidateQueries({ queryKey: aiQueryKeys.conversation(cid!) })
          .then(() => {
            setStreamingText("");
            setLiveCitations([]);
          });
        void qc.invalidateQueries({ queryKey: aiQueryKeys.dashboardSummary() });
      },
      onError: (msg) => {
        setIsStreaming(false);
        toast.error(msg);
      },
    });
  };

  const quickActions = useMemo(() => {
    const isElevated = roles.some((r) => /admin|manager|owner/i.test(r));
    return isElevated
      ? [
          { label: "Workflows", to: "/dashboard/workflows" },
          { label: "Reports", to: "/reports" },
          { label: "Integrations", to: "/onboarding/integrations" },
        ]
      : [
          { label: "Search", to: "/search" },
          { label: "Notifications", to: "/dashboard/notifications" },
          { label: "Global dashboard", to: "/dashboard/global" },
        ];
  }, [roles]);

  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="AI workspace"
        description="Ask, analyze, report, and gated actions — streaming responses, RAG context, citations, and audited execution."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 transition-transform duration-150 hover:scale-[1.02]"
            disabled={createConvo.isPending}
            onClick={() => startNewChat()}
          >
            <Plus className="h-4 w-4" />
            New conversation
          </Button>
        }
      />

      <div
        className="flex flex-wrap gap-2"
        role="toolbar"
        aria-label="Role-aware quick actions"
      >
        {quickActions.map((a) => (
          <Button
            key={a.to}
            variant="outline"
            size="sm"
            className="gap-1 transition-transform duration-150 hover:scale-[1.02]"
            asChild
          >
            <Link to={a.to}>
              {a.label}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border/80 bg-card/90 shadow-card lg:col-span-2">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-primary" aria-hidden />
                Conversation
              </CardTitle>
              {listLoading ? (
                <span className="text-xs text-muted-foreground">Loading threads…</span>
              ) : conversations.length > 0 ? (
                <label className="sr-only" htmlFor="thread-select">
                  Active thread
                </label>
              ) : null}
            </div>
            <ToggleGroup
              type="single"
              value={mode}
              onValueChange={(v) => {
                if (v) onModeChange(v as AiChatMode);
              }}
              className="justify-end bg-surface-inner p-1 rounded-lg"
              aria-label="AI mode"
            >
              {modes.map((m) => (
                <ToggleGroupItem key={m} value={m} className="px-3 text-xs">
                  {m}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </CardHeader>
          <CardContent className="space-y-4">
            {conversations.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {conversations.slice(0, 6).map((c) => (
                  <Button
                    key={c.id}
                    type="button"
                    size="sm"
                    variant={c.id === conversationId ? "secondary" : "ghost"}
                    className="max-w-[200px] truncate text-xs"
                    onClick={() => {
                      setConversationId(c.id);
                      setStreamingText("");
                    }}
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
                  {messages.map((m) => (
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
                        <p className="mt-1 whitespace-pre-wrap leading-relaxed text-foreground">
                          {m.content}
                        </p>
                        <div className="mt-2">
                          <SourceCitationsBlock citations={m.citations} />
                        </div>
                      </div>
                    </li>
                  ))}
                  {isStreaming ? (
                    <li>
                      <div className="mr-4 rounded-xl border border-success/30 bg-card/60 px-3 py-2">
                        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                          <span
                            className="relative flex h-2 w-2"
                            aria-label="Streaming"
                          >
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/80 opacity-60" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                          </span>
                          AI
                        </span>
                        <p className="mt-1 whitespace-pre-wrap leading-relaxed text-muted-foreground">
                          {streamingText || "…"}
                        </p>
                        {liveCitations.length > 0 ? (
                          <div className="mt-2">
                            <SourceCitationsBlock citations={liveCitations} />
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
              onChange={(e) => setInput(e.target.value)}
              placeholder={`${mode}: type your message…`}
              className="min-h-[100px] bg-surface-inner focus-visible:ring-primary/20"
              disabled={isStreaming}
              aria-label="Message composer"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <Button
              variant="cta"
              disabled={isStreaming || !input.trim()}
              className="transition-transform duration-150 hover:scale-[1.02]"
              onClick={() => void send()}
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

        <div className="space-y-4">
          <PromptTemplatePanel
            templates={templateRows}
            isLoading={tplLoading}
            onApplyText={(t) => setInput((prev) => (prev ? `${prev}\n\n${t}` : t))}
          />

          <Card className="border-border/80 bg-card/90 shadow-card transition-transform duration-150 hover:-translate-y-0.5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Permitted actions</CardTitle>
              <p className="text-xs text-muted-foreground">
                Role-gated; sensitive flows require explicit confirmation and audit logging.
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {permittedActions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No actions for your role.</p>
              ) : (
                permittedActions.map((a) => (
                  <Button
                    key={a.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-auto min-h-11 w-full justify-start whitespace-normal py-2 text-left text-xs transition-transform duration-150 hover:scale-[1.01]"
                    onClick={() => setActionDialog(a)}
                  >
                    {a.label}
                    {a.requiresConfirmation ? (
                      <span className="ml-2 text-[10px] text-success">● confirm</span>
                    ) : null}
                  </Button>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/90">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Live context</CardTitle>
            </CardHeader>
            <CardContent className="text-xs leading-relaxed text-muted-foreground">
              Retrieval uses tenant{" "}
              <code className="text-primary">documents</code>,{" "}
              <code className="text-primary">unified_entities</code>, and{" "}
              <code className="text-primary">ai_context_chunks</code> for workspace{" "}
              <code className="text-primary">global</code>.
            </CardContent>
          </Card>
        </div>
      </div>

      <ActionConfirmDialog
        action={actionDialog}
        open={Boolean(actionDialog)}
        onOpenChange={(o) => {
          if (!o) setActionDialog(null);
        }}
        conversationId={conversationId ?? undefined}
        executeAction={async (p) => executeMutation.mutateAsync(p)}
        onSuccess={() => {
          void qc.invalidateQueries({ queryKey: aiQueryKeys.dashboardSummary() });
        }}
      />
    </AnimatedPage>
  );
}
