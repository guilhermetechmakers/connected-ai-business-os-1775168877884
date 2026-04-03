import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

interface OnboardingActionBarProps {
  showBack: boolean;
  onBack: () => void;
  isLastStep: boolean;
  onSaveDraft: () => void;
  onCancel?: () => void;
  isSubmitting: boolean;
  continueLabel?: string;
}

export function OnboardingActionBar({
  showBack,
  onBack,
  isLastStep,
  onSaveDraft,
  onCancel,
  isSubmitting,
  continueLabel,
}: OnboardingActionBarProps) {
  return (
    <div className="flex flex-wrap gap-3 border-t border-border/60 pt-6">
      {showBack ? (
        <Button
          type="button"
          variant="outline"
          className="border-border/60"
          onClick={onBack}
        >
          Back
        </Button>
      ) : null}
      <Button type="submit" variant="cta" disabled={isSubmitting} aria-busy={isSubmitting}>
        {isSubmitting
          ? "Saving…"
          : continueLabel ?? (isLastStep ? "Complete onboarding" : "Continue")}
      </Button>
      <Button type="button" variant="secondary" className="border-border/60" onClick={onSaveDraft}>
        Save draft
      </Button>
      {onCancel ? (
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      ) : (
        <Button type="button" variant="ghost" asChild>
          <Link to="/onboarding/integrations">Skip to integrations</Link>
        </Button>
      )}
    </div>
  );
}
