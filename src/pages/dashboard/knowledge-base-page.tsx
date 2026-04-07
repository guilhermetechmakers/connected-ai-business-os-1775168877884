import { Link } from "react-router-dom";
import { ArrowUpRight, Database } from "lucide-react";

import { KnowledgeBasePanel } from "@/components/ai-workspace";
import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function KnowledgeBasePage() {
  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="Knowledge base"
        description="Manage tenant documents for vector retrieval: upload files, apply visibility controls, monitor indexing status, and reindex or remove documents."
        actions={
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to="/dashboard/ai" className="gap-1">
              Open AI workspace
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        }
      />

      <Card className="border-border/70 bg-surface-inner/35">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-display">
            <Database className="h-4 w-4 text-primary" aria-hidden />
            Vectorized tenant context
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Uploaded files are retained, extracted into chunks, and indexed for semantic retrieval with tenant-scoped access controls.
        </CardContent>
      </Card>

      <KnowledgeBasePanel />
    </AnimatedPage>
  );
}
