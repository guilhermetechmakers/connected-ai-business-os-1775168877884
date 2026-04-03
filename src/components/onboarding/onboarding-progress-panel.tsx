import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface OnboardingProgressPanelProps {
  stepLabels: string[];
  currentStep: number;
  title?: string;
  description?: string;
}

export function OnboardingProgressPanel({
  stepLabels,
  currentStep,
  title = "Progress",
  description = "Complete all steps before connecting integrations.",
}: OnboardingProgressPanelProps) {
  const labels = Array.isArray(stepLabels) ? stepLabels : [];
  const total = labels.length || 1;
  const progress = Math.round(((currentStep + 1) / total) * 100);

  return (
    <Card className="border-border/80 bg-card/95 shadow-card lg:col-span-5">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={progress} className="h-2 bg-surface-inner" aria-valuenow={progress} />
        <ol className="space-y-2 text-sm text-muted-foreground">
          {labels.map((label, i) => (
            <li
              key={label}
              className={cn(
                "flex items-center gap-2",
                i === currentStep && "font-medium text-primary",
                i < currentStep && "text-success",
              )}
            >
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full border border-border/60 text-[10px]"
                aria-hidden
              >
                {i < currentStep ? "✓" : i + 1}
              </span>
              {label}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
