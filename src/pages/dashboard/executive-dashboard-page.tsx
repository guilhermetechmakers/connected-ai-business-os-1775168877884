import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const risk = [
  { name: "On track", value: 62, color: "rgb(0,210,122)" },
  { name: "Watch", value: 24, color: "rgb(154,208,255)" },
  { name: "At risk", value: 14, color: "rgb(220,80,80)" },
];

const heat = [
  { dept: "Revenue", score: 88 },
  { dept: "Product", score: 72 },
  { dept: "Operations", score: 64 },
  { dept: "Finance", score: 91 },
];

export default function ExecutiveDashboardPage() {
  return (
    <AnimatedPage className="space-y-10">
      <PageHeader
        title="Executive dashboard"
        description="Top-line KPIs, risk scoreboard, AI executive brief, and cross-department heatmap."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border/80 bg-card/90 shadow-card lg:col-span-2">
          <CardHeader>
            <CardTitle>AI executive brief</CardTitle>
            <p className="text-sm text-muted-foreground">
              Generated from tenant-grounded RAG with citations (simulated copy).
            </p>
          </CardHeader>
          <CardContent className="prose prose-invert max-w-none text-sm prose-p:text-muted-foreground">
            <p>
              Revenue teams beat pipeline coverage targets while Product reduced
              cycle time on two strategic initiatives. Operations flagged three
              integration drift warnings — recommend approving the QuickBooks
              remap workflow.
            </p>
            <ul>
              <li>Cash collection improved 4.2% WoW</li>
              <li>Customer health score stable at 81</li>
              <li>Two AI-proposed actions await VP approval</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/90 shadow-card">
          <CardHeader>
            <CardTitle>Risk scoreboard</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={risk}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                >
                  {risk.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "rgb(15,23,32)",
                    border: "1px solid rgb(17,32,43)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 bg-card/90 shadow-card">
        <CardHeader>
          <CardTitle>Cross-department heatmap</CardTitle>
          <p className="text-sm text-muted-foreground">
            Composite health scores normalized across integrations and KPIs.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {heat.map((h) => (
            <div key={h.dept} className="space-y-2 rounded-lg bg-surface-inner p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{h.dept}</span>
                <span className="text-primary">{h.score}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-secondary to-primary"
                  style={{ width: `${h.score}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </AnimatedPage>
  );
}
