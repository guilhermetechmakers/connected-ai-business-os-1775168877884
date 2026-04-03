import { Link } from "react-router-dom";
import { Plug } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import type { OnboardingIntegrationSuggestion } from "@/types/onboarding-domain";
import { cn } from "@/lib/utils";

interface IntegrationsSuggestionsProps {
  items: OnboardingIntegrationSuggestion[];
  isLoading: boolean;
  selectedProviders: string[];
  onToggleProvider: (provider: string, on: boolean) => void;
}

export function IntegrationsSuggestions({
  items,
  isLoading,
  selectedProviders,
  onToggleProvider,
}: IntegrationsSuggestionsProps) {
  const list = Array.isArray(items) ? items : [];
  const selected = Array.isArray(selectedProviders) ? selectedProviders : [];

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl bg-surface-inner" />
        ))}
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No integration suggestions available. You can connect tools from the integration
        wizard next.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2" role="list">
      {list.map((item) => {
        const isSel = selected.includes(item.provider);
        const connected = item.status === "connected";
        const mappings = item.sampleMappings && typeof item.sampleMappings === "object"
          ? item.sampleMappings
          : {};
        const entries = Object.entries(mappings);

        return (
          <li
            key={item.provider}
            className={cn(
              "rounded-2xl border border-border/70 bg-surface-inner/50 p-4 transition-all duration-150",
              "hover:-translate-y-1 hover:border-primary/35 hover:shadow-card-hover",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-display text-base font-semibold text-foreground">
                  {item.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.type === "OAuth" ? "OAuth 2.0" : "API key"} · {item.provider}
                </p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "shrink-0 text-[10px] uppercase",
                  connected
                    ? "border-success/50 text-success"
                    : "border-border/60 text-muted-foreground",
                )}
              >
                {connected ? "Connected" : "Not connected"}
              </Badge>
            </div>

            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border/60 accent-primary"
                checked={isSel}
                onChange={(e) => onToggleProvider(item.provider, e.target.checked)}
                aria-label={`Prioritize ${item.label} in onboarding`}
              />
              <span>Include in setup priorities</span>
            </label>

            {entries.length > 0 ? (
              <Collapsible className="mt-3">
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs">
                    <Plug className="mr-1 h-3.5 w-3.5" aria-hidden />
                    Mapping preview
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <dl className="mt-2 space-y-1 rounded-lg border border-border/50 bg-card/40 p-2 font-mono text-[10px] text-muted-foreground">
                    {entries.slice(0, 6).map(([src, tgt]) => (
                      <div key={src} className="flex justify-between gap-2">
                        <dt className="truncate text-primary">{src}</dt>
                        <dd className="truncate text-foreground">{tgt}</dd>
                      </div>
                    ))}
                  </dl>
                </CollapsibleContent>
              </Collapsible>
            ) : null}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 w-full border-primary/30"
              asChild
            >
              <Link
                to="/onboarding/integrations"
                aria-label={`Connect ${item.label} in integration wizard`}
              >
                Connect in wizard
              </Link>
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
