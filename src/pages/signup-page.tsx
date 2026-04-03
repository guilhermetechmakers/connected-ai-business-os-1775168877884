import { AnimatedPage } from "@/components/animated-page";
import { AuthenticatorGuard } from "@/components/auth/authenticator-guard";
import { PublicChrome } from "@/components/layout/public-chrome";
import { SignupInviteMarketingColumn } from "@/components/onboarding/signup-invite-marketing-column";
import { SignupInviteWizard } from "@/components/onboarding/signup-invite-wizard";

export default function SignupPage() {
  return (
    <PublicChrome>
      <AuthenticatorGuard>
        <AnimatedPage className="px-6 py-12 md:py-16 lg:px-16 xl:px-24">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-12 lg:gap-16 xl:gap-20">
            <SignupInviteMarketingColumn
              className="lg:col-span-6 xl:col-span-7"
              headline="Start with a"
              headlineAccent="unified control plane"
              subhead="Spin up a tenant, define your workspace domain hint, and seed departments before you verify email and continue onboarding."
            />
            <div className="flex justify-center lg:col-span-6 xl:col-span-5 lg:justify-end animate-slide-in-right">
              <div className="w-full max-w-xl">
                <SignupInviteWizard variant="signup" />
              </div>
            </div>
          </div>
        </AnimatedPage>
      </AuthenticatorGuard>
    </PublicChrome>
  );
}
