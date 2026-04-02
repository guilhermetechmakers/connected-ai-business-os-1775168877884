import { useState } from "react";
import { toast } from "sonner";

import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import { edgeApi } from "@/api/edge";
import { isSupabaseConfigured } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Textarea } from "@/components/ui/textarea";

const modes = ["Ask", "Analyze", "Report", "Action"] as const;

export default function AIWorkspacePage() {
  const [mode, setMode] = useState<(typeof modes)[number]>("Ask");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; text: string }[]
  >([
    {
      role: "assistant",
      text: "I am scoped to your tenant. Ask for summaries, reports, or propose actions — sensitive steps require approval.",
    },
  ]);
  const [pending, setPending] = useState(false);

  const send = async () => {
    if (!input.trim()) return;
    const next = [...messages, { role: "user" as const, text: input.trim() }];
    setMessages(next);
    setInput("");
    if (!isSupabaseConfigured) {
      setMessages([
        ...next,
        {
          role: "assistant",
          text: "Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then deploy the llm-proxy Edge Function with OPENAI_API_KEY to enable live responses.",
        },
      ]);
      return;
    }
    setPending(true);
    try {
      const data = await edgeApi.invoke<{
        choices?: { message?: { content?: string } }[];
      }>("llm-proxy", {
        messages: next.map((m) => ({
          role: m.role,
          content: m.text,
        })),
      });
      const text =
        data.choices?.[0]?.message?.content ?? "No content returned from model.";
      setMessages([...next, { role: "assistant", text }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "LLM request failed");
      setMessages([
        ...next,
        {
          role: "assistant",
          text: "Request failed. Verify session, Edge Function deploy, and provider key.",
        },
      ]);
    } finally {
      setPending(false);
    }
  };

  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="AI workspace"
        description="Chat, mode selector, sources panel, action drawer with permission checks, and audited history."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border/80 bg-card/90 lg:col-span-2">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Conversation</CardTitle>
            <ToggleGroup
              type="single"
              value={mode}
              onValueChange={(v) => {
                if (v) setMode(v as (typeof modes)[number]);
              }}
              className="justify-end bg-surface-inner p-1 rounded-lg"
            >
              {modes.map((m) => (
                <ToggleGroupItem key={m} value={m} className="text-xs px-3">
                  {m}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScrollArea className="h-72 rounded-lg border border-border/60 bg-surface-inner/80 p-4">
              <ul className="space-y-4 text-sm">
                {messages.map((m, i) => (
                  <li
                    key={`${i}-${m.text.slice(0, 12)}`}
                    className={
                      m.role === "user" ? "text-foreground" : "text-muted-foreground"
                    }
                  >
                    <span className="font-semibold text-primary">
                      {m.role === "user" ? "You" : "AI"}
                    </span>
                    <p className="mt-1 leading-relaxed">{m.text}</p>
                  </li>
                ))}
              </ul>
            </ScrollArea>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`${mode}: type your prompt…`}
              className="min-h-[100px] bg-surface-inner"
            />
            <Button variant="cta" disabled={pending} onClick={() => void send()}>
              {pending ? "Sending…" : "Send"}
            </Button>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card className="border-border/80 bg-card/90">
            <CardHeader>
              <CardTitle className="text-base">Sources</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Citations from <code className="text-primary">documents</code> and{" "}
              <code className="text-primary">unified_entities</code> appear here after
              retrieval.
            </CardContent>
          </Card>
          <Card className="border-border/80 bg-card/90">
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Pending approvals: advance deal, send Slack digest.</p>
              <Button size="sm" variant="outline" className="w-full">
                Review permissions
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AnimatedPage>
  );
}
