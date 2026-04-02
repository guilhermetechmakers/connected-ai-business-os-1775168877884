import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const rows = [
  {
    at: "10:02",
    type: "integration.sync",
    actor: "svc_quickbooks",
    detail: "Synced 128 invoices",
  },
  {
    at: "09:41",
    type: "ai.action",
    actor: "jane@acme.com",
    detail: "Proposed deal stage change",
  },
  {
    at: "09:12",
    type: "workflow.run",
    actor: "workflow_12",
    detail: "Completed with approvals",
  },
];

export default function ActivityLogPage() {
  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="Activity log"
        description="Tenant-scoped audit stream with filters, detail modal, and export."
        actions={
          <Button variant="cta" size="sm" type="button">
            Export CSV
          </Button>
        }
      />
      <div className="overflow-hidden rounded-xl border border-border/80 bg-card/90">
        <Table>
          <TableHeader>
            <TableRow className="border-border/60 hover:bg-transparent">
              <TableHead>Time</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.at + r.type} className="border-border/60">
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {r.at}
                </TableCell>
                <TableCell className="text-primary">{r.type}</TableCell>
                <TableCell>{r.actor}</TableCell>
                <TableCell className="text-muted-foreground">{r.detail}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AnimatedPage>
  );
}
