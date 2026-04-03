import { Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SSOSignInButtonProps = {
  ssoEnabled: boolean;
  disabled?: boolean;
  onSSO: () => void | Promise<void>;
  className?: string;
};

export function SSOSignInButton({
  ssoEnabled,
  disabled,
  onSSO,
  className,
}: SSOSignInButtonProps) {
  if (!ssoEnabled) return null;

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={disabled}
      onClick={() => void onSSO()}
      className={cn(
        "h-11 w-full gap-2 rounded-full border border-secondary/40 bg-secondary/30 text-secondary-foreground transition-all duration-150 hover:bg-secondary/50 motion-safe:hover:-translate-y-0.5",
        className,
      )}
    >
      <Shield className="h-4 w-4" aria-hidden />
      Sign in with SSO
    </Button>
  );
}
