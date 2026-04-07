import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { ActionConfirmDialog } from "@/components/ai-workspace/action-confirm-dialog";
import {
  ActionDrawer,
  ContextPanel,
  ConversationPanel,
  HistoryPanel,
  KpiBar,
  PromptTemplateEditor,
  PromptTemplatePanel,
} from "@/components/ai-workspace";
import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
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
import type { AiAgentToolCall, AiChatMode, AiMessageRow, AiPermittedAction, AiSourceCitation } from "@/types/ai";

const modes: AiChatMode[] = ["Ask", "Analyze", "Report", "Action"];

function normalizeMessages(rows: unknown): AiMessageRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter((m): m is AiMessageRow =>
    Boolean(m && typeof m === "object" && "role" in m && "content" in m),
  );
}

function canEditPromptTemplates(roles: string[]): boolean {
  const r = roles.map((x) => String(x).toLowerCase());
  return ["admin", "manager", "owner", "company admin", "executive"].some((k) =>
    r.some((ur) => ur.includes(k) || k.includes(ur)),
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
  const [liveToolCalls, setLiveToolCalls] = useState<AiAgentToolCall[]>([]);
  const [actionDialog, setActionDialog] = useState<AiPermittedAction | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [suggestedIds, setSuggestedIds] = useState<string[]>([]);

  const { data: convoList = [], isLoading: listLoading } = useAiConversationsList(20);
  const conversations = Array.isArray(convoList) ? convoList : [];
  const { data: detail, isLoading: detailLoading } = useAiConversationDetail(conversationId);
  const { data: templates = [], isLoading: tplLoading } = usePromptTemplates(mode);
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

  const citationCount = useMemo(() => {
    if (isStreaming && liveCitations.length > 0) return liveCitations.length;
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    const cites = last?.citations;
    return Array.isArray(cites) ? cites.length : 0;
  }, [isStreaming, liveCitations.length, messages]);

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
          setSuggestedIds([]);
          void qc.invalidateQueries({ queryKey: aiQueryKeys.conversations() });
          toast.success("New conversation");
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create chat"),
      },
    );
  }, [createConvo, mode, qc]);

  const onModeChange = (next: AiChatMode) => {
    setMode(next);
    setSuggestedIds([]);
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
    setLiveToolCalls([]);
    setSuggestedIds([]);
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
      onToolCall: (call) => {
        setLiveToolCalls((prev) => [
          ...prev.filter((t) => t.id !== call.id),
          { ...call, status: "running" },
        ]);
      },
      onToolResult: (result) => {
        setLiveToolCalls((prev) =>
          prev.map((t) =>
            t.id === result.id ? { ...t, preview: result.preview, status: "done" } : t,
          ),
        );
      },
      onSuggestedActions: (actionIds) => {
        setSuggestedIds(Array.isArray(actionIds) ? actionIds : []);
      },
      onDone: () => {
        setIsStreaming(false);
        void qc
          .invalidateQueries({ queryKey: aiQueryKeys.conversation(cid!) })
          .then(() => {
            setStreamingText("");
            setLiveCitations([]);
            setLiveToolCalls([]);
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

  const canEdit = canEditPromptTemplates(roles);

  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="AI workspace"
        description="Ask, analyze, report, and gated actions — streaming responses, RAG context, citations, and audited execution."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ActionDrawer
              open={drawerOpen}
              onOpenChange={setDrawerOpen}
              suggestedIds={suggestedIds}
              permittedActions={permittedActions}
              onPickAction={(a) => setActionDialog(a)}
            />
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
          </div>
        }
      />

      <KpiBar
        mode={mode}
        messageCount={messages.length}
        citationCount={citationCount}
        isLive={isStreaming}
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
        <ConversationPanel
          mode={mode}
          onModeChange={onModeChange}
          conversations={conversations}
          conversationId={conversationId}
          onSelectConversation={(id) => {
            setConversationId(id);
            setStreamingText("");
            setSuggestedIds([]);
          }}
          listLoading={listLoading}
          detailLoading={detailLoading}
          messages={messages}
          isStreaming={isStreaming}
          streamingText={streamingText}
          liveCitations={liveCitations}
          liveToolCalls={liveToolCalls}
          input={input}
          onInputChange={setInput}
          onSend={send}
        />

        <div className="space-y-4">
          <PromptTemplatePanel
            templates={templateRows}
            isLoading={tplLoading}
            workspaceMode={mode}
            onApplyText={(t) => setInput((prev) => (prev ? `${prev}\n\n${t}` : t))}
          />

          <PromptTemplateEditor mode={mode} templates={templateRows} canEdit={canEdit} />

          <HistoryPanel
            conversations={conversations}
            activeConversationId={conversationId}
            onSelectConversation={(id) => {
              setConversationId(id);
              setStreamingText("");
              setSuggestedIds([]);
            }}
            messages={messages}
          />

          <ContextPanel />

          <div className="rounded-xl border border-border/60 bg-surface-inner/40 p-4 text-xs leading-relaxed text-muted-foreground">
            <p className="font-semibold text-foreground/90">RAG coverage</p>
            <p className="mt-1">
              Retrieval uses tenant <code className="text-primary">documents</code>,{" "}
              <code className="text-primary">indexed_documents</code>,{" "}
              <code className="text-primary">unified_entities</code>, and{" "}
              <code className="text-primary">ai_context_chunks</code> for workspace{" "}
              <code className="text-primary">global</code>.
            </p>
          </div>
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
