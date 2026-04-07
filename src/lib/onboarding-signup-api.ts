import { buildDomainSuggestionsLocal } from "@/lib/domain-suggestions-local";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/supabase";

export type DomainSuggestionsResponse = {
  suggestions: string[];
};

function parseSuggestionsFromEnvelope(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const envelope = raw as { data?: unknown };
  const data = envelope.data;
  if (!data || typeof data !== "object") return [];
  const suggestions = (data as { suggestions?: unknown }).suggestions;
  if (!Array.isArray(suggestions)) return [];
  return suggestions.filter(
    (x): x is string => typeof x === "string" && x.trim().length > 0,
  );
}

/**
 * Domain suggestions via auth-api Edge Function (`domains.suggestions` op).
 * Uses native fetch with anon key — no secrets in returned payloads.
 */
export async function fetchDomainSuggestions(base: string): Promise<string[]> {
  const trimmed = base.trim().slice(0, 200);
  if (trimmed.length < 1) return [];

  if (!isSupabaseConfigured) {
    return buildDomainSuggestionsLocal(trimmed);
  }

  const root = supabaseUrl.replace(/\/$/, "");
  const anon = supabaseAnonKey;
  if (!root || !anon) {
    return buildDomainSuggestionsLocal(trimmed);
  }

  try {
    const res = await fetch(`${root}/functions/v1/auth-api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anon}`,
        apikey: anon,
      },
      body: JSON.stringify({ op: "domains.suggestions", base: trimmed }),
    });

    const json: unknown = await res.json();
    const list = parseSuggestionsFromEnvelope(json);
    if (list.length > 0) return list;
  } catch {
    /* fall through */
  }

  return buildDomainSuggestionsLocal(trimmed);
}
