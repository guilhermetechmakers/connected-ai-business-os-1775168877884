import { AlertCircle, RefreshCw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ErrorBannerProps = {
  message?: string;
  visible: boolean;
  onDismiss?: () => void;
  onRetry?: () => void;
  className?: string;
};

export function ErrorBanner({
  message,
  visible,
  onDismiss,
  onRetry,
  className,
}: ErrorBannerProps) {
  if (!visible || !message?.trim()) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "relative rounded-xl border border-destructive/35 bg-destructive/10 px-3 py-3 text-sm text-foreground motion-safe:animate-fade-in-down",
        className,
      )}
    >
      <div className="flex gap-2 pr-8">
        <AlertCircle
          className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-2">
          <p>{message.trim()}</p>
          <p className="text-xs text-muted-foreground">
            Check your email and password, confirm your workspace domain hint, or try SSO if
            your organization requires it.
          </p>
          {onRetry ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1 border-destructive/30 text-xs transition-transform duration-150 motion-safe:hover:scale-[1.02]"
              onClick={onRetry}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Try again
            </Button>
          ) : null}
        </div>
      </div>
      {onDismiss ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1 h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={onDismiss}
          aria-label="Dismiss error"
        >
          <X className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}
