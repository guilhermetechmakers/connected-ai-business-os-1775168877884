import { DashboardFrameworkShell } from "@/components/dashboard/dashboard-framework-shell";

export default function ExecutiveDashboardPage() {
  return (
    <DashboardFrameworkShell
      kind="executive"
      title="Executive dashboard"
      description="Top-line KPIs, risk scoreboard, AI executive brief, and cross-department heatmap. Widgets respect role visibility from the registry; generate briefs via ai-api with your selected timeframe."
    />
  );
}
