import { useQuery } from "@tanstack/react-query";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { fetchDomainSuggestions } from "@/lib/onboarding-signup-api";

export function useDomainSuggestionsQuery(base: string, enabled: boolean) {
  const debounced = useDebouncedValue(base.trim(), 320);

  return useQuery({
    queryKey: ["domain-suggestions", debounced] as const,
    queryFn: async () => {
      const list = await fetchDomainSuggestions(debounced);
      return Array.isArray(list) ? list : [];
    },
    enabled: enabled && debounced.length >= 2,
    staleTime: 60_000,
  });
}
