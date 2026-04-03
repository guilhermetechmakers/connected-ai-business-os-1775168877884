import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";

export default function ServerErrorPage() {
  const navigate = useNavigate();

  return (
    <div className="grid-bg flex min-h-screen flex-col items-center justify-center px-6 py-24 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-destructive">
        500
      </p>
      <h1 className="mt-4 font-display text-4xl font-bold text-foreground md:text-5xl">
        Something went wrong
      </h1>
      <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
        The platform hit an unexpected error. Wait a moment and retry. If the problem
        persists, contact support with the approximate time, page, and any reference ID
        from your activity log so we can trace the incident.
      </p>
      <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Button
          type="button"
          variant="cta"
          className="min-h-11 min-w-[140px] transition-transform duration-150 hover:scale-[1.02]"
          onClick={() => navigate(0)}
        >
          Retry
        </Button>
        <Button type="button" variant="outline" className="min-h-11 border-border/70" asChild>
          <Link to="/dashboard/global">Back to dashboard</Link>
        </Button>
      </div>
      <p className="mt-10 text-sm text-muted-foreground">
        Support:{" "}
        <a
          href="mailto:support@connected-ai-os.example"
          className="text-primary underline-offset-4 hover:underline"
        >
          support@connected-ai-os.example
        </a>
      </p>
    </div>
  );
}
