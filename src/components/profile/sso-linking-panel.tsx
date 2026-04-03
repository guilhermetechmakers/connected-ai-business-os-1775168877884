import { useMutation } from "@tanstack/react-query";
import { Chrome, Shield } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { invokeAuthApiEnvelope } from "@/lib/auth-api";

export function SsoLinkingPanel() {
  const oauthMutation = useMutation({
    mutationFn: async (provider: "google" | "microsoft") => {
      const env = await invokeAuthApiEnvelope<{ url: string }>({
        op: "oauth.url",
        provider,
        redirectTo: typeof window !== "undefined" ? `${window.location.origin}/dashboard/profile` : undefined,
      });
      if (env.error) throw new Error(env.error.message);
      const url = env.data && typeof env.data.url === "string" ? env.data.url : "";
      if (!url) throw new Error("No OAuth URL returned");
      return url;
    },
    onSuccess: (url) => {
      window.location.assign(url);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-surface-inner/30 p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Shield className="h-3.5 w-3.5 text-primary" aria-hidden />
        Link a provider
      </p>
      <p className="text-sm text-muted-foreground">
        Opens your IdP consent screen. Completion is handled by Supabase Auth; linked identities appear
        above after redirect.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="cta"
          size="sm"
          disabled={oauthMutation.isPending}
          className="transition-transform duration-150 hover:scale-[1.02]"
          onClick={() => oauthMutation.mutate("google")}
        >
          <Chrome className="mr-2 h-4 w-4" aria-hidden />
          Continue with Google
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={oauthMutation.isPending}
          onClick={() => oauthMutation.mutate("microsoft")}
        >
          Continue with Microsoft
        </Button>
      </div>
    </div>
  );
}
