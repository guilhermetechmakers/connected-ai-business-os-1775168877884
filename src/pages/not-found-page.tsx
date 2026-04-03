import { Link } from "react-router-dom";

import { AnimatedPage } from "@/components/animated-page";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="grid-bg flex min-h-screen flex-col items-center justify-center px-6 py-24 text-center">
      <AnimatedPage className="max-w-lg space-y-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">
          404
        </p>
        <h1 className="font-display text-4xl font-bold">Page not found</h1>
        <p className="text-muted-foreground">
          The route may have moved. Jump back to marketing, create a workspace, or review
          pricing.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
          <Button variant="cta" asChild>
            <Link to="/">Home</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/signup">Sign up</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/#pricing">Pricing</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/#demo">Book demo</Link>
          </Button>
        </div>
      </AnimatedPage>
    </div>
  );
}
