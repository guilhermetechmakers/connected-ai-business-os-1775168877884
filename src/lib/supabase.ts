import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

const trimmedUrlRaw = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const trimmedKeyRaw = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

/** Normalized project URL (no trailing slash), or placeholder when unset. */
export const supabaseUrl =
  trimmedUrlRaw.replace(/\/$/, "") || "https://placeholder.local.supabase.co";

/** Project anon (publishable) key; trimmed to avoid gateway `Invalid JWT` from stray whitespace. */
export const supabaseAnonKey =
  trimmedKeyRaw || "public-anon-key-placeholder";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    return JSON.parse(atob(b64 + pad)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

if (import.meta.env.DEV && trimmedUrlRaw && trimmedKeyRaw) {
  let hostRef = "";
  try {
    hostRef = new URL(
      trimmedUrlRaw.startsWith("http") ? trimmedUrlRaw : `https://${trimmedUrlRaw}`,
    ).hostname.split(".")[0];
  } catch {
    /* ignore */
  }
  const payload = decodeJwtPayload(trimmedKeyRaw);
  const jwtRef = typeof payload?.ref === "string" ? payload.ref : "";
  if (jwtRef && hostRef && jwtRef !== hostRef) {
    console.error(
      `[Supabase] Anon key project ref "${jwtRef}" does not match URL host "${hostRef}". ` +
        "Fix VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY so they belong to the same project.",
    );
  }
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const isSupabaseConfigured = Boolean(trimmedUrlRaw && trimmedKeyRaw);
