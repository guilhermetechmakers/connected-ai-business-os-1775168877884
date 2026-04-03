import type { Json } from "@/types/database";

/** Row shape returned by `admin-console-api` GET `/admin/logs/activity` (activity_logs). */
export interface AdminActivityApiRow {
  id: string;
  company_id: string;
  event_type: string;
  actor_user_id: string | null;
  payload: Json | Record<string, unknown>;
  created_at: string;
  ai_triggered?: boolean;
  metadata?: Json | Record<string, unknown> | null;
}

/** Row shape for `/admin/logs/audit` (subset of activity_logs). */
export type AdminAuditApiRow = AdminActivityApiRow;

export interface AdminConsoleRestResponse<T> {
  data?: T;
  count?: number;
  error?: string;
  ok?: boolean;
}
