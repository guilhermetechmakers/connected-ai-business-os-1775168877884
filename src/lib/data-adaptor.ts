/**
 * Typed facade over `runDataAdapter` for the unified data / dashboard widget layer.
 * All adapters return safe defaults on failure (see `dashboard/data-adapters.ts`).
 */
import { runDataAdapter } from "@/dashboard/data-adapters";
import type { DataAdapterContext } from "@/types/dashboard";

export const DataAdaptor = {
  async fetch(
    adapterKey: string | null | undefined,
    config: Record<string, unknown>,
    ctx: DataAdapterContext,
  ): Promise<unknown> {
    return runDataAdapter(adapterKey, config ?? {}, ctx);
  },
};
