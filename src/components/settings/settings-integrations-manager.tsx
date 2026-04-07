import { Link } from "react-router-dom";

import { IntegrationConnectionSetup } from "@/components/integrations/onboarding/integration-connection-setup";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SettingsIntegrationsManager() {
  return (
    <div className="space-y-6">
      <Card className="border-border/80 bg-card/90">
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>
            Real OAuth connections, sync controls, mapping, and connector health all run through the
            shared integrations runtime used by AI Chat and Workflows.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/onboarding/integrations">Open Full Integrations Onboarding</Link>
          </Button>
        </CardContent>
      </Card>

      <IntegrationConnectionSetup showBreadcrumbs={false} />
    </div>
  );
}
