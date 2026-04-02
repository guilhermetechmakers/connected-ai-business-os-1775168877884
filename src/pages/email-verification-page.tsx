import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { AnimatedPage } from "@/components/animated-page";
import { PublicChrome } from "@/components/layout/public-chrome";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function EmailVerificationPage() {
  const [params] = useSearchParams();
  const status = params.get("status") ?? "pending";

  const isSuccess = status === "success";

  return (
    <PublicChrome>
      <AnimatedPage className="flex justify-center px-6 py-16 lg:px-24">
        <Card className="w-full max-w-lg border-border/80 bg-card/95 shadow-card">
          <CardHeader>
            <CardTitle className="font-display text-2xl">
              {isSuccess ? "Email verified" : "Verify your email"}
            </CardTitle>
            <CardDescription>
              {isSuccess
                ? "Your account is confirmed. Continue onboarding to connect data and invite your team."
                : "We sent a verification link. Confirm ownership before accessing tenant data."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isSuccess ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground">
                Link expired or invalid? Request a fresh verification email.
              </div>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Button variant="cta" asChild>
                <Link to="/onboarding/company">Continue setup</Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => toast.message("Resend queued (simulated)")}
              >
                Resend email
              </Button>
            </div>
          </CardContent>
        </Card>
      </AnimatedPage>
    </PublicChrome>
  );
}
