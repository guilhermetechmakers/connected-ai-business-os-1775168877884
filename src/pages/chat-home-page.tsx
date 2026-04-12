import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  WrenchIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { ChatArtifactCard } from "@/components/ai-chat/chat-artifact-card";
import { SourceCitationsBlock } from "@/components/ai-workspace/source-citations";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  aiQueryKeys,
  useAiActionPermissions,
  useAiConversationDetail,
  useAiConversationsList,
  useCreateAiConversation,
  useDeleteAiConversation,
  useExecuteAiAction,
  useUpdateAiConversation,
} from "@/hooks/use-ai";
import { saveCustomDashboard } from "@/api/dashboard";
import { useAuth } from "@/contexts/auth-context";
import { streamAiChat } from "@/lib/ai-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type {
  AiAgentToolCall,
  AiChatArtifact,
  AiChatMode,
  AiConversationExecutionMode,
  AiMessageRow,
  AiSourceCitation,
} from "@/types/ai";

const modes: AiChatMode[] = ["Ask", "Analyze", "Report", "Action"];

type PendingConfirmation = {
  id: string;
  actionId: string;
  label: string;
  preview?: Record<string, unknown>;
};

function normalizeMessages(rows: unknown): AiMessageRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter(
    (m): m is AiMessageRow =>
      Boolean(m && typeof m === "object" && "role" in m && "content" in m),
  );
}

function payloadFromPreview(
  preview?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!preview || typeof preview !== "object") return undefined;
  const rawArgs = (preview as { args?: unknown }).args;
  if (!rawArgs || typeof rawArgs !== "object" || Array.isArray(rawArgs))
    return undefined;
  return rawArgs as Record<string, unknown>;
}

function normalizeRoleNames(roles: string[] | null | undefined): string[] {
  const list = Array.isArray(roles) ? roles : [];
  return Array.from(
    new Set(
      list
        .map((role) => String(role).trim().toLowerCase())
        .filter((role) => role.length > 0),
    ),
  );
}

function customDashboardPayloadFromArtifact(artifact: AiChatArtifact): {
  title: string;
  description: string | null;
  codeTsx: string;
  queryPlan: Array<{ toolId: string; args?: Record<string, unknown>; provider?: string; label?: string }>;
  snapshotData: Record<string, unknown>;
  sources: string[];
} | null {
  if (artifact.type !== "custom_dashboard") return null;
  const payload =
    artifact.payload && typeof artifact.payload === "object" && !Array.isArray(artifact.payload)
      ? (artifact.payload as Record<string, unknown>)
      : {};
  const codeTsx = typeof payload.codeTsx === "string" && payload.codeTsx.trim().length > 0
    ? payload.codeTsx
    : "/* prebuilt-runtime */";
  const queryPlanRaw = Array.isArray(payload.queryPlan) ? payload.queryPlan : [];
  const queryPlan: Array<{ toolId: string; args?: Record<string, unknown>; provider?: string; label?: string }> = [];
  for (const step of queryPlanRaw) {
    if (!step || typeof step !== "object") continue;
    const row = step as Record<string, unknown>;
    if (typeof row.toolId !== "string" || row.toolId.length === 0) continue;
    const next: { toolId: string; args?: Record<string, unknown>; provider?: string; label?: string } = {
      toolId: row.toolId,
      args: row.args && typeof row.args === "object"
        ? (row.args as Record<string, unknown>)
        : {},
    };
    if (typeof row.provider === "string" && row.provider.length > 0) {
      next.provider = row.provider;
    }
    if (typeof row.label === "string" && row.label.length > 0) {
      next.label = row.label;
    }
    queryPlan.push(next);
  }
  const sourcesRaw = Array.isArray(payload.sources)
    ? payload.sources
    : Array.isArray(payload.integrationSources)
      ? payload.integrationSources
      : [];
  const sources = sourcesRaw
    .map((source) => (typeof source === "string" ? source.toLowerCase().trim() : null))
    .filter((source): source is string => Boolean(source));
  const snapshotData = payload.snapshotData && typeof payload.snapshotData === "object" && !Array.isArray(payload.snapshotData)
    ? (payload.snapshotData as Record<string, unknown>)
    : {};
  const description = typeof artifact.description === "string"
    ? artifact.description
    : typeof payload.description === "string"
      ? payload.description
      : null;

  return {
    title: artifact.title || "Custom dashboard",
    description,
    codeTsx,
    queryPlan,
    snapshotData,
    sources,
  };
}

function ThoughtStep({
  label,
  done = false,
}: {
  label: string;
  done?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      {done ? (
        <Check className="h-3.5 w-3.5 text-success" />
      ) : (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      )}
      <span
        className={cn(
          "transition-colors",
          done ? "text-foreground/70" : "text-foreground",
        )}
      >
        {label}
      </span>
    </div>
  );
}

export default function ChatHomePage() {
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { profile } = useAuth();

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [mode, setMode] = useState<AiChatMode>("Ask");
  const [executionMode, setExecutionMode] =
    useState<AiConversationExecutionMode>("confirm");
  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [liveCitations, setLiveCitations] = useState<AiSourceCitation[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [liveToolCalls, setLiveToolCalls] = useState<AiAgentToolCall[]>([]);
  const [liveArtifacts, setLiveArtifacts] = useState<AiChatArtifact[]>([]);
  const [pendingConfirmations, setPendingConfirmations] = useState<
    PendingConfirmation[]
  >([]);
  const [savingArtifactIds, setSavingArtifactIds] = useState<string[]>([]);
  const [savedArtifactIds, setSavedArtifactIds] = useState<string[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);

  const { data: convoList = [], isLoading: listLoading } =
    useAiConversationsList(20);
  const conversations = Array.isArray(convoList) ? convoList : [];
  const { data: detail, isLoading: detailLoading } =
    useAiConversationDetail(conversationId);
  const { data: permitted = [] } = useAiActionPermissions();

  const createConvo = useCreateAiConversation();
  const updateConvo = useUpdateAiConversation();
  const deleteConvo = useDeleteAiConversation();
  const executeMutation = useExecuteAiAction();

  const messages = useMemo(
    () => normalizeMessages(detail?.messages),
    [detail?.messages],
  );
  const permittedSet = useMemo(
    () =>
      new Set(
        (Array.isArray(permitted) ? permitted : []).map(
          (x) => x.id,
        ),
      ),
    [permitted],
  );

  const currentTitle = useMemo(() => {
    if (!conversationId) return "New AI chat";
    const found = conversations.find((c) => c.id === conversationId);
    return found?.title ?? found?.mode ?? "AI chat";
  }, [conversationId, conversations]);

  const enqueuePendingConfirmation = useCallback(
    (payload: {
      actionId: string;
      label: string;
      preview?: Record<string, unknown>;
    }) => {
      if (!payload.actionId || !permittedSet.has(payload.actionId)) return;
      setPendingConfirmations((prev) => [
        ...prev.filter((x) => x.actionId !== payload.actionId),
        {
          id: crypto.randomUUID(),
          actionId: payload.actionId,
          label: payload.label,
          preview: payload.preview,
        },
      ]);
    },
    [permittedSet],
  );

  useEffect(() => {
    if (!isSupabaseConfigured || conversationId) return;
    if (conversations.length > 0 && conversations[0]?.id) {
      setConversationId(conversations[0].id);
    }
  }, [conversations, conversationId]);

  useEffect(() => {
    const next = detail?.conversation?.mode;
    if (next && modes.includes(next as AiChatMode)) {
      setMode(next as AiChatMode);
    }
    const nextExec = detail?.conversation?.execution_mode;
    if (nextExec === "confirm" || nextExec === "auto") {
      setExecutionMode(nextExec);
    }
  }, [detail?.conversation?.mode, detail?.conversation?.execution_mode]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, streamingText, liveToolCalls.length]);

  const startNewChat = useCallback(() => {
    if (!isSupabaseConfigured) {
      toast.error("Configure Supabase to use AI chat.");
      return;
    }
    createConvo.mutate(
      { mode, executionMode, title: `${mode} session` },
      {
        onSuccess: (row) => {
          setConversationId(row.id);
          setStreamingText("");
          setLiveCitations([]);
          setLiveToolCalls([]);
          setLiveArtifacts([]);
          setPendingConfirmations([]);
          setSavingArtifactIds([]);
          setSavedArtifactIds([]);
          void qc.invalidateQueries({
            queryKey: aiQueryKeys.conversations(),
          });
          toast.success("New chat conversation");
        },
        onError: (e) =>
          toast.error(
            e instanceof Error ? e.message : "Could not create chat",
          ),
      },
    );
  }, [createConvo, executionMode, mode, qc]);

  const onModeChange = (next: AiChatMode) => {
    setMode(next);
    if (conversationId) {
      updateConvo.mutate({ conversationId, patch: { mode: next } });
    }
  };

  const onExecutionModeChange = (next: AiConversationExecutionMode) => {
    setExecutionMode(next);
    if (conversationId) {
      updateConvo.mutate({
        conversationId,
        patch: { executionMode: next },
      });
    }
  };

  const renameConversation = useCallback(
    async (target: { id: string; title: string | null; mode: string }) => {
      const suggested = target.title?.trim() || `${target.mode} chat`;
      const nextTitle = window.prompt("Rename conversation", suggested);
      if (nextTitle === null) return;
      const trimmedTitle = nextTitle.trim();
      if (!trimmedTitle) {
        toast.error("Conversation title cannot be empty.");
        return;
      }
      if (trimmedTitle === (target.title ?? "").trim()) return;
      try {
        await updateConvo.mutateAsync({
          conversationId: target.id,
          patch: { title: trimmedTitle },
        });
        toast.success("Conversation renamed.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not rename conversation",
        );
      }
    },
    [updateConvo],
  );

  const deleteConversation = useCallback(
    async (target: { id: string; title: string | null; mode: string }) => {
      const label = target.title?.trim() || `${target.mode} chat`;
      const approved = window.confirm(
        `Delete "${label}"? This will permanently remove all messages in this chat.`,
      );
      if (!approved) return;
      try {
        await deleteConvo.mutateAsync(target.id);
        if (conversationId === target.id) {
          const nextConversation = conversations.find((c) => c.id !== target.id);
          setConversationId(nextConversation?.id ?? null);
          setStreamingText("");
          setLiveCitations([]);
          setLiveToolCalls([]);
          setLiveArtifacts([]);
          setPendingConfirmations([]);
          setSavingArtifactIds([]);
          setSavedArtifactIds([]);
        }
        toast.success("Conversation deleted.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not delete conversation",
        );
      }
    },
    [conversationId, conversations, deleteConvo],
  );

  const executePendingConfirmation = async (pending: PendingConfirmation) => {
    if (!conversationId) return;
    const payload = payloadFromPreview(pending.preview);
    try {
      const out = await executeMutation.mutateAsync({
        actionId: pending.actionId,
        confirmed: true,
        conversationId,
        payload,
      });
      setPendingConfirmations((prev) =>
        prev.filter((x) => x.id !== pending.id),
      );
      const nextArtifacts = Array.isArray(out.artifacts) ? out.artifacts : [];
      if (nextArtifacts.length > 0) {
        setLiveArtifacts((prev) => [...prev, ...nextArtifacts]);
      }
      toast.success(`Executed ${pending.label}`);
      void qc.invalidateQueries({
        queryKey: aiQueryKeys.conversation(conversationId),
      });
      void qc.invalidateQueries({
        queryKey: aiQueryKeys.dashboardSummary(),
      });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not execute action",
      );
    }
  };

  const refreshArtifact = useCallback(
    (artifact: AiChatArtifact) => {
      if (!conversationId) return;
      void qc.invalidateQueries({
        queryKey: aiQueryKeys.conversation(conversationId),
      });
      void qc.invalidateQueries({
        queryKey: aiQueryKeys.dashboardSummary(),
      });
      toast.success(`${artifact.type.toUpperCase()} preview refreshed`);
    },
    [conversationId, qc],
  );

  const regeneratePdfArtifact = useCallback(
    async (artifact: AiChatArtifact) => {
      if (artifact.type !== "pdf") return;
      if (!artifact.reportId) {
        toast.error("Missing report id for PDF regeneration.");
        return;
      }
      if (!permittedSet.has("app.reports.export_pdf")) {
        toast.error(
          "You do not have permission to regenerate report PDFs.",
        );
        return;
      }

      try {
        const out = await executeMutation.mutateAsync({
          actionId: "app.reports.export_pdf",
          confirmed: executionMode === "auto",
          conversationId: conversationId ?? undefined,
          payload: {
            reportId: artifact.reportId,
            fileName: artifact.fileName,
          },
        });

        if (out.pendingConfirmation) {
          enqueuePendingConfirmation({
            actionId: "app.reports.export_pdf",
            label: "Reports: export PDF",
            preview: out.preview,
          });
          toast("PDF regeneration is pending confirmation.");
          return;
        }

        const nextArtifacts = Array.isArray(out.artifacts)
          ? out.artifacts
          : [];
        if (nextArtifacts.length > 0) {
          setLiveArtifacts((prev) => [...prev, ...nextArtifacts]);
        }

        if (conversationId) {
          void qc.invalidateQueries({
            queryKey: aiQueryKeys.conversation(conversationId),
          });
        }
        void qc.invalidateQueries({
          queryKey: aiQueryKeys.dashboardSummary(),
        });
        toast.success("PDF regenerated successfully.");
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not regenerate PDF",
        );
      }
    },
    [
      conversationId,
      enqueuePendingConfirmation,
      executionMode,
      executeMutation,
      permittedSet,
      qc,
    ],
  );

  const saveCustomDashboardArtifact = useCallback(
    async (artifact: AiChatArtifact) => {
      if (artifact.type !== "custom_dashboard") return;
      if (savedArtifactIds.includes(artifact.id)) {
        toast.success("This dashboard preview is already saved.");
        return;
      }

      const payload = customDashboardPayloadFromArtifact(artifact);
      if (!payload) {
        toast.error("Invalid custom dashboard artifact payload.");
        return;
      }

      const sharedRoles = normalizeRoleNames(profile?.roles);
      setSavingArtifactIds((prev) => [...prev, artifact.id]);
      try {
        const saved = await saveCustomDashboard({
          title: payload.title,
          description: payload.description,
          codeTsx: payload.codeTsx,
          queryPlan: payload.queryPlan,
          snapshotData: payload.snapshotData,
          sources: payload.sources,
          visibilityMode: "roles",
          sharedRoles,
        });
        if (!saved) {
          toast.error("Could not save custom dashboard.");
          return;
        }
        setSavedArtifactIds((prev) =>
          prev.includes(artifact.id) ? prev : [...prev, artifact.id]
        );
        toast.success("Custom dashboard saved.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save custom dashboard.");
      } finally {
        setSavingArtifactIds((prev) => prev.filter((id) => id !== artifact.id));
      }
    },
    [profile?.roles, savedArtifactIds],
  );

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
        const row = await createConvo.mutateAsync({
          mode,
          executionMode,
          title: `${mode} chat`,
        });
        cid = row.id;
        setConversationId(cid);
        void qc.invalidateQueries({
          queryKey: aiQueryKeys.conversations(),
        });
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not start conversation",
        );
        return;
      }
    }

    setInput("");
    setStreamingText("");
    setLiveCitations([]);
    setLiveToolCalls([]);
    setLiveArtifacts([]);
    setPendingConfirmations([]);
    setSavingArtifactIds([]);
    setSavedArtifactIds([]);
    setIsStreaming(true);

    const clientNowIso = new Date().toISOString();
    const clientTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const clientLocale = typeof navigator?.language === "string"
      ? navigator.language
      : undefined;

    await streamAiChat({
      conversationId: cid,
      userMessage: text,
      mode,
      executionMode,
      workspaceId: "global",
      clientNowIso,
      clientTimeZone,
      clientLocale,
      onCitations: (c) => setLiveCitations(Array.isArray(c) ? c : []),
      onChunk: (c) => setStreamingText((prev) => prev + c),
      onToolCall: (call) => {
        setLiveToolCalls((prev) => [
          ...prev.filter((t) => t.id !== call.id),
          { ...call, status: "running" },
        ]);
      },
      onToolResult: (result) => {
        setLiveToolCalls((prev) =>
          prev.map((t) =>
            t.id === result.id
              ? { ...t, preview: result.preview, status: "done" }
              : t,
          ),
        );
      },
      onPendingConfirmation: (pending) => {
        enqueuePendingConfirmation(pending);
      },
      onArtifact: (artifact) => {
        setLiveArtifacts((prev) => [...prev, artifact]);
      },
      onDone: () => {
        setIsStreaming(false);
        void qc
          .invalidateQueries({
            queryKey: aiQueryKeys.conversation(cid!),
          })
          .then(() => {
            setStreamingText("");
            setLiveCitations([]);
            setLiveToolCalls([]);
          });
        void qc.invalidateQueries({
          queryKey: aiQueryKeys.dashboardSummary(),
        });
      },
      onError: (msg) => {
        setIsStreaming(false);
        toast.error(msg);
      },
    });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden">
      {/* Conversation sidebar */}
      <aside
        className={cn(
          "flex h-full shrink-0 flex-col border-r border-border/60 bg-card/40 transition-[width,opacity] duration-200",
          showSidebar ? "w-64" : "w-0 opacity-0 overflow-hidden",
        )}
      >
        <div className="flex items-center justify-between border-b border-border/40 px-3 py-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Chats
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => startNewChat()}
            disabled={createConvo.isPending}
            aria-label="New chat"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-0.5 px-2 py-2">
            {listLoading ? (
              <div className="flex items-center gap-2 px-2 py-4 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading...
              </div>
            ) : conversations.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                No conversations yet
              </p>
            ) : (
              conversations.slice(0, 20).map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    "group flex items-center gap-1 rounded-lg pl-1 pr-0.5 text-sm transition-colors duration-150",
                    c.id === conversationId
                      ? "bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setConversationId(c.id);
                      setStreamingText("");
                      setLiveArtifacts([]);
                      setPendingConfirmations([]);
                      setSavingArtifactIds([]);
                      setSavedArtifactIds([]);
                    }}
                    className="min-w-0 flex-1 rounded-lg px-2 py-2 text-left"
                  >
                    <span className="line-clamp-1 font-medium">
                      {c.title ?? c.mode}
                    </span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                        aria-label={`Conversation actions for ${c.title ?? c.mode}`}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[180px]">
                      <DropdownMenuItem
                        onClick={() =>
                          void renameConversation({
                            id: c.id,
                            title: c.title,
                            mode: c.mode,
                          })
                        }
                        disabled={updateConvo.isPending || deleteConvo.isPending}
                      >
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Rename chat
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          void deleteConversation({
                            id: c.id,
                            title: c.title,
                            mode: c.mode,
                          })
                        }
                        className="text-destructive focus:text-destructive"
                        disabled={deleteConvo.isPending || updateConvo.isPending}
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Delete chat
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* Main chat area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Chat header */}
        <header className="flex items-center justify-between border-b border-border/40 px-4 py-2.5">
          <div className="flex items-center gap-3">
            {!showSidebar && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowSidebar(true)}
                aria-label="Show sidebar"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            {showSidebar && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowSidebar(false)}
                aria-label="Hide sidebar"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
            <h1 className="text-sm font-medium text-foreground">
              {currentTitle}
            </h1>
          </div>
        </header>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto scroll-smooth"
        >
          <div className="mx-auto max-w-3xl px-4 py-6">
            {detailLoading && conversationId ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading conversation...
              </div>
            ) : messages.length === 0 && !isStreaming ? (
              <div className="flex flex-col items-center justify-center py-24">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                  <Sparkles className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">
                  Start a conversation
                </h2>
                <p className="mt-2 max-w-sm text-center text-sm text-muted-foreground">
                  Ask anything, analyze data, generate reports, or automate
                  actions across your business.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    refreshArtifact={refreshArtifact}
                    regeneratePdfArtifact={regeneratePdfArtifact}
                    onSaveCustomDashboard={saveCustomDashboardArtifact}
                    savingArtifactIds={savingArtifactIds}
                    savedArtifactIds={savedArtifactIds}
                    busy={executeMutation.isPending}
                  />
                ))}

                {pendingConfirmations.length > 0 && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
                      <Eye className="h-3.5 w-3.5" />
                      Pending confirmations
                    </p>
                    <div className="space-y-2">
                      {pendingConfirmations.map((pending) => (
                        <div
                          key={pending.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-background/60 px-4 py-2.5"
                        >
                          <span className="text-sm text-foreground">
                            {pending.label}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            className="rounded-full bg-amber-500 px-4 text-xs font-medium text-black hover:bg-amber-400"
                            onClick={() =>
                              void executePendingConfirmation(pending)
                            }
                            disabled={executeMutation.isPending}
                          >
                            Confirm
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isStreaming && liveToolCalls.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <WrenchIcon className="h-3.5 w-3.5" />
                      <span>Agent working</span>
                    </div>
                    <div className="ml-1 space-y-1.5 border-l-2 border-border/50 pl-4">
                      {liveToolCalls.map((tc) => (
                        <ThoughtStep
                          key={tc.id}
                          label={tc.name.replace(/_/g, " ")}
                          done={tc.status === "done"}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {isStreaming && (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[10px] font-bold text-primary">
                        AI
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                          {streamingText || (
                            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Thinking...
                            </span>
                          )}
                        </p>
                        {liveCitations.length > 0 && (
                          <div className="mt-3">
                            <SourceCitationsBlock
                              citations={liveCitations}
                            />
                          </div>
                        )}
                        {liveArtifacts.length > 0 && (
                          <div className="mt-4 grid gap-2">
                            {liveArtifacts.map((artifact, index) => (
                              <ChatArtifactCard
                                key={`${artifact.id}-${index}`}
                                artifact={artifact}
                                onRefresh={refreshArtifact}
                                onRegenerate={regeneratePdfArtifact}
                                onSave={saveCustomDashboardArtifact}
                                busy={
                                  executeMutation.isPending ||
                                  savingArtifactIds.includes(artifact.id) ||
                                  savedArtifactIds.includes(artifact.id)
                                }
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-border/30 bg-background/80 px-4 pb-4 pt-3 backdrop-blur-sm">
          <div className="mx-auto max-w-3xl">
            {/* Input area */}
            <div className="relative rounded-xl border border-border/50 bg-card/80 shadow-sm transition-shadow duration-200 focus-within:border-border/80 focus-within:shadow-md">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask AI anything"
                className="block w-full resize-none bg-transparent px-4 pb-12 pt-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                disabled={isStreaming || listLoading}
                aria-label="Message composer"
                rows={1}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              {/* Bottom bar inside input */}
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {/* Mode dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/20 px-2.5 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:border-border/60 hover:text-foreground focus:outline-none"
                      >
                        <Sparkles className="h-3 w-3 text-primary" />
                        {mode}
                        <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" side="top" className="min-w-[140px]">
                      <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        Mode
                      </DropdownMenuLabel>
                      {modes.map((m) => (
                        <DropdownMenuItem
                          key={m}
                          onClick={() => onModeChange(m)}
                          className={cn(
                            "gap-2 text-xs",
                            mode === m && "bg-primary/10 text-primary",
                          )}
                        >
                          {mode === m && <Check className="h-3 w-3" />}
                          {mode !== m && <span className="w-3" />}
                          {m}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Execution mode dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/20 px-2.5 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:border-border/60 hover:text-foreground focus:outline-none"
                      >
                        {executionMode === "confirm" ? "Confirm writes" : "Auto writes"}
                        <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" side="top" className="min-w-[160px]">
                      <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        Execution
                      </DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() => onExecutionModeChange("confirm")}
                        className={cn(
                          "gap-2 text-xs",
                          executionMode === "confirm" && "bg-primary/10 text-primary",
                        )}
                      >
                        {executionMode === "confirm" && <Check className="h-3 w-3" />}
                        {executionMode !== "confirm" && <span className="w-3" />}
                        Confirm writes
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onExecutionModeChange("auto")}
                        className={cn(
                          "gap-2 text-xs",
                          executionMode === "auto" && "bg-primary/10 text-primary",
                        )}
                      >
                        {executionMode === "auto" && <Check className="h-3 w-3" />}
                        {executionMode !== "auto" && <span className="w-3" />}
                        Auto writes
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Button
                  type="button"
                  disabled={isStreaming || !input.trim()}
                  onClick={() => void send()}
                  className={cn(
                    "h-8 w-8 rounded-full p-0 transition-all duration-150",
                    input.trim()
                      ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                      : "bg-muted/40 text-muted-foreground",
                  )}
                  aria-label="Send message"
                >
                  {isStreaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <p className="mt-2 text-center text-[10px] text-muted-foreground/50">
              AI may produce inaccurate information. Please use with
              discretion.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  refreshArtifact,
  regeneratePdfArtifact,
  onSaveCustomDashboard,
  savingArtifactIds,
  savedArtifactIds,
  busy,
}: {
  message: AiMessageRow;
  refreshArtifact: (artifact: AiChatArtifact) => void;
  regeneratePdfArtifact: (artifact: AiChatArtifact) => void;
  onSaveCustomDashboard: (artifact: AiChatArtifact) => void;
  savingArtifactIds: string[];
  savedArtifactIds: string[];
  busy: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex items-start gap-3", isUser && "justify-end")}>
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[10px] font-bold text-primary">
          AI
        </div>
      )}
      <div
        className={cn(
          "min-w-0 max-w-[85%]",
          isUser && "order-first",
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-3",
            isUser
              ? "bg-primary/10 text-foreground"
              : "text-foreground",
          )}
        >
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {message.content}
          </p>
        </div>
        {!isUser && (
          <>
            {message.citations && (
              <div className="mt-2">
                <SourceCitationsBlock citations={message.citations} />
              </div>
            )}
            {Array.isArray(message.artifacts) &&
              message.artifacts.length > 0 && (
                <div className="mt-3 grid gap-2">
                  {message.artifacts.map((artifact, index) => (
                    <ChatArtifactCard
                      key={`${artifact.id}-${index}`}
                      artifact={artifact}
                      onRefresh={refreshArtifact}
                      onRegenerate={regeneratePdfArtifact}
                      onSave={onSaveCustomDashboard}
                      busy={busy || savingArtifactIds.includes(artifact.id) || savedArtifactIds.includes(artifact.id)}
                    />
                  ))}
                </div>
              )}
          </>
        )}
      </div>
      {isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted/50 text-[10px] font-semibold text-foreground">
          U
        </div>
      )}
    </div>
  );
}
