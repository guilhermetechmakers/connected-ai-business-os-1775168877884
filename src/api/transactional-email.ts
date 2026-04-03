import { invokeTransactionalEmailApi } from "@/lib/transactional-email-api";
import type { Json } from "@/types/database";

export interface EmailTemplateBuiltin {
  key: string;
  subject: string;
  body: string;
  placeholders: string[];
}

export interface EmailTemplateRow {
  id: string;
  company_id: string;
  template_key: string;
  subject: string;
  body: string;
  placeholders: Json;
  created_at: string;
  updated_at: string;
}

export async function fetchEmailTemplatesList(): Promise<{
  builtins: EmailTemplateBuiltin[];
  overrides: EmailTemplateRow[];
}> {
  const { data, error } = await invokeTransactionalEmailApi<{
    data?: { builtins?: unknown; overrides?: unknown };
  }>({ op: "emailTemplates.list" });
  if (error || !data || typeof data !== "object") {
    return { builtins: [], overrides: [] };
  }
  const inner = (data as { data?: unknown }).data;
  if (!inner || typeof inner !== "object") {
    return { builtins: [], overrides: [] };
  }
  const o = inner as { builtins?: unknown; overrides?: unknown };
  const builtinsRaw = o.builtins;
  const overridesRaw = o.overrides;
  const builtins = Array.isArray(builtinsRaw)
    ? builtinsRaw.filter((x): x is EmailTemplateBuiltin => {
        if (!x || typeof x !== "object") return false;
        const b = x as Record<string, unknown>;
        return typeof b.key === "string" && typeof b.subject === "string";
      })
    : [];
  const overrides = Array.isArray(overridesRaw)
    ? overridesRaw.filter((x): x is EmailTemplateRow => {
        if (!x || typeof x !== "object") return false;
        const r = x as Record<string, unknown>;
        return typeof r.id === "string" && typeof r.template_key === "string";
      })
    : [];
  return { builtins, overrides };
}

export async function upsertEmailTemplate(payload: {
  templateKey: string;
  subject: string;
  body: string;
  placeholders?: string[];
}): Promise<EmailTemplateRow | null> {
  const { data, error } = await invokeTransactionalEmailApi<{ data?: unknown }>({
    op: "emailTemplates.upsert",
    templateKey: payload.templateKey,
    subject: payload.subject,
    body: payload.body,
    placeholders: payload.placeholders ?? [],
  });
  if (error || !data || typeof data !== "object") return null;
  const row = (data as { data?: unknown }).data;
  if (!row || typeof row !== "object") return null;
  return row as EmailTemplateRow;
}

export async function cloneEmailTemplate(payload: {
  sourceKey: string;
  newKey: string;
}): Promise<EmailTemplateRow | null> {
  const { data, error } = await invokeTransactionalEmailApi<{ data?: unknown }>({
    op: "emailTemplates.clone",
    sourceKey: payload.sourceKey,
    newKey: payload.newKey,
  });
  if (error || !data || typeof data !== "object") return null;
  const row = (data as { data?: unknown }).data;
  if (!row || typeof row !== "object") return null;
  return row as EmailTemplateRow;
}

export async function previewEmailTemplate(payload: {
  templateKey: string;
  sample?: Record<string, string>;
}): Promise<{ subject: string; body: string } | null> {
  const { data, error } = await invokeTransactionalEmailApi<{ data?: unknown }>({
    op: "emailTemplates.preview",
    templateKey: payload.templateKey,
    sample: payload.sample ?? {},
  });
  if (error || !data || typeof data !== "object") return null;
  const inner = (data as { data?: unknown }).data;
  if (!inner || typeof inner !== "object") return null;
  const o = inner as { subject?: string; body?: string };
  if (typeof o.subject !== "string" || typeof o.body !== "string") return null;
  return { subject: o.subject, body: o.body };
}
