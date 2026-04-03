import { ArrowRight, ClipboardList } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LiveIndicator } from "@/components/onboarding/live-indicator";
import { cn } from "@/lib/utils";

type OnboardingNextStepCardProps = {
  currentStepIndex: number;
  totalSteps: number;
  summaryLines: string[];
  nextLabel: string;
  className?: string;
};

/**
 * Compact summary of configured onboarding data and what happens next (design system card).
 */
export function OnboardingNextStepCard({
  currentStepIndex,
  totalSteps,
  summaryLines,
  nextLabel,
  className,
}: OnboardingNextStepCardProps) {
  const lines = Array.isArray(summaryLines) ? summaryLines : [];

  return (
    <Card
      className={cn(
        "border-secondary/25 bg-surface-inner/40 shadow-card transition-all duration-150 hover:-translate-y-1 hover:shadow-card-hover",
        className,
      )}
    >
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 font-display text-base">
          <ClipboardList className="h-4 w-4 text-primary" aria-hidden />
          Review
        </CardTitle>
        <LiveIndicator label="Ready" />
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Step {currentStepIndex + 1} of {totalSteps} · After you create the workspace you&apos;ll verify
          email, then continue company setup.
        </p>
        <ul className="space-y-2 text-sm text-foreground/90">
          {lines.length === 0 ? (
            <li className="text-muted-foreground">Complete prior steps to see a summary.</li>
          ) : (
            lines.map((line) => (
              <li key={line} className="flex gap-2 border-l-2 border-primary/30 pl-3">
                <span className="text-muted-foreground">·</span>
                <span>{line}</span>
              </li>
            ))
          )}
        </ul>
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-xs text-muted-foreground">
          <ArrowRight className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span>{nextLabel}</span>
        </div>
      </CardContent>
    </Card>
  );
}
