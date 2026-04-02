import { useParams } from "react-router-dom";

import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function EditModulePage() {
  const { moduleId } = useParams();

  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="Manage module"
        description="Version diff, configuration, assign/uninstall controls."
        actions={
          <>
            <Button variant="destructive" size="sm">
              Uninstall
            </Button>
            <Button variant="cta" size="sm">
              Save changes
            </Button>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/80 bg-card/90">
          <CardHeader>
            <CardTitle>Version diff</CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-xs text-muted-foreground">
            <p>moduleId: {moduleId}</p>
            <Separator className="my-4" />
            <pre className="overflow-x-auto rounded-lg bg-surface-inner p-3">
              {`@@ manifest\n- version: 1.3.0\n+ version: 1.4.0\n+ binding: unified_entities.deal`}
            </pre>
          </CardContent>
        </Card>
        <Card className="border-border/80 bg-card/90">
          <CardHeader>
            <CardTitle>Assignments</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Map roles to module capabilities. Changes emit audit events to Activity log.
          </CardContent>
        </Card>
      </div>
    </AnimatedPage>
  );
}
