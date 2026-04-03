import type { OAuthProviderId } from "@/components/auth/login/types";

export type { OAuthProviderId };

export type SocialAuthBarProps = {
  enabledProviders: OAuthProviderId[];
  disabled?: boolean;
  onProviderSignIn: (provider: OAuthProviderId) => void;
};

function providerLabel(p: OAuthProviderId): string {
  if (p === "google") return "Continue with Google";
  return "Continue with Microsoft";
}

export function SocialAuthBar({
  enabledProviders,
  disabled,
  onProviderSignIn,
}: SocialAuthBarProps) {
  const list = Array.isArray(enabledProviders) ? enabledProviders : [];

  if (list.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Social sign-in
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {list.map((provider) => (
          <button
            key={provider}
            type="button"
            disabled={disabled}
            onClick={() => onProviderSignIn(provider)}
            className="flex h-11 items-center justify-center gap-2 rounded-full border border-white/[0.08] bg-surface-inner text-sm font-medium text-foreground shadow-card transition-all duration-150 hover:border-primary/25 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 motion-safe:hover:-translate-y-0.5"
          >
            {provider === "google" ? (
              <span className="text-lg" aria-hidden>
                G
              </span>
            ) : (
              <span className="text-lg font-bold" aria-hidden>
                M
              </span>
            )}
            {providerLabel(provider)}
          </button>
        ))}
      </div>
    </div>
  );
}
