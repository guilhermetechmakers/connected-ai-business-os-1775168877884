import { useCallback, useRef } from "react";

export type SearchTelemetryEvent =
  | { kind: "search_query"; queryLength: number }
  | { kind: "filter_change"; filterKey: string }
  | { kind: "ai_summary"; ok: boolean }
  | { kind: "export"; format: string; rowCount: number }
  | { kind: "saved_search"; action: "create" | "run" | "delete" };

/**
 * Lightweight, privacy-safe hook for search analytics (no PII; RBAC-friendly).
 * Extend to send to your telemetry pipeline when available.
 */
export function useSearchTelemetry() {
  const seq = useRef(0);

  const track = useCallback((event: SearchTelemetryEvent) => {
    seq.current += 1;
    void event;
  }, []);

  return { track };
}
