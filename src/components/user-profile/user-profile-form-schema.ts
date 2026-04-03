import { z } from "zod";

import type { Json } from "@/types/database";

export const channelFrequencySchema = z.enum(["immediate", "daily", "weekly"]);

export const profileEditorSchema = z.object({
  displayName: z.string().min(2, "Name required"),
  avatarUrl: z.union([z.string().url(), z.literal("")]),
  jobTitle: z.string().max(200).optional(),
  department: z.string().max(200).optional(),
  bio: z.string().max(8000).optional(),
  phone: z.string().max(40).optional(),
  address: z.string().max(500).optional(),
  emailDigest: z.boolean(),
  securityAlerts: z.boolean(),
  productUpdates: z.boolean(),
  inAppEnabled: z.boolean(),
  smsEnabled: z.boolean(),
  chEmailFreq: channelFrequencySchema,
  chInAppFreq: channelFrequencySchema,
  chSmsFreq: channelFrequencySchema,
});

export type ProfileEditorForm = z.infer<typeof profileEditorSchema>;

export function readNotificationPrefs(prefs: Json | undefined): Pick<
  ProfileEditorForm,
  | "emailDigest"
  | "securityAlerts"
  | "productUpdates"
  | "inAppEnabled"
  | "smsEnabled"
  | "chEmailFreq"
  | "chInAppFreq"
  | "chSmsFreq"
> {
  const defaults = {
    emailDigest: true,
    securityAlerts: true,
    productUpdates: false,
    inAppEnabled: true,
    smsEnabled: false,
    chEmailFreq: "immediate" as const,
    chInAppFreq: "immediate" as const,
    chSmsFreq: "weekly" as const,
  };
  if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) {
    return defaults;
  }
  const n = (prefs as Record<string, unknown>).notifications;
  if (!n || typeof n !== "object" || Array.isArray(n)) {
    return defaults;
  }
  const o = n as Record<string, unknown>;
  const chRaw = o.channels;
  const ch =
    chRaw && typeof chRaw === "object" && !Array.isArray(chRaw)
      ? (chRaw as Record<string, unknown>)
      : {};
  const readFreq = (k: string): "immediate" | "daily" | "weekly" => {
    const row = ch[k];
    const fallback = k === "sms" ? ("weekly" as const) : ("immediate" as const);
    if (!row || typeof row !== "object" || Array.isArray(row)) return fallback;
    const f = (row as Record<string, unknown>).frequency;
    if (f === "daily" || f === "weekly" || f === "immediate") return f;
    return fallback;
  };
  return {
    emailDigest: typeof o.emailDigest === "boolean" ? o.emailDigest : defaults.emailDigest,
    securityAlerts: typeof o.securityAlerts === "boolean" ? o.securityAlerts : defaults.securityAlerts,
    productUpdates: typeof o.productUpdates === "boolean" ? o.productUpdates : defaults.productUpdates,
    inAppEnabled: typeof o.inAppEnabled === "boolean" ? o.inAppEnabled : defaults.inAppEnabled,
    smsEnabled: typeof o.smsEnabled === "boolean" ? o.smsEnabled : defaults.smsEnabled,
    chEmailFreq: readFreq("email"),
    chInAppFreq: readFreq("in_app"),
    chSmsFreq: readFreq("sms"),
  };
}

export function readContactFields(contactInfo: Json | undefined) {
  const fromProfile =
    contactInfo && typeof contactInfo === "object" && !Array.isArray(contactInfo)
      ? (contactInfo as Record<string, unknown>)
      : {};
  const phone = typeof fromProfile.phone === "string" ? fromProfile.phone : "";
  const address = typeof fromProfile.address === "string" ? fromProfile.address : "";
  return { phone, address };
}
