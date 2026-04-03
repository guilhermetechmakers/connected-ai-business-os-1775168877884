import { AnimatedPage } from "@/components/animated-page";
import { PublicChrome } from "@/components/layout/public-chrome";
import { SignupInviteWizard } from "@/components/onboarding/signup-invite-wizard";

/**
 * Sign Up / Invite Acceptance — same flow as `/signup` with onboarding-oriented framing.
 */
export default function SignupInviteAcceptancePage() {
  return (
    <PublicChrome>
      <AnimatedPage className="flex justify-center px-6 py-16 lg:px-24">
        <SignupInviteWizard variant="onboarding" />
      </AnimatedPage>
    </PublicChrome>
  );
}
