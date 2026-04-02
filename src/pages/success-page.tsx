import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SuccessPage() {
  return (
    <div className="grid-bg flex min-h-screen items-center justify-center px-6 py-16">
      <Card className="max-w-lg border-border/80 bg-card/95 shadow-card">
        <CardHeader>
          <CardTitle className="font-display text-2xl text-success">
            All set
          </CardTitle>
          <CardDescription>
            Your changes were saved. Continue in the dashboard or invite teammates.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="cta" asChild>
            <Link to="/dashboard">Open dashboard</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/dashboard/settings">Manage users</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
