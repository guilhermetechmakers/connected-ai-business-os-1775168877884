import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const tenants = [
  { name: "Acme Co", plan: "Scale", health: "green" },
  { name: "Northline", plan: "Enterprise", health: "green" },
  { name: "Meridian", plan: "Growth", health: "amber" },
];

export default function AdminConsolePage() {
  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="Admin console"
        description="Platform operations: tenants, logs, feature flags, and template management."
        actions={
          <Button variant="cta" size="sm" type="button">
            Provision tenant
          </Button>
        }
      />
      <Card className="border-border/80 bg-card/90">
        <CardHeader>
          <CardTitle>Tenants</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border/60 hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Health</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((t) => (
                <TableRow key={t.name} className="border-border/60">
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{t.plan}</TableCell>
                  <TableCell className="capitalize text-primary">{t.health}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost">
                      Impersonate
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AnimatedPage>
  );
}
