import { Link } from "react-router-dom";

import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

const items = [
  { id: "1", title: "Workflow awaiting approval", time: "5m ago" },
  { id: "2", title: "Integration drift detected", time: "32m ago" },
  { id: "3", title: "Weekly exec brief ready", time: "2h ago" },
];

export default function NotificationsPage() {
  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="Notifications"
        description="In-app alerts, bulk actions, and link to rule management."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/dashboard/settings">Notification rules</Link>
          </Button>
        }
      />
      <Card className="border-border/80 bg-card/90">
        <CardContent className="divide-y divide-border/60 p-0">
          {items.map((n) => (
            <div
              key={n.id}
              className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-muted/30"
            >
              <Checkbox aria-label={`Select ${n.title}`} />
              <div className="flex-1">
                <p className="font-medium text-foreground">{n.title}</p>
                <p className="text-xs text-muted-foreground">{n.time}</p>
              </div>
              <Button size="sm" variant="ghost">
                Open
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
      <Separator />
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" size="sm">
          Mark all read
        </Button>
        <Button variant="destructive" size="sm">
          Delete selected
        </Button>
      </div>
    </AnimatedPage>
  );
}
