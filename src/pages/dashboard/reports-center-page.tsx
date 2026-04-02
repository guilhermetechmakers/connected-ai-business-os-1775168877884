import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const data = [
  { name: "W1", delivered: 24 },
  { name: "W2", delivered: 31 },
  { name: "W3", delivered: 28 },
  { name: "W4", delivered: 36 },
];

export default function ReportsCenterPage() {
  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="Reports center"
        description="Create, view, schedule, and export reports with AI summaries."
        actions={
          <Button variant="cta" type="button">
            New report
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border/80 bg-card/90 lg:col-span-2">
          <CardHeader>
            <CardTitle>Weekly throughput</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <XAxis dataKey="name" stroke="rgb(143,160,176)" />
                <YAxis stroke="rgb(143,160,176)" />
                <Tooltip
                  contentStyle={{
                    background: "rgb(15,23,32)",
                    border: "1px solid rgb(17,32,43)",
                  }}
                />
                <Bar dataKey="delivered" fill="rgb(154,208,255)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="border-border/80 bg-card/90">
          <CardHeader>
            <CardTitle>AI summary</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-invert text-sm prose-p:text-muted-foreground">
            <p>
              Delivery cadence improved week-over-week with fewer blocked items in
              Operations. Recommend sharing the digest with executives every Monday.
            </p>
          </CardContent>
        </Card>
      </div>
    </AnimatedPage>
  );
}
