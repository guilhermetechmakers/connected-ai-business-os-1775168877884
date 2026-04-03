import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { DashboardFrameworkShell } from "@/components/dashboard/dashboard-framework-shell";
import { Button } from "@/components/ui/button";

export default function GlobalDashboardPage() {
  return (
    <DashboardFrameworkShell
      kind="global"
      title="Global dashboard"
      description="Aggregated KPIs, alerts, and quick actions across connected systems — scoped to your tenant and role. Drag widgets while editing; changes debounce-save to your layout."
      headerActions={
        <>
          <Button variant="outline" asChild>
            <Link to="/reports">Export report</Link>
          </Button>
          <Button variant="cta" asChild>
            <Link to="/dashboard/ai">
              <Sparkles className="h-4 w-4" />
              Ask AI
            </Link>
          </Button>
        </>
      }
    />
  );
}
