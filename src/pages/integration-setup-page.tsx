import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { AnimatedPage } from "@/components/animated-page";
import { IntegrationConnectionSetup } from "@/components/integrations-setup/integration-connection-setup";
import { PublicChrome } from "@/components/layout/public-chrome";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export default function IntegrationSetupPage() {
  const [params] = useSearchParams();

  useEffect(() => {
    if (params.get("welcome") === "1") {
      toast.success("Welcome — finish connecting your stack", {
        description: "Company onboarding data is saved. Add OAuth or API keys below.",
      });
    }
  }, [params]);

  return (
    <PublicChrome>
      <AnimatedPage className="px-6 py-16 lg:px-24">
        <div className="mx-auto max-w-5xl space-y-10">
          <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/80 p-8 shadow-card">
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              aria-hidden
            >
              <div className="absolute -left-24 top-0 h-64 w-64 rounded-full bg-primary/20 blur-3xl motion-reduce:animate-none animate-pulse" />
              <div className="absolute -right-16 bottom-0 h-56 w-56 rounded-full bg-secondary/40 blur-3xl" />
            </div>
            <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                  Onboarding
                </p>
                <h1 className="mt-2 font-display text-4xl font-extrabold md:text-5xl">
                  Connect <span className="text-gradient-accent">integrations</span>
                </h1>
                <p className="mt-2 max-w-2xl text-muted-foreground">
                  Guided OAuth/API key capture, field mapping preview, idempotent test sync, and
                  scheduling. All secrets stay server-side via Edge Functions.
                </p>
              </div>
              <Button variant="cta" asChild>
                <Link to="/dashboard/global">Go to workspace</Link>
              </Button>
            </div>
          </div>

          <IntegrationConnectionSetup />

          <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/10 p-4 text-sm text-foreground">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" aria-hidden />
            <div>
              <p className="font-semibold">Health checks</p>
              <p className="text-muted-foreground">
                Each connector reports rate limits, schema drift, and last sync in the Activity log
                with redaction rules applied.
              </p>
            </div>
          </div>
        </div>
      </AnimatedPage>
    </PublicChrome>
  );
}
