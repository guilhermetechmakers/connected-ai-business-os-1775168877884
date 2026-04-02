import { Link } from "react-router-dom";

import { AnimatedPage } from "@/components/animated-page";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="grid-bg flex min-h-screen flex-col items-center justify-center px-6 py-24 text-center">
      <AnimatedPage className="max-w-md space-y-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">
          404
        </p>
        <h1 className="font-display text-4xl font-bold">Page not found</h1>
        <p className="text-muted-foreground">
          The route may have moved. Check the dashboard navigation or return home.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="cta" asChild>
            <Link to="/">Marketing home</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </AnimatedPage>
    </div>
  );
}
