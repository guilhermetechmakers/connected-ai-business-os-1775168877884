import { Play, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const runs = [
  { id: "run_9821", status: "success", at: "2m ago" },
  { id: "run_9820", status: "awaiting approval", at: "18m ago" },
  { id: "run_9819", status: "failed", at: "1h ago" },
];

export default function WorkflowsPage() {
  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="Workflows & automations"
        description="Visual builder with triggers, conditions, actions, approvals, retries, and execution logs."
        actions={
          <Button variant="cta" onClick={() => toast.message("Canvas opened (UI stub)")}>
            New workflow
          </Button>
        }
      />

      <Tabs defaultValue="canvas" className="space-y-6">
        <TabsList className="bg-surface-inner">
          <TabsTrigger value="canvas">Canvas</TabsTrigger>
          <TabsTrigger value="library">Library</TabsTrigger>
          <TabsTrigger value="runs">Execution log</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
        </TabsList>
        <TabsContent value="canvas">
          <Card className="border-border/80 bg-card/90 shadow-card">
            <CardHeader>
              <CardTitle>Visual canvas</CardTitle>
            </CardHeader>
            <CardContent className="grid-bg flex min-h-[320px] items-center justify-center rounded-lg border border-dashed border-border/60 text-sm text-muted-foreground">
              Drag triggers → conditions → actions. Persisted definitions map to{" "}
              <code className="mx-1 rounded bg-surface-inner px-1">workflows.definition</code>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="library">
          <div className="grid gap-4 md:grid-cols-2">
            {["Lead nurture", "Invoice chase", "Project status digest"].map((w) => (
              <Card key={w} className="border-border/80 bg-surface-inner/80">
                <CardHeader>
                  <CardTitle className="text-base">{w}</CardTitle>
                </CardHeader>
                <CardContent className="flex gap-2">
                  <Button size="sm" variant="outline">
                    Duplicate
                  </Button>
                  <Button size="sm" variant="ghost">
                    View JSON
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="runs">
          <Card className="border-border/80 bg-card/90">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent runs</CardTitle>
              <Button size="sm" variant="outline">
                <Play className="h-4 w-4" />
                Run now
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-56 pr-3">
                <ul className="space-y-3 text-sm">
                  {runs.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between rounded-lg border border-border/60 bg-surface-inner px-3 py-2"
                    >
                      <span className="font-mono text-xs text-primary">{r.id}</span>
                      <span className="text-muted-foreground">{r.status}</span>
                      <span className="text-xs text-muted-foreground">{r.at}</span>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="approvals">
          <Card className="border-border/80 bg-card/90">
            <CardHeader>
              <CardTitle>Human approvals</CardTitle>
            </CardHeader>
            <CardContent className="flex items-start gap-3 text-sm text-muted-foreground">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Sensitive actions require role checks plus explicit approval steps before
              connectors execute.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AnimatedPage>
  );
}
