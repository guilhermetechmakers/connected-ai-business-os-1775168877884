import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const sections = [
  "Company",
  "Users & roles",
  "Integrations",
  "AI",
  "Branding",
  "Data policies",
  "Feature flags",
] as const;

export default function SettingsPage() {
  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="Settings"
        description="Tenant and user governance: company profile, access, AI policies, branding, and flags."
      />
      <Tabs defaultValue="Company" className="space-y-6">
        <TabsList className="flex flex-wrap bg-surface-inner">
          {sections.map((s) => (
            <TabsTrigger key={s} value={s} className="text-xs">
              {s}
            </TabsTrigger>
          ))}
        </TabsList>
        {sections.map((s) => (
          <TabsContent key={s} value={s}>
            <Card className="border-border/80 bg-card/90">
              <CardHeader>
                <CardTitle>{s}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <p>
                  Configure {s.toLowerCase()} with Zod-validated forms backed by
                  Supabase and Edge Functions for secrets.
                </p>
                <div className="flex items-center justify-between rounded-lg border border-border/60 bg-surface-inner px-4 py-3">
                  <div>
                    <Label htmlFor="demo-flag">Demo toggle</Label>
                    <p className="text-xs text-muted-foreground">
                      Example feature flag wiring
                    </p>
                  </div>
                  <Switch id="demo-flag" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </AnimatedPage>
  );
}
