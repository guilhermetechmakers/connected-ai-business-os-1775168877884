import { useQuery } from "@tanstack/react-query";

import { fetchLandingMarketingBundle } from "@/api/landing-marketing";
import { DEFAULT_LANDING_BUNDLE } from "@/data/landing-defaults";

export const landingMarketingQueryKey = ["landing", "marketing-bundle"] as const;

export function useLandingMarketingBundle() {
  return useQuery({
    queryKey: landingMarketingQueryKey,
    queryFn: fetchLandingMarketingBundle,
    placeholderData: DEFAULT_LANDING_BUNDLE,
  });
}
