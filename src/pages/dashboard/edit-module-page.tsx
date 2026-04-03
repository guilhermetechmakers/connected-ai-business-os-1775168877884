import { Link, useParams } from "react-router-dom";

import { EditModulePanel } from "@/components/modules/edit-module-panel";
import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

export default function EditModulePage() {
  const { moduleId } = useParams();

  if (!moduleId) {
    return (
      <AnimatedPage className="space-y-8">
        <PageHeader title="Manage module" description="Missing module id." />
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="Manage module"
        description="Version history, rollback, department assignment, permissions, deploy, and audit."
        actions={
          <Button variant="outline" asChild>
            <Link to="/dashboard/modules">Back to hub</Link>
          </Button>
        }
      />
      <EditModulePanel moduleId={moduleId} />
    </AnimatedPage>
  );
}
