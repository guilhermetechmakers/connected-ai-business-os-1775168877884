import { cn } from "@/lib/utils";

export interface OnboardingWizardStepProps {
  step: number;
  total: number;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function OnboardingWizardStep({
  step,
  total,
  title,
  description,
  children,
  className,
}: OnboardingWizardStepProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border/70 bg-card/90 p-6 shadow-card transition-all duration-200 animate-in fade-in slide-in-from-bottom-2",
        className,
      )}
      aria-labelledby={`onboarding-step-${step}-title`}
    >
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">
            Step {step} of {total}
          </p>
          <h2
            id={`onboarding-step-${step}-title`}
            className="mt-1 font-display text-xl font-bold text-foreground"
          >
            {title}
          </h2>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
