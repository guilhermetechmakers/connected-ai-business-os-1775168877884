/**
 * Shared intent-plan schema for intent-agent Edge Function and ai-api consumers.
 */
import { z } from "https://esm.sh/zod@3.25.76";

export const intentPlanRequestSchema = z.object({
  userMessage: z.string().min(1).max(32000),
  mode: z.enum(["Ask", "Analyze", "Report", "Action"]),
  workspaceId: z.string().max(120).default("global"),
  correlationId: z.string().uuid().optional(),
  /** Tool ids the user is allowed to run (from toolsList + role gating) */
  permittedToolIds: z.array(z.string().min(1)).min(1),
  /** Short human-readable catalog for the model */
  toolCatalogSummary: z.string().max(16000),
  companyTimezone: z.string().max(120).default("UTC"),
  /** Resolved from Google Calendar primary calendar when available */
  providerTimezones: z.object({
    google_calendar: z.string().max(120).nullable().optional(),
  }).optional(),
  referenceNowIso: z.string().optional(),
  clientNowIso: z.string().optional(),
  clientTimeZone: z.string().max(120).optional(),
  clientLocale: z.string().max(32).optional(),
});

export type IntentPlanRequest = z.infer<typeof intentPlanRequestSchema>;

export const explicitDateSchema = z.object({
  year: z.number().int().min(1970).max(2100),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
});

export const intentPlanResultSchema = z.object({
  intent: z.enum([
    "integration_read",
    "integration_write",
    "knowledge",
    "app_action",
    "general",
  ]),
  confidence: z.coerce.number().min(0).max(1).default(0.35),
  toolId: z.string().min(1).max(120).optional(),
  /** Raw args for toolsExecute (may omit time bounds; ai-api merges time window) */
  queryArgs: z.record(z.unknown()).optional(),
  timeWindowHint: z.enum(["today", "tomorrow", "this_week", "explicit", "none"]).optional(),
  explicitDate: explicitDateSchema.optional(),
  reasoningSummary: z.string().max(800).default("Model returned partial plan"),
  fallbackBehavior: z.enum(["use_llm_tools", "none"]).default("use_llm_tools"),
});

export type IntentPlanResult = z.infer<typeof intentPlanResultSchema>;
