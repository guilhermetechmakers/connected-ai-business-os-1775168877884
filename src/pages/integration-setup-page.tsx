import { CheckCircle2, RefreshCw, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { AnimatedPage } from "@/components/animated-page";
import { PublicChrome } from "@/components/layout/public-chrome";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const catalog = [
  { name: "HubSpot", detail: "CRM & marketing", status: "healthy" },
  { name: "QuickBooks", detail: "Finance ledger", status: "syncing" },
  { name: "Slack", detail: "Collaboration", status: "disconnected" },
  { name: "Google Workspace", detail: "Calendar & Drive", status: "healthy" },
];

export default function IntegrationSetupPage() {
  return (
    <PublicChrome>
      <AnimatedPage className="px-6 py-16 lg:px-24">
        <div className="mx-auto max-w-5xl space-y-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                Onboarding
              </p>
              <h1 className="mt-2 font-display text-4xl font-bold">
                Connect integrations
              </h1>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                OAuth and API-key connectors with mapping wizard, manual sync, and
                health indicators. Credentials stay encrypted per tenant.
              </p>
            </div>
            <Button variant="cta" asChild>
              <Link to="/dashboard">Go to dashboard</Link>
            </Button>
          </div>

          <Card className="border-border/80 bg-card/90 shadow-card">
            <CardHeader>
              <CardTitle>Mapping wizard</CardTitle>
              <CardDescription>
                Map canonical entities (Lead, Deal, Project) to provider fields.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span>Progress</span>
                <span className="text-muted-foreground">Step 2 of 4</span>
              </div>
              <Progress value={50} />
              <div className="grid gap-3 md:grid-cols-3">
                {["Entities", "Field map", "Test sync"].map((step, i) => (
                  <div
                    key={step}
                    className="rounded-lg border border-border/60 bg-surface-inner px-4 py-3 text-sm"
                  >
                    <p className="font-medium text-foreground">{step}</p>
                    <p className="text-xs text-muted-foreground">
                      {i === 0 ? "Complete" : i === 1 ? "In progress" : "Queued"}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => toast.message("Test sync started (simulated)")}
              >
                <RefreshCw className="h-4 w-4" />
                Test & sync
              </Button>
              <Button type="button" variant="ghost">
                Open mapping JSON
              </Button>
            </CardFooter>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            {catalog.map((item) => (
              <Card
                key={item.name}
                className="border-border/80 bg-card/80 shadow-card transition-all duration-150 hover:-translate-y-1 hover:shadow-card-hover"
              >
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle className="text-lg">{item.name}</CardTitle>
                    <CardDescription>{item.detail}</CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      item.status === "healthy"
                        ? "border-success/40 text-success"
                        : item.status === "syncing"
                          ? "border-primary/40 text-primary"
                          : "text-muted-foreground"
                    }
                  >
                    {item.status}
                  </Badge>
                </CardHeader>
                <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="h-4 w-4 text-primary" />
                  Tenant-scoped credentials · audited connects
                </CardContent>
                <CardFooter>
                  <Button className="w-full" variant="outline">
                    Connect
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/10 p-4 text-sm text-foreground">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
            <div>
              <p className="font-semibold">Health checks</p>
              <p className="text-muted-foreground">
                Each connector reports rate limits, schema drift, and last sync in
                the Activity log with redaction rules applied.
              </p>
            </div>
          </div>
        </div>
      </AnimatedPage>
    </PublicChrome>
  );
}
