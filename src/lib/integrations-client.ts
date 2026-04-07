import { CONNECTOR_PROVIDERS } from "@/lib/connector-registry";
import { invokeEdgeFunction } from "@/lib/edge-function-invoke";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { IntegrationOp, ProviderCatalogItem } from "@/types/integrations";

function mockCatalogList(): { catalog: ProviderCatalogItem[] } {
  const raw = Array.isArray(CONNECTOR_PROVIDERS) ? CONNECTOR_PROVIDERS : [];
  const catalog: ProviderCatalogItem[] = raw.map((p) => ({
    id: p.key,
    name: p.label,
    description: p.description,
    logoUrl: null,
    supportsOAuth: p.auth === "oauth2" || p.auth === "both",
    supportsApiKey: p.auth === "api_key" || p.auth === "both",
    linkedGroup: p.key === "google_drive" || p.key === "gmail" || p.key === "google_calendar"
      ? "google_workspace"
      : null,
  }));
  return { catalog };
}

type InvokeResult<T> = T & { error?: string };

async function invokeIntegrations<T>(body: IntegrationOp): Promise<T> {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured. Real integrations require VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }

  const data = await invokeEdgeFunction<InvokeResult<T>>(
    "integrations-api",
    body as Record<string, unknown>,
  );

  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new Error(String(data.error));
  }
  return data as T;
}

export const integrationsClient = {
  invoke: invokeIntegrations,
  mockCatalogList,
};

