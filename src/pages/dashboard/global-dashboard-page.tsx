import { ArrowUpRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const trend = [
  { name: "Mon", value: 32 },
  { name: "Tue", value: 40 },
  { name: "Wed", value: 38 },
  { name: "Thu", value: 52 },
  { name: "Fri", value: 61 },
  { name: "Sat", value: 48 },
  { name: "Sun", value: 55 },
];

const kpis = [
  { label: "Active workflows", value: "128", delta: "+12%" },
  { label: "Integration health", value: "98.4%", delta: "+0.6%" },
  { label: "AI actions / day", value: "1.4k", delta: "+8%" },
  { label: "Open approvals", value: "7", delta: "-3" },
];

export default function GlobalDashboardPage() {
  return (
    <AnimatedPage className="space-y-10">
      <PageHeader
        title="Global dashboard"
        description="Aggregated KPIs, alerts, and quick actions across connected systems — scoped to your tenant and role."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/dashboard/reports">Export report</Link>
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Card
            key={k.label}
            className="border-border/80 bg-card/90 shadow-card transition-all duration-150 hover:-translate-y-1 hover:shadow-card-hover"
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {k.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <span className="font-display text-3xl font-bold text-foreground">
                {k.value}
              </span>
              <span className="text-xs font-semibold text-success">{k.delta}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border/80 bg-card/90 shadow-card lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Cross-system throughput</CardTitle>
              <p className="text-sm text-muted-foreground">
                Normalized events ingested into the unified layer
              </p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard/activity">
                Activity
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="rgb(154,208,255)" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="rgb(154,208,255)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" stroke="rgb(143,160,176)" tickLine={false} />
                <YAxis stroke="rgb(143,160,176)" tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "rgb(15,23,32)",
                    border: "1px solid rgb(17,32,43)",
                    borderRadius: 8,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="rgb(154,208,255)"
                  fill="url(#fill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/90 shadow-card">
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Run integration sync", to: "/onboarding/integrations" },
              { label: "Create workflow", to: "/dashboard/workflows" },
              { label: "Install module", to: "/dashboard/modules" },
            ].map((a) => (
              <Button
                key={a.label}
                variant="outline"
                className="w-full justify-between"
                asChild
              >
                <Link to={a.to}>
                  {a.label}
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </AnimatedPage>
  );
}
