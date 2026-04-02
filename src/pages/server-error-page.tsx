import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

export default function ServerErrorPage() {
  return (
    <div className="grid-bg flex min-h-screen flex-col items-center justify-center px-6 py-24 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-destructive">
        500
      </p>
      <h1 className="mt-4 font-display text-4xl font-bold">Something went wrong</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        Our team has been notified. Retry shortly or open the activity log reference
        ID from your admin.
      </p>
      <Button className="mt-8" variant="cta" asChild>
        <Link to="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
