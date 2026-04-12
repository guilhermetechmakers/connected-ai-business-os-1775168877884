/**
 * Shared integrations runtime used by integrations-api, ai-api and workflows-api.
 * Provides provider catalog, OAuth, credential lifecycle, sync pipelines,
 * tool discovery/execution, and connector-event queue helpers.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  decryptCredentialsJson,
  encryptCredentialsJson,
} from "./credentials-crypto.ts";
import { redactPayloadJson } from "./activity-log-redact.ts";

export type ProviderKey =
  | "slack"
  | "google_drive"
  | "gmail"
  | "google_calendar"
  | "zoom"
  | "hubspot"
  | "quickbooks";

const GOOGLE_PROVIDER_KEYS: ProviderKey[] = [
  "google_drive",
  "gmail",
  "google_calendar",
];

type OAuthProviderKey = "slack" | "google" | "zoom" | "hubspot" | "quickbooks";
type ToolAccessLevel = "read" | "write";
type ToolRiskTier = "low" | "medium" | "high" | "critical";
type ToolRoleGroup =
  | "reader_plus"
  | "comms_plus"
  | "comms_admin_plus"
  | "sales_ops_plus"
  | "sales_admin_plus"
  | "finance_read_plus"
  | "finance_ops_plus"
  | "finance_admin_plus"
  | "ops_plus"
  | "integration_admin_plus";

export type ProviderCatalogItem = {
  id: ProviderKey;
  name: string;
  description: string;
  supportsOAuth: boolean;
  supportsApiKey: boolean;
  linkedGroup?: "google_workspace";
};

export type RuntimeToolDefinition = {
  id: string;
  providerKey: ProviderKey;
  label: string;
  description: string;
  accessLevel: ToolAccessLevel;
  riskTier?: ToolRiskTier;
  roleGroup?: ToolRoleGroup;
  requiresConfirmation: boolean;
  argsShape: Record<string, string>;
};

type ProviderCredentialPayload = {
  auth_type?: "oauth2";
  provider?: string;
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  scope?: string;
  expires_at?: string;
  realm_id?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

type ToolCitation = {
  source: string;
  reference?: string;
  sourceProvider?: string;
  title?: string;
  snippet?: string;
  retrievedAt?: string;
};

export type RuntimeToolListItem = {
  id: string;
  providerKey: ProviderKey;
  connectorId: string;
  label: string;
  description: string;
  accessLevel: ToolAccessLevel;
  riskTier: ToolRiskTier;
  requiresConfirmation: boolean;
};

export type RuntimeToolExecutionResult = {
  ok: boolean;
  pendingConfirmation?: boolean;
  providerKey: ProviderKey;
  connectorId: string;
  toolId: string;
  requiresConfirmation: boolean;
  riskTier?: ToolRiskTier;
  result?: Record<string, unknown>;
  preview?: Record<string, unknown>;
  citations?: ToolCitation[];
};

type OAuthStatePayload = {
  providerKey: ProviderKey;
  connectorId: string;
  userId: string;
  redirectUri: string;
  createdAt: string;
};

type OAuthConfig = {
  provider: OAuthProviderKey;
  authUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  extraAuthParams?: Record<string, string>;
  refreshUsesBasicAuth?: boolean;
};

type SyncEntityRecord = {
  entityType: string;
  externalId: string;
  payload: Record<string, unknown>;
  departmentId?: string | null;
};

type SyncDocumentRecord = {
  externalId: string;
  title: string;
  content?: string;
  snippet?: string;
  metadata?: Record<string, unknown>;
  permissions?: Record<string, unknown>;
  departmentId?: string | null;
};

type SyncPullResult = {
  records: SyncEntityRecord[];
  documents: SyncDocumentRecord[];
  nextCursor: Record<string, unknown>;
  notes: string[];
  events?: ConnectorEventInput[];
};

export type ConnectorEventInput = {
  connectorId?: string | null;
  providerKey: ProviderKey;
  eventType: string;
  externalEventId: string;
  payload: Record<string, unknown>;
  availableAt?: string;
};

export type ConnectorEventQueueRow = {
  id: string;
  company_id: string;
  connector_id: string | null;
  provider_key: string;
  event_type: string;
  external_event_id: string;
  payload: Record<string, unknown>;
  status: "pending" | "processing" | "processed" | "failed";
  attempts: number;
  error_message: string | null;
  available_at: string | null;
  processed_at: string | null;
  created_at: string;
};

export const PROVIDER_CATALOG: ProviderCatalogItem[] = [
  {
    id: "slack",
    name: "Slack",
    description: "Channel sync, thread retrieval, and message actions.",
    supportsOAuth: true,
    supportsApiKey: false,
  },
  {
    id: "google_drive",
    name: "Google Drive",
    description: "Files metadata sync and search for knowledge indexing.",
    supportsOAuth: true,
    supportsApiKey: false,
    linkedGroup: "google_workspace",
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "Email thread sync and email send actions.",
    supportsOAuth: true,
    supportsApiKey: false,
    linkedGroup: "google_workspace",
  },
  {
    id: "google_calendar",
    name: "Google Calendar",
    description: "Calendar event sync and scheduling actions.",
    supportsOAuth: true,
    supportsApiKey: false,
    linkedGroup: "google_workspace",
  },
  {
    id: "zoom",
    name: "Zoom",
    description: "List and create Zoom meetings for scheduling workflows.",
    supportsOAuth: true,
    supportsApiKey: false,
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "CRM contacts/deals sync with write actions.",
    supportsOAuth: true,
    supportsApiKey: false,
  },
  {
    id: "quickbooks",
    name: "QuickBooks",
    description: "Customer and invoice sync with finance-safe updates.",
    supportsOAuth: true,
    supportsApiKey: false,
  },
];

const TOOL_DEFINITIONS: RuntimeToolDefinition[] = [
  {
    id: "slack.send_message",
    providerKey: "slack",
    label: "Slack: send message",
    description: "Send a message to a Slack channel.",
    accessLevel: "write",
    requiresConfirmation: true,
    argsShape: { channel: "string", text: "string" },
  },
  {
    id: "slack.fetch_channel_messages",
    providerKey: "slack",
    label: "Slack: fetch channel messages",
    description: "Read recent messages from a channel.",
    accessLevel: "read",
    requiresConfirmation: false,
    argsShape: { channel: "string", limit: "number?" },
  },
  {
    id: "google_drive.search_files",
    providerKey: "google_drive",
    label: "Drive: search files",
    description: "Search/list files and metadata.",
    accessLevel: "read",
    requiresConfirmation: false,
    argsShape: { query: "string?", pageSize: "number?" },
  },
  {
    id: "google_drive.fetch_file_metadata",
    providerKey: "google_drive",
    label: "Drive: fetch file metadata",
    description: "Fetch metadata for a specific file.",
    accessLevel: "read",
    requiresConfirmation: false,
    argsShape: { fileId: "string" },
  },
  {
    id: "gmail.send_email",
    providerKey: "gmail",
    label: "Gmail: send email",
    description: "Send an email from connected mailbox.",
    accessLevel: "write",
    requiresConfirmation: true,
    argsShape: { to: "string", subject: "string", body: "string" },
  },
  {
    id: "gmail.search_messages",
    providerKey: "gmail",
    label: "Gmail: search messages",
    description: "Search/list Gmail messages or threads.",
    accessLevel: "read",
    requiresConfirmation: false,
    argsShape: { query: "string?", maxResults: "number?" },
  },
  {
    id: "google_calendar.list_events",
    providerKey: "google_calendar",
    label: "Calendar: list events",
    description: "List events in a calendar/time window.",
    accessLevel: "read",
    requiresConfirmation: false,
    argsShape: {
      calendarId: "string?",
      timeMin: "string?",
      timeMax: "string?",
      maxResults: "number?",
    },
  },
  {
    id: "google_calendar.create_event",
    providerKey: "google_calendar",
    label: "Calendar: create event",
    description: "Create a calendar event.",
    accessLevel: "write",
    requiresConfirmation: true,
    argsShape: {
      calendarId: "string?",
      summary: "string",
      start: "string",
      end: "string",
      description: "string?",
      attendees: "array?",
      sendCalendarInvites: "boolean?",
    },
  },
  {
    id: "google_calendar.update_event",
    providerKey: "google_calendar",
    label: "Calendar: update event",
    description: "Update an existing calendar event.",
    accessLevel: "write",
    requiresConfirmation: true,
    argsShape: {
      calendarId: "string?",
      eventId: "string",
      summary: "string?",
      start: "string?",
      end: "string?",
      description: "string?",
    },
  },
  {
    id: "hubspot.search_records",
    providerKey: "hubspot",
    label: "HubSpot: search records",
    description: "Search CRM records (contacts/companies/deals).",
    accessLevel: "read",
    requiresConfirmation: false,
    argsShape: {
      objectType: "contacts|companies|deals",
      query: "string?",
      limit: "number?",
    },
  },
  {
    id: "hubspot.upsert_contact",
    providerKey: "hubspot",
    label: "HubSpot: upsert contact",
    description: "Create/update a contact by email.",
    accessLevel: "write",
    requiresConfirmation: true,
    argsShape: {
      email: "string",
      firstname: "string?",
      lastname: "string?",
      phone: "string?",
    },
  },
  {
    id: "hubspot.create_note",
    providerKey: "hubspot",
    label: "HubSpot: create note",
    description: "Create CRM note linked to a record.",
    accessLevel: "write",
    requiresConfirmation: true,
    argsShape: { body: "string", associationType: "string?", associationId: "string?" },
  },
  {
    id: "hubspot.update_deal_stage",
    providerKey: "hubspot",
    label: "HubSpot: update deal stage",
    description: "Update a deal stage.",
    accessLevel: "write",
    requiresConfirmation: true,
    argsShape: { dealId: "string", dealstage: "string" },
  },
  {
    id: "quickbooks.list_customers",
    providerKey: "quickbooks",
    label: "QuickBooks: list customers",
    description: "List customers.",
    accessLevel: "read",
    requiresConfirmation: false,
    argsShape: { page: "number?", pageSize: "number?" },
  },
  {
    id: "quickbooks.list_invoices",
    providerKey: "quickbooks",
    label: "QuickBooks: list invoices",
    description: "List invoices.",
    accessLevel: "read",
    requiresConfirmation: false,
    argsShape: { page: "number?", pageSize: "number?" },
  },
  {
    id: "quickbooks.send_invoice_reminder",
    providerKey: "quickbooks",
    label: "QuickBooks: send invoice reminder",
    description: "Send reminder email for an invoice.",
    accessLevel: "write",
    requiresConfirmation: true,
    argsShape: { invoiceId: "string" },
  },
  {
    id: "quickbooks.update_invoice_safe_fields",
    providerKey: "quickbooks",
    label: "QuickBooks: update invoice status fields",
    description: "Update safe invoice fields (memo/private note/txn status).",
    accessLevel: "write",
    requiresConfirmation: true,
    argsShape: { invoiceId: "string", privateNote: "string?", txnStatus: "string?" },
  },
  {
    id: "slack.list_channels",
    providerKey: "slack",
    label: "Slack: list channels",
    description: "List channels the bot can access.",
    accessLevel: "read",
    riskTier: "low",
    roleGroup: "reader_plus",
    requiresConfirmation: false,
    argsShape: { limit: "number?", cursor: "string?" },
  },
  {
    id: "slack.fetch_thread_replies",
    providerKey: "slack",
    label: "Slack: fetch thread replies",
    description: "Read thread replies by channel and thread ts.",
    accessLevel: "read",
    riskTier: "low",
    roleGroup: "reader_plus",
    requiresConfirmation: false,
    argsShape: { channel: "string", threadTs: "string", limit: "number?" },
  },
  {
    id: "slack.list_users",
    providerKey: "slack",
    label: "Slack: list users",
    description: "List workspace users.",
    accessLevel: "read",
    riskTier: "low",
    roleGroup: "reader_plus",
    requiresConfirmation: false,
    argsShape: { limit: "number?", cursor: "string?" },
  },
  {
    id: "slack.update_message",
    providerKey: "slack",
    label: "Slack: update message",
    description: "Update a previously posted message.",
    accessLevel: "write",
    riskTier: "medium",
    roleGroup: "comms_plus",
    requiresConfirmation: true,
    argsShape: { channel: "string", ts: "string", text: "string" },
  },
  {
    id: "slack.delete_message",
    providerKey: "slack",
    label: "Slack: delete message",
    description: "Delete a message in a channel.",
    accessLevel: "write",
    riskTier: "high",
    roleGroup: "comms_admin_plus",
    requiresConfirmation: true,
    argsShape: { channel: "string", ts: "string" },
  },
  {
    id: "slack.add_reaction",
    providerKey: "slack",
    label: "Slack: add reaction",
    description: "Add a reaction to a message.",
    accessLevel: "write",
    riskTier: "low",
    roleGroup: "comms_plus",
    requiresConfirmation: false,
    argsShape: { channel: "string", ts: "string", name: "string" },
  },
  {
    id: "google_drive.fetch_file_content",
    providerKey: "google_drive",
    label: "Drive: fetch file content",
    description: "Fetch content from Drive file or export Google docs.",
    accessLevel: "read",
    riskTier: "low",
    roleGroup: "reader_plus",
    requiresConfirmation: false,
    argsShape: { fileId: "string", mimeType: "string?" },
  },
  {
    id: "google_drive.list_revisions",
    providerKey: "google_drive",
    label: "Drive: list revisions",
    description: "List revisions for a Drive file.",
    accessLevel: "read",
    riskTier: "low",
    roleGroup: "reader_plus",
    requiresConfirmation: false,
    argsShape: { fileId: "string", pageSize: "number?" },
  },
  {
    id: "google_drive.create_folder",
    providerKey: "google_drive",
    label: "Drive: create folder",
    description: "Create a folder in Drive.",
    accessLevel: "write",
    riskTier: "medium",
    roleGroup: "ops_plus",
    requiresConfirmation: true,
    argsShape: { name: "string", parentId: "string?" },
  },
  {
    id: "google_drive.update_file_metadata",
    providerKey: "google_drive",
    label: "Drive: update file metadata",
    description: "Update file metadata in Drive.",
    accessLevel: "write",
    riskTier: "medium",
    roleGroup: "ops_plus",
    requiresConfirmation: true,
    argsShape: { fileId: "string", name: "string?", description: "string?" },
  },
  {
    id: "google_drive.create_permission",
    providerKey: "google_drive",
    label: "Drive: create permission",
    description: "Grant access permission to a file.",
    accessLevel: "write",
    riskTier: "high",
    roleGroup: "integration_admin_plus",
    requiresConfirmation: true,
    argsShape: { fileId: "string", role: "reader|commenter|writer", type: "user|group|domain|anyone", emailAddress: "string?" },
  },
  {
    id: "gmail.get_message",
    providerKey: "gmail",
    label: "Gmail: get message",
    description: "Fetch full metadata/payload for a message.",
    accessLevel: "read",
    riskTier: "low",
    roleGroup: "reader_plus",
    requiresConfirmation: false,
    argsShape: { messageId: "string", format: "metadata|full|minimal?" },
  },
  {
    id: "gmail.get_thread",
    providerKey: "gmail",
    label: "Gmail: get thread",
    description: "Fetch an entire thread.",
    accessLevel: "read",
    riskTier: "low",
    roleGroup: "reader_plus",
    requiresConfirmation: false,
    argsShape: { threadId: "string", format: "metadata|full|minimal?" },
  },
  {
    id: "gmail.list_labels",
    providerKey: "gmail",
    label: "Gmail: list labels",
    description: "List mailbox labels.",
    accessLevel: "read",
    riskTier: "low",
    roleGroup: "reader_plus",
    requiresConfirmation: false,
    argsShape: {},
  },
  {
    id: "gmail.create_draft",
    providerKey: "gmail",
    label: "Gmail: create draft",
    description: "Create a Gmail draft.",
    accessLevel: "write",
    riskTier: "medium",
    roleGroup: "comms_plus",
    requiresConfirmation: true,
    argsShape: { to: "string", subject: "string", body: "string" },
  },
  {
    id: "gmail.modify_message_labels",
    providerKey: "gmail",
    label: "Gmail: modify message labels",
    description: "Add/remove labels for a message.",
    accessLevel: "write",
    riskTier: "medium",
    roleGroup: "comms_plus",
    requiresConfirmation: true,
    argsShape: { messageId: "string", addLabelIds: "string[]?", removeLabelIds: "string[]?" },
  },
  {
    id: "google_calendar.get_event",
    providerKey: "google_calendar",
    label: "Calendar: get event",
    description: "Get a single calendar event.",
    accessLevel: "read",
    riskTier: "low",
    roleGroup: "reader_plus",
    requiresConfirmation: false,
    argsShape: { calendarId: "string?", eventId: "string" },
  },
  {
    id: "google_calendar.list_calendars",
    providerKey: "google_calendar",
    label: "Calendar: list calendars",
    description: "List calendars for the connected account.",
    accessLevel: "read",
    riskTier: "low",
    roleGroup: "reader_plus",
    requiresConfirmation: false,
    argsShape: { maxResults: "number?" },
  },
  {
    id: "google_calendar.delete_event",
    providerKey: "google_calendar",
    label: "Calendar: delete event",
    description: "Delete an existing event.",
    accessLevel: "write",
    riskTier: "high",
    roleGroup: "comms_admin_plus",
    requiresConfirmation: true,
    argsShape: { calendarId: "string?", eventId: "string" },
  },
  {
    id: "zoom.list_meetings",
    providerKey: "zoom",
    label: "Zoom: list meetings",
    description: "List upcoming meetings for the connected Zoom user.",
    accessLevel: "read",
    riskTier: "low",
    roleGroup: "reader_plus",
    requiresConfirmation: false,
    argsShape: { userId: "string?", type: "scheduled|live|upcoming|upcoming_meetings|previous_meetings?", pageSize: "number?" },
  },
  {
    id: "zoom.create_meeting",
    providerKey: "zoom",
    label: "Zoom: create meeting",
    description: "Create a Zoom meeting for a connected Zoom user.",
    accessLevel: "write",
    riskTier: "medium",
    roleGroup: "comms_plus",
    requiresConfirmation: true,
    argsShape: {
      userId: "string?",
      topic: "string",
      startTime: "string?",
      durationMinutes: "number?",
      timezone: "string?",
      agenda: "string?",
    },
  },
  {
    id: "hubspot.get_record",
    providerKey: "hubspot",
    label: "HubSpot: get record",
    description: "Get a CRM record by object type and id.",
    accessLevel: "read",
    riskTier: "low",
    roleGroup: "reader_plus",
    requiresConfirmation: false,
    argsShape: { objectType: "contacts|companies|deals", recordId: "string" },
  },
  {
    id: "hubspot.create_contact",
    providerKey: "hubspot",
    label: "HubSpot: create contact",
    description: "Create contact record.",
    accessLevel: "write",
    riskTier: "medium",
    roleGroup: "sales_ops_plus",
    requiresConfirmation: true,
    argsShape: { email: "string", firstname: "string?", lastname: "string?", phone: "string?" },
  },
  {
    id: "hubspot.create_deal",
    providerKey: "hubspot",
    label: "HubSpot: create deal",
    description: "Create deal record.",
    accessLevel: "write",
    riskTier: "medium",
    roleGroup: "sales_ops_plus",
    requiresConfirmation: true,
    argsShape: { dealname: "string", dealstage: "string", pipeline: "string?", amount: "string?" },
  },
  {
    id: "quickbooks.get_invoice",
    providerKey: "quickbooks",
    label: "QuickBooks: get invoice",
    description: "Fetch a single invoice by id.",
    accessLevel: "read",
    riskTier: "low",
    roleGroup: "finance_read_plus",
    requiresConfirmation: false,
    argsShape: { invoiceId: "string" },
  },
  {
    id: "quickbooks.create_customer",
    providerKey: "quickbooks",
    label: "QuickBooks: create customer",
    description: "Create a customer.",
    accessLevel: "write",
    riskTier: "medium",
    roleGroup: "finance_ops_plus",
    requiresConfirmation: true,
    argsShape: { displayName: "string", email: "string?" },
  },
  {
    id: "quickbooks.create_invoice",
    providerKey: "quickbooks",
    label: "QuickBooks: create invoice",
    description: "Create an invoice.",
    accessLevel: "write",
    riskTier: "high",
    roleGroup: "finance_ops_plus",
    requiresConfirmation: true,
    argsShape: { customerId: "string", totalAmt: "number", privateNote: "string?" },
  },
];

function getToolRiskTier(tool: RuntimeToolDefinition): ToolRiskTier {
  if (tool.riskTier) return tool.riskTier;
  if (tool.accessLevel === "read") return "low";
  if (/delete|remove|permission|deal_stage|invoice|send_email|send_message/.test(tool.id)) {
    return "high";
  }
  return "medium";
}

function getToolRoleGroup(tool: RuntimeToolDefinition): ToolRoleGroup | undefined {
  if (tool.roleGroup) return tool.roleGroup;
  if (tool.accessLevel === "read") return "reader_plus";
  if (tool.providerKey === "quickbooks") return "finance_ops_plus";
  if (tool.providerKey === "hubspot") return "sales_ops_plus";
  if (
    tool.providerKey === "slack" ||
    tool.providerKey === "gmail" ||
    tool.providerKey === "google_calendar" ||
    tool.providerKey === "zoom"
  ) {
    return "comms_plus";
  }
  if (tool.providerKey === "google_drive") return "ops_plus";
  return undefined;
}

function isProviderKey(value: string): value is ProviderKey {
  return PROVIDER_CATALOG.some((p) => p.id === value);
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeRoles(roles: string[]): string[] {
  return (Array.isArray(roles) ? roles : []).map((r) => String(r).toLowerCase());
}

function canWriteTools(roles: string[]): boolean {
  const r = new Set(normalizeRoles(roles));
  return [
    "admin",
    "owner",
    "manager",
    "company_admin",
    "company admin",
    "executive",
    "builder",
    "super_admin",
  ].some((x) => r.has(x));
}

const TOOL_ROLE_GROUPS: Record<ToolRoleGroup, string[]> = {
  reader_plus: [
    "admin",
    "owner",
    "manager",
    "company_admin",
    "company admin",
    "executive",
    "analyst",
    "auditor",
    "compliance_auditor",
  ],
  comms_plus: [
    "admin",
    "owner",
    "manager",
    "company_admin",
    "company admin",
    "executive",
    "comms_ops",
  ],
  comms_admin_plus: [
    "admin",
    "owner",
    "company_admin",
    "company admin",
    "executive",
    "comms_admin",
  ],
  sales_ops_plus: [
    "admin",
    "owner",
    "manager",
    "company_admin",
    "company admin",
    "executive",
    "sales_ops",
  ],
  sales_admin_plus: [
    "admin",
    "owner",
    "company_admin",
    "company admin",
    "executive",
    "sales_admin",
  ],
  finance_read_plus: [
    "admin",
    "owner",
    "manager",
    "company_admin",
    "company admin",
    "executive",
    "finance_ops",
    "finance_admin",
    "auditor",
  ],
  finance_ops_plus: [
    "admin",
    "owner",
    "company_admin",
    "company admin",
    "executive",
    "finance_ops",
    "finance_admin",
  ],
  finance_admin_plus: [
    "admin",
    "owner",
    "company_admin",
    "company admin",
    "executive",
    "finance_admin",
  ],
  ops_plus: [
    "admin",
    "owner",
    "manager",
    "company_admin",
    "company admin",
    "executive",
    "builder",
    "integration_admin",
  ],
  integration_admin_plus: [
    "admin",
    "owner",
    "company_admin",
    "company admin",
    "executive",
    "integration_admin",
    "super_admin",
  ],
};

function canExecuteRoleGroup(roles: string[], group?: ToolRoleGroup): boolean {
  if (!group) return true;
  const normalized = new Set(normalizeRoles(roles));
  return (TOOL_ROLE_GROUPS[group] ?? []).some((allowed) => normalized.has(allowed));
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 3,
): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, init);
      if (res.status !== 429 && res.status < 500) return res;
      if (attempt === retries) return res;
      const retryAfter = Number(res.headers.get("retry-after"));
      const backoff = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Math.min(2000 * (attempt + 1), 8000);
      await delay(backoff);
      continue;
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      await delay(Math.min(1200 * (attempt + 1), 5000));
    }
  }
  throw new Error(
    `Provider request failed: ${
      lastError instanceof Error ? lastError.message : "unknown network error"
    }`,
  );
}

async function parseJsonSafe(res: Response): Promise<Record<string, unknown>> {
  try {
    const json = await res.json();
    return asObject(json);
  } catch {
    return {};
  }
}

function toOAuthProvider(providerKey: ProviderKey): OAuthProviderKey {
  if (GOOGLE_PROVIDER_KEYS.includes(providerKey)) return "google";
  if (providerKey === "slack") return "slack";
  if (providerKey === "zoom") return "zoom";
  if (providerKey === "hubspot") return "hubspot";
  return "quickbooks";
}

function envRequired(key: string): string {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getOAuthConfig(providerKey: ProviderKey): OAuthConfig {
  const provider = toOAuthProvider(providerKey);
  const redirectUri = envRequired("INTEGRATIONS_OAUTH_REDIRECT_URI");

  if (provider === "slack") {
    return {
      provider,
      authUrl: Deno.env.get("SLACK_OAUTH_AUTH_URL") ??
        "https://slack.com/oauth/v2/authorize",
      tokenUrl: Deno.env.get("SLACK_OAUTH_TOKEN_URL") ??
        "https://slack.com/api/oauth.v2.access",
      clientId: envRequired("SLACK_CLIENT_ID"),
      clientSecret: envRequired("SLACK_CLIENT_SECRET"),
      scopes: [
        "channels:read",
        "channels:history",
        "groups:history",
        "im:history",
        "mpim:history",
        "chat:write",
        "reactions:write",
        "users:read",
        "users:read.email",
      ],
      extraAuthParams: { redirect_uri: redirectUri },
    };
  }

  if (provider === "google") {
    return {
      provider,
      authUrl: Deno.env.get("GOOGLE_OAUTH_AUTH_URL") ??
        "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: Deno.env.get("GOOGLE_OAUTH_TOKEN_URL") ??
        "https://oauth2.googleapis.com/token",
      clientId: envRequired("GOOGLE_CLIENT_ID"),
      clientSecret: envRequired("GOOGLE_CLIENT_SECRET"),
      scopes: [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/drive.metadata.readonly",
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.compose",
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/gmail.labels",
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/calendar.readonly",
      ],
      extraAuthParams: {
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "true",
      },
    };
  }

  if (provider === "hubspot") {
    return {
      provider,
      authUrl: Deno.env.get("HUBSPOT_OAUTH_AUTH_URL") ??
        "https://app.hubspot.com/oauth/authorize",
      tokenUrl: Deno.env.get("HUBSPOT_OAUTH_TOKEN_URL") ??
        "https://api.hubapi.com/oauth/v1/token",
      clientId: envRequired("HUBSPOT_CLIENT_ID"),
      clientSecret: envRequired("HUBSPOT_CLIENT_SECRET"),
      scopes: [
        "crm.objects.contacts.read",
        "crm.objects.contacts.write",
        "crm.objects.companies.read",
        "crm.objects.companies.write",
        "crm.objects.deals.read",
        "crm.objects.deals.write",
        "crm.objects.notes.read",
        "crm.objects.notes.write",
      ],
    };
  }

  if (provider === "zoom") {
    return {
      provider,
      authUrl: Deno.env.get("ZOOM_OAUTH_AUTH_URL") ??
        "https://zoom.us/oauth/authorize",
      tokenUrl: Deno.env.get("ZOOM_OAUTH_TOKEN_URL") ??
        "https://zoom.us/oauth/token",
      clientId: envRequired("ZOOM_CLIENT_ID"),
      clientSecret: envRequired("ZOOM_CLIENT_SECRET"),
      scopes: [
        "meeting:read",
        "meeting:write",
        "user:read",
      ],
    };
  }

  return {
    provider: "quickbooks",
    authUrl: Deno.env.get("QUICKBOOKS_OAUTH_AUTH_URL") ??
      "https://appcenter.intuit.com/connect/oauth2",
    tokenUrl: Deno.env.get("QUICKBOOKS_OAUTH_TOKEN_URL") ??
      "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
    clientId: envRequired("QUICKBOOKS_CLIENT_ID"),
    clientSecret: envRequired("QUICKBOOKS_CLIENT_SECRET"),
    scopes: ["com.intuit.quickbooks.accounting"],
    refreshUsesBasicAuth: true,
  };
}

async function ensureConnector(
  supabase: SupabaseClient,
  companyId: string,
  providerKey: ProviderKey,
): Promise<{ id: string; provider_key: ProviderKey; display_name: string | null; status: string }> {
  const { data: existing, error: exErr } = await supabase
    .from("connectors")
    .select("id, provider_key, display_name, status")
    .eq("company_id", companyId)
    .eq("provider_key", providerKey)
    .maybeSingle();
  if (exErr) throw exErr;
  if (existing?.id && isProviderKey(String(existing.provider_key))) {
    return {
      id: existing.id as string,
      provider_key: existing.provider_key as ProviderKey,
      display_name: existing.display_name as string | null,
      status: String(existing.status ?? "disconnected"),
    };
  }

  const cat = PROVIDER_CATALOG.find((p) => p.id === providerKey);
  const { data, error } = await supabase
    .from("connectors")
    .insert({
      company_id: companyId,
      provider_key: providerKey,
      display_name: cat?.name ?? providerKey,
      status: "disconnected",
    })
    .select("id, provider_key, display_name, status")
    .single();
  if (error || !data) throw error ?? new Error("Failed to create connector");
  return {
    id: data.id as string,
    provider_key: data.provider_key as ProviderKey,
    display_name: data.display_name as string | null,
    status: String(data.status ?? "disconnected"),
  };
}

async function loadConnectorWithCredential(
  supabase: SupabaseClient,
  companyId: string,
  connectorId: string,
): Promise<{ id: string; provider_key: ProviderKey; status: string; config: Record<string, unknown>; encrypted_payload: string | null } | null> {
  const { data, error } = await supabase
    .from("connectors")
    .select(
      "id, provider_key, status, config, connector_credentials!left(encrypted_payload)",
    )
    .eq("id", connectorId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) return null;
  if (!isProviderKey(String(data.provider_key))) {
    throw new Error("Unsupported provider");
  }
  const joined = Array.isArray(data.connector_credentials)
    ? data.connector_credentials[0]
    : data.connector_credentials;
  return {
    id: data.id as string,
    provider_key: data.provider_key as ProviderKey,
    status: String(data.status ?? "disconnected"),
    config: asObject(data.config),
    encrypted_payload: (joined?.encrypted_payload as string | null) ?? null,
  };
}

async function upsertEncryptedCredential(
  supabase: SupabaseClient,
  params: {
    companyId: string;
    connectorId: string;
    payload: ProviderCredentialPayload;
    metadata?: Record<string, unknown>;
    masterKey: string;
  },
) {
  const encrypted = await encryptCredentialsJson(params.payload, params.masterKey);
  const now = nowIso();
  const meta = {
    ...(params.metadata ?? {}),
    provider: params.payload.provider ?? null,
    rotatedAt: now,
    expiresAt: params.payload.expires_at ?? null,
  };
  const { error } = await supabase.from("connector_credentials").upsert(
    {
      company_id: params.companyId,
      connector_id: params.connectorId,
      encrypted_payload: encrypted,
      metadata: meta,
      rotated_at: now,
      updated_at: now,
    },
    { onConflict: "connector_id" },
  );
  if (error) throw error;
  await supabase
    .from("connectors")
    .update({
      status: "connected",
      last_error_message: null,
      last_error_remediation: null,
      updated_at: now,
    })
    .eq("id", params.connectorId)
    .eq("company_id", params.companyId);
}

async function decryptCredential(
  encryptedPayload: string | null,
  masterKey: string,
): Promise<ProviderCredentialPayload> {
  if (!encryptedPayload) return {};
  try {
    const obj = await decryptCredentialsJson(encryptedPayload, masterKey);
    return asObject(obj) as ProviderCredentialPayload;
  } catch {
    return {};
  }
}

async function exchangeAuthCodeForToken(
  providerKey: ProviderKey,
  code: string,
  redirectUri: string,
): Promise<ProviderCredentialPayload> {
  const oauth = getOAuthConfig(providerKey);

  const params = new URLSearchParams();
  params.set("grant_type", "authorization_code");
  params.set("code", code);
  params.set("redirect_uri", redirectUri);
  params.set("client_id", oauth.clientId);
  params.set("client_secret", oauth.clientSecret);

  let headers: HeadersInit = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (oauth.provider === "quickbooks") {
    const basic = btoa(`${oauth.clientId}:${oauth.clientSecret}`);
    headers = {
      ...headers,
      Authorization: `Basic ${basic}`,
    };
    params.delete("client_id");
    params.delete("client_secret");
  }

  const res = await fetchWithRetry(oauth.tokenUrl, {
    method: "POST",
    headers,
    body: params.toString(),
  }, 2);
  const json = await parseJsonSafe(res);
  if (!res.ok) {
    const err = typeof json.error_description === "string"
      ? json.error_description
      : typeof json.error === "string"
        ? json.error
        : `token exchange failed (${res.status})`;
    throw new Error(err);
  }

  const expiresIn = typeof json.expires_in === "number" ? json.expires_in : 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const realmId = typeof json.realmId === "string" ? json.realmId : undefined;
  return {
    auth_type: "oauth2",
    provider: providerKey,
    access_token: typeof json.access_token === "string" ? json.access_token : undefined,
    refresh_token: typeof json.refresh_token === "string" ? json.refresh_token : undefined,
    token_type: typeof json.token_type === "string" ? json.token_type : "Bearer",
    scope: typeof json.scope === "string" ? json.scope : oauth.scopes.join(" "),
    expires_at: expiresAt,
    realm_id: realmId,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
}

async function refreshAccessTokenIfNeeded(
  supabase: SupabaseClient,
  params: {
    companyId: string;
    connectorId: string;
    providerKey: ProviderKey;
    credential: ProviderCredentialPayload;
    masterKey: string;
  },
): Promise<ProviderCredentialPayload> {
  const accessToken = typeof params.credential.access_token === "string"
    ? params.credential.access_token
    : "";
  const refreshToken = typeof params.credential.refresh_token === "string"
    ? params.credential.refresh_token
    : "";
  const exp = typeof params.credential.expires_at === "string"
    ? Date.parse(params.credential.expires_at)
    : NaN;

  if (!refreshToken || !Number.isFinite(exp) || exp > Date.now() + 60_000) {
    return params.credential;
  }

  const oauth = getOAuthConfig(params.providerKey);
  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", refreshToken);
  body.set("client_id", oauth.clientId);
  body.set("client_secret", oauth.clientSecret);

  let headers: HeadersInit = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (oauth.refreshUsesBasicAuth) {
    const basic = btoa(`${oauth.clientId}:${oauth.clientSecret}`);
    headers = {
      ...headers,
      Authorization: `Basic ${basic}`,
    };
    body.delete("client_id");
    body.delete("client_secret");
  }

  const res = await fetchWithRetry(oauth.tokenUrl, {
    method: "POST",
    headers,
    body: body.toString(),
  }, 2);
  const json = await parseJsonSafe(res);
  if (!res.ok) {
    throw new Error(
      typeof json.error_description === "string"
        ? json.error_description
        : `token refresh failed (${res.status})`,
    );
  }

  const expiresIn = typeof json.expires_in === "number" ? json.expires_in : 3600;
  const next: ProviderCredentialPayload = {
    ...params.credential,
    access_token: typeof json.access_token === "string"
      ? json.access_token
      : accessToken,
    refresh_token: typeof json.refresh_token === "string"
      ? json.refresh_token
      : refreshToken,
    token_type: typeof json.token_type === "string"
      ? json.token_type
      : params.credential.token_type,
    scope: typeof json.scope === "string" ? json.scope : params.credential.scope,
    expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    updated_at: nowIso(),
  };
  if (typeof json.realmId === "string") {
    next.realm_id = json.realmId;
  }

  if (GOOGLE_PROVIDER_KEYS.includes(params.providerKey)) {
    await upsertLinkedGoogleCredential(supabase, params.companyId, next, params.masterKey);
  } else {
    await upsertEncryptedCredential(supabase, {
      companyId: params.companyId,
      connectorId: params.connectorId,
      payload: next,
      metadata: { linkedGroup: null, refreshed: true },
      masterKey: params.masterKey,
    });
  }
  return next;
}

async function providerRequest(
  method: string,
  url: string,
  accessToken: string,
  body?: Record<string, unknown> | string,
  headers?: Record<string, string>,
): Promise<Record<string, unknown>> {
  const initHeaders: HeadersInit = {
    Authorization: `Bearer ${accessToken}`,
    ...(headers ?? {}),
  };
  let payload: string | undefined;
  if (typeof body === "string") {
    payload = body;
  } else if (body !== undefined) {
    payload = JSON.stringify(body);
    (initHeaders as Record<string, string>)["Content-Type"] = "application/json";
  }
  const res = await fetchWithRetry(url, { method, headers: initHeaders, body: payload }, 3);
  const json = await parseJsonSafe(res);
  if (!res.ok) {
    const host = (() => {
      try {
        return new URL(url).host;
      } catch {
        return "unknown-host";
      }
    })();
    const errorObj = asObject(json.error);
    const nestedErrors = Array.isArray(errorObj.errors) ? errorObj.errors : [];
    const firstNested = nestedErrors.length > 0 ? asObject(nestedErrors[0]) : {};
    const providerMessage = typeof json.error === "string"
      ? json.error
      : typeof json.message === "string"
        ? json.message
        : typeof errorObj.message === "string"
          ? errorObj.message
          : typeof firstNested.message === "string"
            ? firstNested.message
            : "";
    const providerReason = typeof firstNested.reason === "string"
      ? firstNested.reason
      : typeof errorObj.status === "string"
        ? errorObj.status
        : "";
    const detail = providerMessage || providerReason || "request failed";
    const scopeHint = host.includes("gmail.googleapis.com") &&
        /insufficient|permission|forbidden|scope|access/i.test(`${providerMessage} ${providerReason}`)
      ? " Reconnect Gmail and grant gmail.readonly/gmail.send scopes."
      : "";
    throw new Error(`provider request failed (${res.status}) [${host}] ${detail}${scopeHint}`);
  }
  return json;
}

function toConnectorStatusOnFailure(error: unknown): {
  message: string;
  remediation: string;
} {
  const msg = error instanceof Error ? error.message : "provider request failed";
  if (/token|oauth|auth/i.test(msg)) {
    return {
      message: "Authentication failed with provider.",
      remediation: "Reconnect this integration to refresh OAuth grants.",
    };
  }
  if (/rate|429|throttle/i.test(msg)) {
    return {
      message: "Provider rate limit reached.",
      remediation: "Retry in a few minutes; incremental sync will resume from checkpoint.",
    };
  }
  return {
    message: msg.slice(0, 400),
    remediation: "Check provider app scopes and connection settings, then retry.",
  };
}

async function upsertLinkedGoogleCredential(
  supabase: SupabaseClient,
  companyId: string,
  payload: ProviderCredentialPayload,
  masterKey: string,
): Promise<string[]> {
  const ids: string[] = [];
  for (const key of GOOGLE_PROVIDER_KEYS) {
    const connector = await ensureConnector(supabase, companyId, key);
    await upsertEncryptedCredential(supabase, {
      companyId,
      connectorId: connector.id,
      payload: {
        ...payload,
        provider: key,
        updated_at: nowIso(),
      },
      metadata: {
        linkedGroup: "google_workspace",
        sourceProvider: payload.provider ?? key,
      },
      masterKey,
    });
    ids.push(connector.id);
  }
  return ids;
}

function providerLabel(providerKey: ProviderKey): string {
  return PROVIDER_CATALOG.find((p) => p.id === providerKey)?.name ?? providerKey;
}

async function appendSyncLog(
  supabase: SupabaseClient,
  syncRunId: string,
  level: "info" | "warn" | "error",
  message: string,
  details?: Record<string, unknown>,
) {
  await supabase.from("connector_sync_log_entries").insert({
    sync_run_id: syncRunId,
    level,
    message: message.slice(0, 1000),
    error_details: details ?? null,
  });
}

function encodeGmailRaw(to: string, subject: string, body: string): string {
  const msg = `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=\"UTF-8\"\r\n\r\n${body}`;
  const bytes = new TextEncoder().encode(msg);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function toolCitation(providerKey: ProviderKey, reference: string, snippet?: string): ToolCitation {
  return {
    source: `tool:${providerKey}`,
    reference,
    sourceProvider: providerKey,
    snippet: snippet?.slice(0, 300),
    retrievedAt: nowIso(),
  };
}

async function upsertUnifiedEntityFromRecord(
  supabase: SupabaseClient,
  companyId: string,
  providerKey: ProviderKey,
  record: SyncEntityRecord,
  actorUserId: string,
) {
  const { data: sourceRow, error: sourceErr } = await supabase
    .from("unified_sources")
    .select("id, unified_entity_id")
    .eq("company_id", companyId)
    .eq("provider", providerKey)
    .eq("external_id", record.externalId)
    .maybeSingle();
  if (sourceErr) throw sourceErr;

  const sourceRef = [{
    provider: providerKey,
    externalId: record.externalId,
    lastSeenAt: nowIso(),
  }];

  if (sourceRow?.unified_entity_id) {
    const entityId = String(sourceRow.unified_entity_id);
    const { data: existing, error: loadErr } = await supabase
      .from("unified_entities")
      .select("id, payload, version, source_references, department_id")
      .eq("id", entityId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (loadErr) throw loadErr;
    if (!existing?.id) return;

    await supabase.from("unified_entity_versions").insert({
      unified_entity_id: entityId,
      company_id: companyId,
      version: Number(existing.version ?? 1),
      payload: existing.payload ?? {},
      source_references: existing.source_references ?? [],
      actor_user_id: actorUserId,
    });

    const mergedPayload = {
      ...asObject(existing.payload),
      ...record.payload,
    };
    const { error: updErr } = await supabase
      .from("unified_entities")
      .update({
        entity_type: record.entityType,
        payload: mergedPayload,
        version: Number(existing.version ?? 1) + 1,
        is_deleted: false,
        department_id: record.departmentId ?? existing.department_id ?? null,
        source_references: sourceRef,
        updated_at: nowIso(),
      })
      .eq("id", entityId)
      .eq("company_id", companyId);
    if (updErr) throw updErr;

    await supabase
      .from("unified_sources")
      .update({ last_seen_at: nowIso() })
      .eq("id", sourceRow.id);
    return;
  }

  const { data: inserted, error: insErr } = await supabase
    .from("unified_entities")
    .insert({
      company_id: companyId,
      entity_type: record.entityType,
      payload: record.payload,
      source_references: sourceRef,
      department_id: record.departmentId ?? null,
      linked_entity_ids: [],
      version: 1,
      is_deleted: false,
    })
    .select("id")
    .single();
  if (insErr || !inserted?.id) throw insErr ?? new Error("Could not insert entity");

  await supabase.from("unified_sources").insert({
    unified_entity_id: inserted.id,
    company_id: companyId,
    provider: providerKey,
    external_id: record.externalId,
    last_seen_at: nowIso(),
  });
}

async function upsertIndexDocuments(
  supabase: SupabaseClient,
  companyId: string,
  providerKey: ProviderKey,
  docs: SyncDocumentRecord[],
) {
  for (const doc of docs) {
    const title = doc.title.trim() || "Untitled";
    const content = (doc.content ?? "").trim();
    const snippet = (doc.snippet ?? content.slice(0, 600)).slice(0, 2000);
    const metadata = doc.metadata ?? {};
    const permissions = doc.permissions ?? { scope: "tenant" };
    const now = nowIso();

    const { data: existingDoc } = await supabase
      .from("documents")
      .select("id")
      .eq("company_id", companyId)
      .eq("source_provider", providerKey)
      .eq("external_id", doc.externalId)
      .maybeSingle();
    if (existingDoc?.id) {
      await supabase
        .from("documents")
        .update({
          text_content: content || null,
          metadata,
          updated_at: now,
        })
        .eq("id", existingDoc.id);
    } else {
      await supabase.from("documents").insert({
        company_id: companyId,
        source_provider: providerKey,
        external_id: doc.externalId,
        text_content: content || null,
        metadata,
      });
    }

    await supabase.from("indexed_documents").upsert({
      company_id: companyId,
      source_provider: providerKey,
      external_id: doc.externalId,
      title,
      full_text: content || null,
      snippet: snippet || null,
      metadata,
      permissions,
      department_id: doc.departmentId ?? null,
      indexed_at: now,
      updated_at: now,
    }, { onConflict: "company_id,source_provider,external_id" });
  }
}

async function runSlackConnectionTest(accessToken: string): Promise<Record<string, unknown>> {
  return await providerRequest("GET", "https://slack.com/api/auth.test", accessToken);
}

async function runDriveConnectionTest(accessToken: string): Promise<Record<string, unknown>> {
  return await providerRequest(
    "GET",
    "https://www.googleapis.com/drive/v3/files?pageSize=1&fields=files(id,name)",
    accessToken,
  );
}

async function runGmailConnectionTest(accessToken: string): Promise<Record<string, unknown>> {
  return await providerRequest(
    "GET",
    "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    accessToken,
  );
}

async function runCalendarConnectionTest(accessToken: string): Promise<Record<string, unknown>> {
  return await providerRequest(
    "GET",
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1",
    accessToken,
  );
}

async function runHubspotConnectionTest(accessToken: string): Promise<Record<string, unknown>> {
  return await providerRequest("GET", "https://api.hubapi.com/integrations/v1/me", accessToken);
}

async function runZoomConnectionTest(accessToken: string): Promise<Record<string, unknown>> {
  return await providerRequest("GET", "https://api.zoom.us/v2/users/me", accessToken);
}

async function runQuickbooksConnectionTest(
  accessToken: string,
  realmId: string,
): Promise<Record<string, unknown>> {
  const url =
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/companyinfo/${realmId}?minorversion=65`;
  return await providerRequest(
    "GET",
    url,
    accessToken,
    undefined,
    { Accept: "application/json" },
  );
}

async function runProviderConnectionTest(
  providerKey: ProviderKey,
  credential: ProviderCredentialPayload,
): Promise<Record<string, unknown>> {
  const accessToken = typeof credential.access_token === "string" ? credential.access_token : "";
  if (!accessToken) throw new Error("Missing access token");
  if (providerKey === "slack") return await runSlackConnectionTest(accessToken);
  if (providerKey === "google_drive") return await runDriveConnectionTest(accessToken);
  if (providerKey === "gmail") return await runGmailConnectionTest(accessToken);
  if (providerKey === "google_calendar") return await runCalendarConnectionTest(accessToken);
  if (providerKey === "zoom") return await runZoomConnectionTest(accessToken);
  if (providerKey === "hubspot") return await runHubspotConnectionTest(accessToken);

  const realmId = typeof credential.realm_id === "string" ? credential.realm_id : "";
  if (!realmId) {
    throw new Error("QuickBooks connection missing realm_id");
  }
  return await runQuickbooksConnectionTest(accessToken, realmId);
}

async function pullSlackSyncData(
  accessToken: string,
  cursorState: Record<string, unknown>,
): Promise<SyncPullResult> {
  const channels: Array<{ id: string; name?: string }> = [];
  let cursor = typeof cursorState.channelsCursor === "string" ? cursorState.channelsCursor : "";
  for (let i = 0; i < 5; i += 1) {
    const q = new URLSearchParams();
    q.set("limit", "100");
    q.set("types", "public_channel,private_channel");
    if (cursor) q.set("cursor", cursor);
    const data = await providerRequest(
      "GET",
      `https://slack.com/api/conversations.list?${q.toString()}`,
      accessToken,
    );
    const arr = Array.isArray(data.channels) ? data.channels : [];
    for (const c of arr) {
      const obj = asObject(c);
      if (typeof obj.id === "string") {
        channels.push({ id: obj.id, name: typeof obj.name === "string" ? obj.name : undefined });
      }
    }
    const meta = asObject(data.response_metadata);
    cursor = typeof meta.next_cursor === "string" ? meta.next_cursor : "";
    if (!cursor) break;
  }

  const records: SyncEntityRecord[] = [];
  const documents: SyncDocumentRecord[] = [];
  const events: ConnectorEventInput[] = [];
  const channelLastTs = asObject(cursorState.channelLastTs);
  for (const ch of channels.slice(0, 24)) {
    records.push({
      entityType: "Conversation",
      externalId: ch.id,
      payload: {
        channelId: ch.id,
        name: ch.name ?? "",
      },
    });
    const q = new URLSearchParams();
    q.set("channel", ch.id);
    q.set("limit", "60");
    const oldest = typeof channelLastTs[ch.id] === "string" ? String(channelLastTs[ch.id]) : "";
    if (oldest) q.set("oldest", oldest);
    const hist = await providerRequest(
      "GET",
      `https://slack.com/api/conversations.history?${q.toString()}`,
      accessToken,
    );
    const msgs = Array.isArray(hist.messages) ? hist.messages : [];
    let newestTs = oldest;
    for (const m of msgs) {
      const msg = asObject(m);
      const ts = typeof msg.ts === "string" ? msg.ts : "";
      const text = typeof msg.text === "string" ? msg.text : "";
      if (!ts || !text) continue;
      if (!newestTs || ts > newestTs) newestTs = ts;
      const externalId = `${ch.id}:${ts}`;
      records.push({
        entityType: "Message",
        externalId,
        payload: {
          channelId: ch.id,
          text,
          ts,
          user: typeof msg.user === "string" ? msg.user : null,
        },
      });
      documents.push({
        externalId,
        title: `Slack #${ch.name ?? ch.id}`,
        content: text,
        metadata: { channelId: ch.id, ts },
      });
      events.push({
        providerKey: "slack",
        eventType: "message.created",
        externalEventId: externalId,
        payload: { channelId: ch.id, ts, text },
      });
    }
    if (newestTs) channelLastTs[ch.id] = newestTs;
  }
  return {
    records,
    documents,
    nextCursor: {
      channelsCursor: cursor || null,
      channelLastTs,
      syncedAt: nowIso(),
    },
    notes: [`Slack channels scanned: ${channels.length}`],
    events,
  };
}

async function pullDriveSyncData(
  accessToken: string,
  cursorState: Record<string, unknown>,
): Promise<SyncPullResult> {
  const records: SyncEntityRecord[] = [];
  const documents: SyncDocumentRecord[] = [];
  let pageToken = typeof cursorState.pageToken === "string" ? cursorState.pageToken : "";
  for (let i = 0; i < 8; i += 1) {
    const q = new URLSearchParams();
    q.set("pageSize", "100");
    q.set(
      "fields",
      "nextPageToken,files(id,name,mimeType,modifiedTime,description,webViewLink,owners(displayName,emailAddress))",
    );
    if (pageToken) q.set("pageToken", pageToken);
    const data = await providerRequest(
      "GET",
      `https://www.googleapis.com/drive/v3/files?${q.toString()}`,
      accessToken,
    );
    const files = Array.isArray(data.files) ? data.files : [];
    for (const f of files) {
      const file = asObject(f);
      if (typeof file.id !== "string") continue;
      const name = typeof file.name === "string" ? file.name : file.id;
      records.push({
        entityType: "Document",
        externalId: file.id,
        payload: {
          id: file.id,
          name,
          mimeType: file.mimeType ?? null,
          modifiedTime: file.modifiedTime ?? null,
          webViewLink: file.webViewLink ?? null,
        },
      });
      documents.push({
        externalId: file.id,
        title: name,
        content: typeof file.description === "string" ? file.description : "",
        metadata: {
          mimeType: file.mimeType ?? null,
          modifiedTime: file.modifiedTime ?? null,
          webViewLink: file.webViewLink ?? null,
          owners: Array.isArray(file.owners) ? file.owners : [],
        },
      });
    }
    pageToken = typeof data.nextPageToken === "string" ? data.nextPageToken : "";
    if (!pageToken) break;
  }
  return {
    records,
    documents,
    nextCursor: { pageToken: pageToken || null, syncedAt: nowIso() },
    notes: [`Drive files synced: ${records.length}`],
  };
}

async function pullGmailSyncData(
  accessToken: string,
  cursorState: Record<string, unknown>,
): Promise<SyncPullResult> {
  const records: SyncEntityRecord[] = [];
  const documents: SyncDocumentRecord[] = [];
  const events: ConnectorEventInput[] = [];
  let pageToken = typeof cursorState.pageToken === "string" ? cursorState.pageToken : "";
  for (let i = 0; i < 3; i += 1) {
    const q = new URLSearchParams();
    q.set("maxResults", "75");
    if (pageToken) q.set("pageToken", pageToken);
    const list = await providerRequest(
      "GET",
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${q.toString()}`,
      accessToken,
    );
    const messages = Array.isArray(list.messages) ? list.messages : [];
    for (const m of messages.slice(0, 40)) {
      const mObj = asObject(m);
      if (typeof mObj.id !== "string") continue;
      const msg = await providerRequest(
        "GET",
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${mObj.id}?format=metadata`,
        accessToken,
      );
      const payload = asObject(msg.payload);
      const headers = Array.isArray(payload.headers) ? payload.headers : [];
      const map: Record<string, string> = {};
      for (const h of headers) {
        const obj = asObject(h);
        if (typeof obj.name === "string" && typeof obj.value === "string") {
          map[obj.name.toLowerCase()] = obj.value;
        }
      }
      const subject = map.subject ?? "(no subject)";
      const from = map.from ?? "";
      const snippet = typeof msg.snippet === "string" ? msg.snippet : "";
      records.push({
        entityType: "EmailThread",
        externalId: mObj.id,
        payload: {
          messageId: mObj.id,
          threadId: msg.threadId ?? null,
          subject,
          from,
          snippet,
          internalDate: msg.internalDate ?? null,
        },
      });
      documents.push({
        externalId: mObj.id,
        title: subject,
        content: `${from}\n${snippet}`,
        metadata: { threadId: msg.threadId ?? null },
      });
      events.push({
        providerKey: "gmail",
        eventType: "message.synced",
        externalEventId: String(mObj.id),
        payload: { subject, from, threadId: msg.threadId ?? null },
      });
    }
    pageToken = typeof list.nextPageToken === "string" ? list.nextPageToken : "";
    if (!pageToken) break;
  }
  return {
    records,
    documents,
    nextCursor: { pageToken: pageToken || null, syncedAt: nowIso() },
    notes: [`Gmail messages synced: ${records.length}`],
    events,
  };
}

async function pullCalendarSyncData(
  accessToken: string,
  cursorState: Record<string, unknown>,
): Promise<SyncPullResult> {
  const records: SyncEntityRecord[] = [];
  const documents: SyncDocumentRecord[] = [];
  const events: ConnectorEventInput[] = [];
  const list = await providerRequest(
    "GET",
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=25",
    accessToken,
  );
  const calendars = Array.isArray(list.items) ? list.items : [];
  const updatedMin = typeof cursorState.updatedMin === "string"
    ? cursorState.updatedMin
    : undefined;
  for (const c of calendars.slice(0, 10)) {
    const cal = asObject(c);
    if (typeof cal.id !== "string") continue;
    const q = new URLSearchParams();
    q.set("singleEvents", "true");
    q.set("maxResults", "120");
    q.set("orderBy", "updated");
    if (updatedMin) q.set("updatedMin", updatedMin);
    const ev = await providerRequest(
      "GET",
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?${q.toString()}`,
      accessToken,
    );
    const items = Array.isArray(ev.items) ? ev.items : [];
    for (const item of items) {
      const e = asObject(item);
      if (typeof e.id !== "string") continue;
      const summary = typeof e.summary === "string" ? e.summary : "(untitled)";
      const start = asObject(e.start);
      const end = asObject(e.end);
      records.push({
        entityType: "CalendarEvent",
        externalId: `${cal.id}:${e.id}`,
        payload: {
          calendarId: cal.id,
          eventId: e.id,
          summary,
          status: e.status ?? null,
          start: start.dateTime ?? start.date ?? null,
          end: end.dateTime ?? end.date ?? null,
          updated: e.updated ?? null,
        },
      });
      documents.push({
        externalId: `${cal.id}:${e.id}`,
        title: summary,
        content: typeof e.description === "string" ? e.description : "",
        metadata: {
          calendarId: cal.id,
          start: start.dateTime ?? start.date ?? null,
          end: end.dateTime ?? end.date ?? null,
          htmlLink: e.htmlLink ?? null,
        },
      });
      events.push({
        providerKey: "google_calendar",
        eventType: "event.synced",
        externalEventId: `${cal.id}:${e.id}:${e.updated ?? ""}`,
        payload: { calendarId: cal.id, eventId: e.id, summary },
      });
    }
  }
  return {
    records,
    documents,
    nextCursor: { updatedMin: nowIso(), syncedAt: nowIso() },
    notes: [`Calendar events synced: ${records.length}`],
    events,
  };
}

async function pullHubspotSyncData(
  accessToken: string,
  cursorState: Record<string, unknown>,
): Promise<SyncPullResult> {
  const records: SyncEntityRecord[] = [];
  const documents: SyncDocumentRecord[] = [];
  const events: ConnectorEventInput[] = [];

  let contactsAfter = typeof cursorState.contactsAfter === "string"
    ? cursorState.contactsAfter
    : "";
  for (let i = 0; i < 4; i += 1) {
    const q = new URLSearchParams();
    q.set("limit", "100");
    q.set("properties", "firstname,lastname,email,phone,lastmodifieddate");
    if (contactsAfter) q.set("after", contactsAfter);
    const data = await providerRequest(
      "GET",
      `https://api.hubapi.com/crm/v3/objects/contacts?${q.toString()}`,
      accessToken,
    );
    const arr = Array.isArray(data.results) ? data.results : [];
    for (const item of arr) {
      const obj = asObject(item);
      if (typeof obj.id !== "string") continue;
      const props = asObject(obj.properties);
      const fullName = `${props.firstname ?? ""} ${props.lastname ?? ""}`.trim();
      records.push({
        entityType: "Contact",
        externalId: obj.id,
        payload: { id: obj.id, ...props, fullName },
      });
      documents.push({
        externalId: `contact:${obj.id}`,
        title: fullName || String(props.email ?? obj.id),
        content: JSON.stringify(props),
        metadata: { objectType: "contact" },
      });
      events.push({
        providerKey: "hubspot",
        eventType: "contact.synced",
        externalEventId: `contact:${obj.id}:${props.lastmodifieddate ?? ""}`,
        payload: { id: obj.id, email: props.email ?? null },
      });
    }
    const paging = asObject(data.paging);
    const next = asObject(paging.next);
    contactsAfter = typeof next.after === "string" ? next.after : "";
    if (!contactsAfter) break;
  }

  let dealsAfter = typeof cursorState.dealsAfter === "string" ? cursorState.dealsAfter : "";
  for (let i = 0; i < 3; i += 1) {
    const q = new URLSearchParams();
    q.set("limit", "100");
    q.set("properties", "dealname,dealstage,amount,pipeline,hs_lastmodifieddate");
    if (dealsAfter) q.set("after", dealsAfter);
    const data = await providerRequest(
      "GET",
      `https://api.hubapi.com/crm/v3/objects/deals?${q.toString()}`,
      accessToken,
    );
    const arr = Array.isArray(data.results) ? data.results : [];
    for (const item of arr) {
      const obj = asObject(item);
      if (typeof obj.id !== "string") continue;
      const props = asObject(obj.properties);
      records.push({
        entityType: "Opportunity",
        externalId: obj.id,
        payload: { id: obj.id, ...props },
      });
      documents.push({
        externalId: `deal:${obj.id}`,
        title: String(props.dealname ?? obj.id),
        content: JSON.stringify(props),
        metadata: { objectType: "deal" },
      });
      events.push({
        providerKey: "hubspot",
        eventType: "deal.synced",
        externalEventId: `deal:${obj.id}:${props.hs_lastmodifieddate ?? ""}`,
        payload: { id: obj.id, stage: props.dealstage ?? null },
      });
    }
    const paging = asObject(data.paging);
    const next = asObject(paging.next);
    dealsAfter = typeof next.after === "string" ? next.after : "";
    if (!dealsAfter) break;
  }

  return {
    records,
    documents,
    nextCursor: {
      contactsAfter: contactsAfter || null,
      dealsAfter: dealsAfter || null,
      syncedAt: nowIso(),
    },
    notes: [`HubSpot records synced: ${records.length}`],
    events,
  };
}

async function quickbooksQuery(
  accessToken: string,
  realmId: string,
  sql: string,
): Promise<Record<string, unknown>> {
  const q = encodeURIComponent(sql);
  return await providerRequest(
    "GET",
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/query?query=${q}&minorversion=65`,
    accessToken,
    undefined,
    { Accept: "application/json" },
  );
}

async function pullQuickbooksSyncData(
  accessToken: string,
  realmId: string,
  cursorState: Record<string, unknown>,
): Promise<SyncPullResult> {
  const records: SyncEntityRecord[] = [];
  const documents: SyncDocumentRecord[] = [];
  const events: ConnectorEventInput[] = [];
  const customerStart = Number(cursorState.customerStart ?? 1);
  const invoiceStart = Number(cursorState.invoiceStart ?? 1);
  const customerSql =
    `SELECT Id, DisplayName, PrimaryEmailAddr FROM Customer STARTPOSITION ${Math.max(customerStart, 1)} MAXRESULTS 100`;
  const invoiceSql =
    `SELECT Id, DocNumber, TxnDate, TotalAmt, Balance, PrivateNote FROM Invoice STARTPOSITION ${Math.max(invoiceStart, 1)} MAXRESULTS 100`;

  const customerResp = await quickbooksQuery(accessToken, realmId, customerSql);
  const customerRows = Array.isArray(asObject(customerResp.QueryResponse).Customer)
    ? asObject(customerResp.QueryResponse).Customer as unknown[]
    : [];
  for (const row of customerRows) {
    const c = asObject(row);
    if (typeof c.Id !== "string") continue;
    records.push({
      entityType: "Account",
      externalId: c.Id,
      payload: {
        id: c.Id,
        displayName: c.DisplayName ?? null,
        email: asObject(c.PrimaryEmailAddr).Address ?? null,
      },
    });
    documents.push({
      externalId: `customer:${c.Id}`,
      title: String(c.DisplayName ?? c.Id),
      content: JSON.stringify(c),
      metadata: { objectType: "customer" },
    });
  }

  const invResp = await quickbooksQuery(accessToken, realmId, invoiceSql);
  const invoiceRows = Array.isArray(asObject(invResp.QueryResponse).Invoice)
    ? asObject(invResp.QueryResponse).Invoice as unknown[]
    : [];
  for (const row of invoiceRows) {
    const inv = asObject(row);
    if (typeof inv.Id !== "string") continue;
    records.push({
      entityType: "Invoice",
      externalId: inv.Id,
      payload: inv,
    });
    documents.push({
      externalId: `invoice:${inv.Id}`,
      title: `Invoice ${inv.DocNumber ?? inv.Id}`,
      content: JSON.stringify(inv),
      metadata: { objectType: "invoice" },
    });
    events.push({
      providerKey: "quickbooks",
      eventType: "invoice.synced",
      externalEventId: `invoice:${inv.Id}:${inv.MetaData ? JSON.stringify(inv.MetaData) : ""}`,
      payload: { id: inv.Id, docNumber: inv.DocNumber ?? null },
    });
  }

  return {
    records,
    documents,
    nextCursor: {
      customerStart: customerStart + customerRows.length,
      invoiceStart: invoiceStart + invoiceRows.length,
      syncedAt: nowIso(),
    },
    notes: [`QuickBooks rows synced: ${records.length}`],
    events,
  };
}

async function pullProviderSyncData(
  providerKey: ProviderKey,
  credential: ProviderCredentialPayload,
  cursorState: Record<string, unknown>,
): Promise<SyncPullResult> {
  const token = typeof credential.access_token === "string" ? credential.access_token : "";
  if (!token) {
    throw new Error("Missing access token");
  }
  if (providerKey === "slack") {
    return await pullSlackSyncData(token, cursorState);
  }
  if (providerKey === "google_drive") {
    return await pullDriveSyncData(token, cursorState);
  }
  if (providerKey === "gmail") {
    return await pullGmailSyncData(token, cursorState);
  }
  if (providerKey === "google_calendar") {
    return await pullCalendarSyncData(token, cursorState);
  }
  if (providerKey === "zoom") {
    const q = new URLSearchParams();
    q.set("type", "upcoming");
    q.set("page_size", "50");
    const out = await providerRequest(
      "GET",
      `https://api.zoom.us/v2/users/me/meetings?${q.toString()}`,
      token,
    );
    const meetings = Array.isArray(out.meetings) ? out.meetings : [];
    const now = nowIso();
    const records: SyncEntityRecord[] = meetings.slice(0, 100).map((item) => {
      const m = asObject(item);
      return {
        entityType: "meeting",
        externalId: String(m.id ?? crypto.randomUUID()),
        payload: m,
      };
    });
    const documents: SyncDocumentRecord[] = meetings.slice(0, 100).map((item) => {
      const m = asObject(item);
      const meetingId = String(m.id ?? crypto.randomUUID());
      return {
        externalId: `meeting:${meetingId}`,
        title: String(m.topic ?? "Zoom meeting"),
        snippet: String(m.agenda ?? ""),
        content:
          `Topic: ${String(m.topic ?? "Zoom meeting")}\n` +
          `Start: ${String(m.start_time ?? "")}\n` +
          `DurationMinutes: ${String(m.duration ?? "")}`,
        metadata: {
          provider: "zoom",
          meetingId,
          startTime: m.start_time ?? null,
          duration: m.duration ?? null,
          joinUrl: m.join_url ?? null,
        },
      };
    });
    return {
      records,
      documents,
      nextCursor: cursorState,
      notes: [`zoom meetings fetched=${meetings.length} at=${now}`],
    };
  }
  if (providerKey === "hubspot") {
    return await pullHubspotSyncData(token, cursorState);
  }
  const realmId = typeof credential.realm_id === "string" ? credential.realm_id : "";
  if (!realmId) throw new Error("QuickBooks credential missing realm_id");
  return await pullQuickbooksSyncData(token, realmId, cursorState);
}

async function providerToolExecute(
  _providerKey: ProviderKey,
  toolId: string,
  credential: ProviderCredentialPayload,
  args: Record<string, unknown>,
): Promise<{ result: Record<string, unknown>; citations: ToolCitation[] }> {
  const accessToken = typeof credential.access_token === "string" ? credential.access_token : "";
  if (!accessToken) {
    throw new Error("Missing access token");
  }

  if (toolId === "slack.send_message") {
    const channel = String(args.channel ?? "");
    const text = String(args.text ?? "");
    const out = await providerRequest(
      "POST",
      "https://slack.com/api/chat.postMessage",
      accessToken,
      { channel, text },
    );
    const messageTs = typeof out.ts === "string" ? out.ts : "";
    return {
      result: { channel, ts: messageTs, ok: out.ok ?? true },
      citations: [toolCitation("slack", `message:${channel}:${messageTs}`, text)],
    };
  }

  if (toolId === "slack.fetch_channel_messages") {
    const channel = String(args.channel ?? "");
    const limit = Number(args.limit ?? 20);
    const out = await providerRequest(
      "GET",
      `https://slack.com/api/conversations.history?channel=${
        encodeURIComponent(channel)
      }&limit=${Math.max(1, Math.min(200, limit))}`,
      accessToken,
    );
    const messages = Array.isArray(out.messages) ? out.messages : [];
    const citations = messages.slice(0, 5).map((m) => {
      const msg = asObject(m);
      const ts = typeof msg.ts === "string" ? msg.ts : crypto.randomUUID();
      const text = typeof msg.text === "string" ? msg.text : "";
      return toolCitation("slack", `${channel}:${ts}`, text);
    });
    return { result: { channel, messages }, citations };
  }

  if (toolId === "slack.list_channels") {
    const limit = Math.max(1, Math.min(100, Number(args.limit ?? 50)));
    const cursor = typeof args.cursor === "string" ? args.cursor : "";
    const q = new URLSearchParams();
    q.set("limit", String(limit));
    q.set("types", "public_channel,private_channel");
    if (cursor) q.set("cursor", cursor);
    const out = await providerRequest(
      "GET",
      `https://slack.com/api/conversations.list?${q.toString()}`,
      accessToken,
    );
    const channels = Array.isArray(out.channels) ? out.channels : [];
    return {
      result: {
        channels,
        nextCursor: asObject(out.response_metadata).next_cursor ?? null,
      },
      citations: channels.slice(0, 5).map((c) => {
        const channel = asObject(c);
        return toolCitation("slack", String(channel.id ?? crypto.randomUUID()), String(channel.name ?? ""));
      }),
    };
  }

  if (toolId === "slack.fetch_thread_replies") {
    const channel = String(args.channel ?? "");
    const threadTs = String(args.threadTs ?? "");
    const limit = Math.max(1, Math.min(100, Number(args.limit ?? 20)));
    const out = await providerRequest(
      "GET",
      `https://slack.com/api/conversations.replies?channel=${
        encodeURIComponent(channel)
      }&ts=${encodeURIComponent(threadTs)}&limit=${limit}`,
      accessToken,
    );
    const messages = Array.isArray(out.messages) ? out.messages : [];
    return {
      result: { channel, threadTs, messages },
      citations: messages.slice(0, 5).map((m) => {
        const msg = asObject(m);
        return toolCitation("slack", `${channel}:${msg.ts ?? crypto.randomUUID()}`, String(msg.text ?? ""));
      }),
    };
  }

  if (toolId === "slack.list_users") {
    const limit = Math.max(1, Math.min(200, Number(args.limit ?? 100)));
    const cursor = typeof args.cursor === "string" ? args.cursor : "";
    const q = new URLSearchParams();
    q.set("limit", String(limit));
    if (cursor) q.set("cursor", cursor);
    const out = await providerRequest(
      "GET",
      `https://slack.com/api/users.list?${q.toString()}`,
      accessToken,
    );
    const members = Array.isArray(out.members) ? out.members : [];
    return {
      result: {
        members,
        nextCursor: asObject(out.response_metadata).next_cursor ?? null,
      },
      citations: members.slice(0, 5).map((u) => {
        const user = asObject(u);
        return toolCitation("slack", String(user.id ?? crypto.randomUUID()), String(user.real_name ?? user.name ?? ""));
      }),
    };
  }

  if (toolId === "slack.update_message") {
    const channel = String(args.channel ?? "");
    const ts = String(args.ts ?? "");
    const text = String(args.text ?? "");
    const out = await providerRequest(
      "POST",
      "https://slack.com/api/chat.update",
      accessToken,
      { channel, ts, text },
    );
    return {
      result: { channel, ts, ok: out.ok ?? true },
      citations: [toolCitation("slack", `${channel}:${ts}`, text)],
    };
  }

  if (toolId === "slack.delete_message") {
    const channel = String(args.channel ?? "");
    const ts = String(args.ts ?? "");
    const out = await providerRequest(
      "POST",
      "https://slack.com/api/chat.delete",
      accessToken,
      { channel, ts },
    );
    return {
      result: { channel, ts, ok: out.ok ?? true },
      citations: [toolCitation("slack", `${channel}:${ts}`)],
    };
  }

  if (toolId === "slack.add_reaction") {
    const channel = String(args.channel ?? "");
    const ts = String(args.ts ?? "");
    const name = String(args.name ?? "");
    const out = await providerRequest(
      "POST",
      "https://slack.com/api/reactions.add",
      accessToken,
      { channel, timestamp: ts, name },
    );
    return {
      result: { channel, ts, name, ok: out.ok ?? true },
      citations: [toolCitation("slack", `${channel}:${ts}`, `:${name}:`)],
    };
  }

  if (toolId === "google_drive.search_files") {
    const query = typeof args.query === "string" ? args.query : "";
    const pageSize = Math.max(1, Math.min(200, Number(args.pageSize ?? 50)));
    const params = new URLSearchParams();
    params.set("pageSize", String(pageSize));
    params.set("fields", "files(id,name,mimeType,modifiedTime,webViewLink)");
    if (query) params.set("q", query);
    const out = await providerRequest(
      "GET",
      `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
      accessToken,
    );
    const files = Array.isArray(out.files) ? out.files : [];
    const citations = files.slice(0, 5).map((f) => {
      const file = asObject(f);
      return toolCitation(
        "google_drive",
        String(file.id ?? crypto.randomUUID()),
        String(file.name ?? ""),
      );
    });
    return { result: { files }, citations };
  }

  if (toolId === "google_drive.fetch_file_metadata") {
    const fileId = String(args.fileId ?? "");
    const out = await providerRequest(
      "GET",
      `https://www.googleapis.com/drive/v3/files/${
        encodeURIComponent(fileId)
      }?fields=id,name,mimeType,modifiedTime,webViewLink,owners(displayName,emailAddress)`,
      accessToken,
    );
    return {
      result: out,
      citations: [toolCitation("google_drive", fileId, String(out.name ?? ""))],
    };
  }

  if (toolId === "google_drive.fetch_file_content") {
    const fileId = String(args.fileId ?? "");
    const mimeType = typeof args.mimeType === "string" ? args.mimeType : "";
    const isGoogleDoc = mimeType.startsWith("application/vnd.google-apps");
    const fetchText = async (url: string) => {
      const res = await fetchWithRetry(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      }, 3);
      if (!res.ok) {
        const err = await parseJsonSafe(res);
        throw new Error(`provider request failed (${res.status}) ${String(err.error ?? err.message ?? "request failed")}`);
      }
      return await res.text();
    };
    if (isGoogleDoc) {
      const exportMimeType = mimeType === "application/vnd.google-apps.spreadsheet"
        ? "text/csv"
        : "text/plain";
      const out = await fetchText(
        `https://www.googleapis.com/drive/v3/files/${
          encodeURIComponent(fileId)
        }/export?mimeType=${encodeURIComponent(exportMimeType)}`,
      );
      return {
        result: { fileId, exportMimeType, content: out.slice(0, 50000) },
        citations: [toolCitation("google_drive", fileId)],
      };
    }
    const out = await fetchText(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    );
    return {
      result: { fileId, content: out.slice(0, 50000) },
      citations: [toolCitation("google_drive", fileId)],
    };
  }

  if (toolId === "google_drive.list_revisions") {
    const fileId = String(args.fileId ?? "");
    const pageSize = Math.max(1, Math.min(100, Number(args.pageSize ?? 30)));
    const out = await providerRequest(
      "GET",
      `https://www.googleapis.com/drive/v3/files/${
        encodeURIComponent(fileId)
      }/revisions?pageSize=${pageSize}`,
      accessToken,
    );
    const revisions = Array.isArray(out.revisions) ? out.revisions : [];
    return {
      result: { fileId, revisions },
      citations: revisions.slice(0, 5).map((r) => {
        const rev = asObject(r);
        return toolCitation("google_drive", `${fileId}:rev:${rev.id ?? crypto.randomUUID()}`);
      }),
    };
  }

  if (toolId === "google_drive.create_folder") {
    const name = String(args.name ?? "").trim();
    const parentId = typeof args.parentId === "string" ? args.parentId.trim() : "";
    const payload: Record<string, unknown> = {
      name,
      mimeType: "application/vnd.google-apps.folder",
    };
    if (parentId) payload.parents = [parentId];
    const out = await providerRequest(
      "POST",
      "https://www.googleapis.com/drive/v3/files",
      accessToken,
      payload,
    );
    return {
      result: out,
      citations: [toolCitation("google_drive", String(out.id ?? crypto.randomUUID()), name)],
    };
  }

  if (toolId === "google_drive.update_file_metadata") {
    const fileId = String(args.fileId ?? "");
    const payload: Record<string, unknown> = {};
    if (typeof args.name === "string") payload.name = args.name;
    if (typeof args.description === "string") payload.description = args.description;
    const out = await providerRequest(
      "PATCH",
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
      accessToken,
      payload,
    );
    return {
      result: out,
      citations: [toolCitation("google_drive", fileId, String(out.name ?? ""))],
    };
  }

  if (toolId === "google_drive.create_permission") {
    const fileId = String(args.fileId ?? "");
    const role = String(args.role ?? "reader");
    const type = String(args.type ?? "user");
    const emailAddress = typeof args.emailAddress === "string" ? args.emailAddress : undefined;
    const payload: Record<string, unknown> = { role, type };
    if (emailAddress) payload.emailAddress = emailAddress;
    const out = await providerRequest(
      "POST",
      `https://www.googleapis.com/drive/v3/files/${
        encodeURIComponent(fileId)
      }/permissions?sendNotificationEmail=false`,
      accessToken,
      payload,
    );
    return {
      result: out,
      citations: [toolCitation("google_drive", `${fileId}:permission:${out.id ?? crypto.randomUUID()}`)],
    };
  }

  if (toolId === "gmail.send_email") {
    const to = String(args.to ?? "");
    const subject = String(args.subject ?? "");
    const body = String(args.body ?? "");
    const raw = encodeGmailRaw(to, subject, body);
    const out = await providerRequest(
      "POST",
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      accessToken,
      { raw },
    );
    return {
      result: { id: out.id ?? null, threadId: out.threadId ?? null, to, subject },
      citations: [toolCitation("gmail", String(out.id ?? crypto.randomUUID()), subject)],
    };
  }

  if (toolId === "gmail.search_messages") {
    const query = typeof args.query === "string" ? args.query : "";
    const maxResults = Math.max(1, Math.min(100, Number(args.maxResults ?? 20)));
    const params = new URLSearchParams();
    params.set("maxResults", String(maxResults));
    if (query) params.set("q", query);
    const out = await providerRequest(
      "GET",
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
      accessToken,
    );
    const listedMessages = Array.isArray(out.messages) ? out.messages : [];
    const enrichedMessages: Record<string, unknown>[] = [];
    const metadataFetchLimit = Math.min(listedMessages.length, Math.min(maxResults, 10));
    for (const rawMsg of listedMessages.slice(0, metadataFetchLimit)) {
      const msg = asObject(rawMsg);
      const id = typeof msg.id === "string" ? msg.id : "";
      if (!id) continue;
      try {
        const detail = await providerRequest(
          "GET",
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${
            encodeURIComponent(id)
          }?format=metadata`,
          accessToken,
        );
        const payload = asObject(detail.payload);
        const headers = Array.isArray(payload.headers) ? payload.headers : [];
        const headerMap: Record<string, string> = {};
        for (const h of headers) {
          const headerObj = asObject(h);
          if (typeof headerObj.name === "string" && typeof headerObj.value === "string") {
            headerMap[headerObj.name.toLowerCase()] = headerObj.value;
          }
        }
        enrichedMessages.push({
          id,
          threadId: detail.threadId ?? msg.threadId ?? null,
          subject: headerMap.subject ?? "(no subject)",
          from: headerMap.from ?? "",
          snippet: typeof detail.snippet === "string" ? detail.snippet : "",
          internalDate: detail.internalDate ?? null,
          labelIds: Array.isArray(detail.labelIds) ? detail.labelIds : [],
        });
      } catch {
        enrichedMessages.push({
          id,
          threadId: msg.threadId ?? null,
          subject: "(unavailable)",
          from: "",
          snippet: "",
          internalDate: null,
        });
      }
    }
    return {
      result: {
        ...out,
        messages: enrichedMessages,
      },
      citations: enrichedMessages.slice(0, 5).map((m) => {
        const msg = asObject(m);
        return toolCitation("gmail", String(msg.id ?? crypto.randomUUID()));
      }),
    };
  }

  if (toolId === "gmail.get_message") {
    const messageId = String(args.messageId ?? "");
    const format = typeof args.format === "string" ? args.format : "full";
    const out = await providerRequest(
      "GET",
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${
        encodeURIComponent(messageId)
      }?format=${encodeURIComponent(format)}`,
      accessToken,
    );
    return {
      result: out,
      citations: [toolCitation("gmail", messageId, String(out.snippet ?? ""))],
    };
  }

  if (toolId === "gmail.get_thread") {
    const threadId = String(args.threadId ?? "");
    const format = typeof args.format === "string" ? args.format : "full";
    const out = await providerRequest(
      "GET",
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${
        encodeURIComponent(threadId)
      }?format=${encodeURIComponent(format)}`,
      accessToken,
    );
    const messages = Array.isArray(out.messages) ? out.messages : [];
    return {
      result: out,
      citations: messages.slice(0, 5).map((m) => {
        const msg = asObject(m);
        return toolCitation("gmail", String(msg.id ?? crypto.randomUUID()));
      }),
    };
  }

  if (toolId === "gmail.list_labels") {
    const out = await providerRequest(
      "GET",
      "https://gmail.googleapis.com/gmail/v1/users/me/labels",
      accessToken,
    );
    const labels = Array.isArray(out.labels) ? out.labels : [];
    return {
      result: { labels },
      citations: labels.slice(0, 10).map((l) => {
        const label = asObject(l);
        return toolCitation("gmail", `label:${label.id ?? crypto.randomUUID()}`, String(label.name ?? ""));
      }),
    };
  }

  if (toolId === "gmail.create_draft") {
    const to = String(args.to ?? "");
    const subject = String(args.subject ?? "");
    const body = String(args.body ?? "");
    const raw = encodeGmailRaw(to, subject, body);
    const out = await providerRequest(
      "POST",
      "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
      accessToken,
      { message: { raw } },
    );
    return {
      result: out,
      citations: [toolCitation("gmail", String(asObject(out.message).id ?? crypto.randomUUID()), subject)],
    };
  }

  if (toolId === "gmail.modify_message_labels") {
    const messageId = String(args.messageId ?? "");
    const addLabelIds = Array.isArray(args.addLabelIds) ? args.addLabelIds.map((x) => String(x)) : [];
    const removeLabelIds = Array.isArray(args.removeLabelIds) ? args.removeLabelIds.map((x) => String(x)) : [];
    const out = await providerRequest(
      "POST",
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/modify`,
      accessToken,
      { addLabelIds, removeLabelIds },
    );
    return {
      result: out,
      citations: [toolCitation("gmail", messageId)],
    };
  }

  if (toolId === "google_calendar.list_events") {
    const calendarId = String(args.calendarId ?? "primary");
    const maxResults = Math.max(1, Math.min(250, Number(args.maxResults ?? 50)));
    const params = new URLSearchParams();
    params.set("singleEvents", "true");
    params.set("orderBy", "startTime");
    params.set("maxResults", String(maxResults));
    if (typeof args.timeMin === "string") params.set("timeMin", args.timeMin);
    if (typeof args.timeMax === "string") params.set("timeMax", args.timeMax);
    const out = await providerRequest(
      "GET",
      `https://www.googleapis.com/calendar/v3/calendars/${
        encodeURIComponent(calendarId)
      }/events?${params.toString()}`,
      accessToken,
    );
    const items = Array.isArray(out.items) ? out.items : [];
    return {
      result: { calendarId, items },
      citations: items.slice(0, 5).map((it) => {
        const obj = asObject(it);
        return toolCitation(
          "google_calendar",
          `${calendarId}:${obj.id ?? crypto.randomUUID()}`,
          String(obj.summary ?? ""),
        );
      }),
    };
  }

  if (toolId === "google_calendar.get_event") {
    const calendarId = String(args.calendarId ?? "primary");
    const eventId = String(args.eventId ?? "");
    const out = await providerRequest(
      "GET",
      `https://www.googleapis.com/calendar/v3/calendars/${
        encodeURIComponent(calendarId)
      }/events/${encodeURIComponent(eventId)}`,
      accessToken,
    );
    return {
      result: out,
      citations: [toolCitation("google_calendar", `${calendarId}:${eventId}`, String(out.summary ?? ""))],
    };
  }

  if (toolId === "google_calendar.list_calendars") {
    const maxResults = Math.max(1, Math.min(100, Number(args.maxResults ?? 50)));
    const out = await providerRequest(
      "GET",
      `https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=${maxResults}`,
      accessToken,
    );
    const items = Array.isArray(out.items) ? out.items : [];
    return {
      result: { items },
      citations: items.slice(0, 10).map((it) => {
        const cal = asObject(it);
        return toolCitation("google_calendar", String(cal.id ?? crypto.randomUUID()), String(cal.summary ?? ""));
      }),
    };
  }

  if (toolId === "google_calendar.create_event") {
    const calendarId = String(args.calendarId ?? "primary");
    const startRaw = String(args.start ?? "");
    const endRaw = String(args.end ?? "");
    const allDay = args.allDay === true ||
      (/^\d{4}-\d{2}-\d{2}$/.test(startRaw) && /^\d{4}-\d{2}-\d{2}$/.test(endRaw));
    const payload: Record<string, unknown> = {
      summary: String(args.summary ?? ""),
      description: typeof args.description === "string" ? args.description : undefined,
      start: allDay ? { date: startRaw } : { dateTime: startRaw },
      end: allDay ? { date: endRaw } : { dateTime: endRaw },
    };
    const attendeeList: Array<{ email: string }> = [];
    if (Array.isArray(args.attendees)) {
      for (const a of args.attendees) {
        if (typeof a === "string" && a.includes("@")) {
          attendeeList.push({ email: a.trim() });
        } else if (typeof a === "object" && a !== null && typeof (a as { email?: unknown }).email === "string") {
          attendeeList.push({ email: String((a as { email: string }).email).trim() });
        }
      }
    }
    if (attendeeList.length > 0) {
      payload.attendees = attendeeList;
    }
    const sendInvites = args.sendCalendarInvites !== false && attendeeList.length > 0;
    const eventsUrl = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    );
    eventsUrl.searchParams.set("sendUpdates", sendInvites ? "all" : "none");
    const out = await providerRequest(
      "POST",
      eventsUrl.toString(),
      accessToken,
      payload,
    );
    return {
      result: out,
      citations: [toolCitation("google_calendar", `${calendarId}:${out.id ?? crypto.randomUUID()}`, String(out.summary ?? ""))],
    };
  }

  if (toolId === "google_calendar.update_event") {
    const calendarId = String(args.calendarId ?? "primary");
    const eventId = String(args.eventId ?? "");
    const patch: Record<string, unknown> = {};
    if (typeof args.summary === "string") patch.summary = args.summary;
    if (typeof args.description === "string") patch.description = args.description;
    if (typeof args.start === "string") {
      patch.start = /^\d{4}-\d{2}-\d{2}$/.test(args.start) ? { date: args.start } : { dateTime: args.start };
    }
    if (typeof args.end === "string") {
      patch.end = /^\d{4}-\d{2}-\d{2}$/.test(args.end) ? { date: args.end } : { dateTime: args.end };
    }
    const out = await providerRequest(
      "PATCH",
      `https://www.googleapis.com/calendar/v3/calendars/${
        encodeURIComponent(calendarId)
      }/events/${encodeURIComponent(eventId)}`,
      accessToken,
      patch,
    );
    return {
      result: out,
      citations: [toolCitation("google_calendar", `${calendarId}:${eventId}`, String(out.summary ?? ""))],
    };
  }

  if (toolId === "google_calendar.delete_event") {
    const calendarId = String(args.calendarId ?? "primary");
    const eventId = String(args.eventId ?? "");
    await providerRequest(
      "DELETE",
      `https://www.googleapis.com/calendar/v3/calendars/${
        encodeURIComponent(calendarId)
      }/events/${encodeURIComponent(eventId)}`,
      accessToken,
    );
    return {
      result: { deleted: true, calendarId, eventId },
      citations: [toolCitation("google_calendar", `${calendarId}:${eventId}`)],
    };
  }

  if (toolId === "zoom.list_meetings") {
    const userId = String(args.userId ?? "me");
    const type = String(args.type ?? "upcoming");
    const pageSize = clampInt(args.pageSize, 20, 1, 100);
    const q = new URLSearchParams();
    q.set("type", type);
    q.set("page_size", String(pageSize));
    const out = await providerRequest(
      "GET",
      `https://api.zoom.us/v2/users/${encodeURIComponent(userId)}/meetings?${q.toString()}`,
      accessToken,
    );
    const meetings = Array.isArray(out.meetings) ? out.meetings : [];
    return {
      result: { userId, type, meetings },
      citations: meetings.slice(0, 10).map((item) => {
        const meeting = asObject(item);
        const meetingId = String(meeting.id ?? crypto.randomUUID());
        return toolCitation("zoom", `${userId}:${meetingId}`, String(meeting.topic ?? ""));
      }),
    };
  }

  if (toolId === "zoom.create_meeting") {
    const userId = String(args.userId ?? "me");
    const topic = String(args.topic ?? "");
    const startTime = typeof args.startTime === "string" ? args.startTime : undefined;
    const durationMinutes = Number.isFinite(Number(args.durationMinutes))
      ? clampInt(args.durationMinutes, 30, 1, 600)
      : undefined;
    const timezone = typeof args.timezone === "string" ? args.timezone : undefined;
    const agenda = typeof args.agenda === "string" ? args.agenda : undefined;
    const payload: Record<string, unknown> = {
      topic,
      type: startTime ? 2 : 1,
      agenda,
    };
    if (startTime) payload.start_time = startTime;
    if (durationMinutes !== undefined) payload.duration = durationMinutes;
    if (timezone) payload.timezone = timezone;
    const out = await providerRequest(
      "POST",
      `https://api.zoom.us/v2/users/${encodeURIComponent(userId)}/meetings`,
      accessToken,
      payload,
    );
    return {
      result: out,
      citations: [toolCitation("zoom", `${userId}:${String(out.id ?? crypto.randomUUID())}`, String(out.topic ?? topic))],
    };
  }

  if (toolId === "hubspot.search_records") {
    const objectType = String(args.objectType ?? "contacts");
    const query = typeof args.query === "string" ? args.query : "";
    const limit = Math.max(1, Math.min(100, Number(args.limit ?? 20)));
    const body: Record<string, unknown> = { limit };
    if (query) body.query = query;
    const out = await providerRequest(
      "POST",
      `https://api.hubapi.com/crm/v3/objects/${encodeURIComponent(objectType)}/search`,
      accessToken,
      body,
    );
    return {
      result: out,
      citations: (Array.isArray(out.results) ? out.results : []).slice(0, 5).map((x) => {
        const obj = asObject(x);
        return toolCitation("hubspot", `${objectType}:${obj.id ?? crypto.randomUUID()}`);
      }),
    };
  }

  if (toolId === "hubspot.get_record") {
    const objectType = String(args.objectType ?? "contacts");
    const recordId = String(args.recordId ?? "");
    const out = await providerRequest(
      "GET",
      `https://api.hubapi.com/crm/v3/objects/${
        encodeURIComponent(objectType)
      }/${encodeURIComponent(recordId)}`,
      accessToken,
    );
    return {
      result: out,
      citations: [toolCitation("hubspot", `${objectType}:${recordId}`)],
    };
  }

  if (toolId === "hubspot.upsert_contact") {
    const email = String(args.email ?? "");
    const props: Record<string, unknown> = {
      email,
    };
    if (typeof args.firstname === "string") props.firstname = args.firstname;
    if (typeof args.lastname === "string") props.lastname = args.lastname;
    if (typeof args.phone === "string") props.phone = args.phone;
    const search = await providerRequest(
      "POST",
      "https://api.hubapi.com/crm/v3/objects/contacts/search",
      accessToken,
      {
        filterGroups: [{
          filters: [{ propertyName: "email", operator: "EQ", value: email }],
        }],
        limit: 1,
        properties: ["email", "firstname", "lastname", "phone"],
      },
    );
    const first = Array.isArray(search.results) && search.results.length > 0
      ? asObject(search.results[0])
      : null;
    const contactId = first && typeof first.id === "string" ? first.id : "";
    const out = contactId
      ? await providerRequest(
        "PATCH",
        `https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(contactId)}`,
        accessToken,
        { properties: props },
      )
      : await providerRequest(
        "POST",
        "https://api.hubapi.com/crm/v3/objects/contacts",
        accessToken,
        { properties: props },
      );
    return {
      result: out,
      citations: [toolCitation("hubspot", `contact:${out.id ?? crypto.randomUUID()}`, email)],
    };
  }

  if (toolId === "hubspot.create_contact") {
    const email = String(args.email ?? "");
    const props: Record<string, unknown> = { email };
    if (typeof args.firstname === "string") props.firstname = args.firstname;
    if (typeof args.lastname === "string") props.lastname = args.lastname;
    if (typeof args.phone === "string") props.phone = args.phone;
    const out = await providerRequest(
      "POST",
      "https://api.hubapi.com/crm/v3/objects/contacts",
      accessToken,
      { properties: props },
    );
    return {
      result: out,
      citations: [toolCitation("hubspot", `contact:${out.id ?? crypto.randomUUID()}`, email)],
    };
  }

  if (toolId === "hubspot.create_note") {
    const body = String(args.body ?? "");
    const associationType = String(args.associationType ?? "");
    const associationId = String(args.associationId ?? "");
    const payload: Record<string, unknown> = {
      properties: {
        hs_note_body: body,
        hs_timestamp: new Date().toISOString(),
      },
    };
    if (associationType && associationId) {
      payload.associations = [{
        to: { id: associationId },
        types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: Number(associationType) || 0 }],
      }];
    }
    const out = await providerRequest(
      "POST",
      "https://api.hubapi.com/crm/v3/objects/notes",
      accessToken,
      payload,
    );
    return {
      result: out,
      citations: [toolCitation("hubspot", `note:${out.id ?? crypto.randomUUID()}`, body)],
    };
  }

  if (toolId === "hubspot.update_deal_stage") {
    const dealId = String(args.dealId ?? "");
    const dealstage = String(args.dealstage ?? "");
    const out = await providerRequest(
      "PATCH",
      `https://api.hubapi.com/crm/v3/objects/deals/${encodeURIComponent(dealId)}`,
      accessToken,
      { properties: { dealstage } },
    );
    return {
      result: out,
      citations: [toolCitation("hubspot", `deal:${dealId}`, dealstage)],
    };
  }

  if (toolId === "hubspot.create_deal") {
    const dealname = String(args.dealname ?? "");
    const dealstage = String(args.dealstage ?? "");
    const props: Record<string, unknown> = { dealname, dealstage };
    if (typeof args.pipeline === "string") props.pipeline = args.pipeline;
    if (typeof args.amount === "string") props.amount = args.amount;
    const out = await providerRequest(
      "POST",
      "https://api.hubapi.com/crm/v3/objects/deals",
      accessToken,
      { properties: props },
    );
    return {
      result: out,
      citations: [toolCitation("hubspot", `deal:${out.id ?? crypto.randomUUID()}`, dealname)],
    };
  }

  const realmId = typeof credential.realm_id === "string" ? credential.realm_id : "";
  if (!realmId) throw new Error("QuickBooks realm_id missing");

  if (toolId === "quickbooks.list_customers") {
    const page = Math.max(1, Number(args.page ?? 1));
    const pageSize = Math.max(1, Math.min(100, Number(args.pageSize ?? 50)));
    const start = (page - 1) * pageSize + 1;
    const sql = `SELECT Id, DisplayName, PrimaryEmailAddr FROM Customer STARTPOSITION ${start} MAXRESULTS ${pageSize}`;
    const out = await quickbooksQuery(accessToken, realmId, sql);
    const queryResponse = asObject(out.QueryResponse);
    const customers = Array.isArray(queryResponse.Customer) ? queryResponse.Customer as unknown[] : [];
    return {
      result: out,
      citations: customers.slice(0, 5).map((c) => {
        const obj = asObject(c);
        return toolCitation("quickbooks", `customer:${obj.Id ?? crypto.randomUUID()}`, String(obj.DisplayName ?? ""));
      }),
    };
  }

  if (toolId === "quickbooks.list_invoices") {
    const page = Math.max(1, Number(args.page ?? 1));
    const pageSize = Math.max(1, Math.min(100, Number(args.pageSize ?? 50)));
    const start = (page - 1) * pageSize + 1;
    const sql = `SELECT Id, DocNumber, TotalAmt, Balance, TxnDate, PrivateNote FROM Invoice STARTPOSITION ${start} MAXRESULTS ${pageSize}`;
    const out = await quickbooksQuery(accessToken, realmId, sql);
    const queryResponse = asObject(out.QueryResponse);
    const invoices = Array.isArray(queryResponse.Invoice) ? queryResponse.Invoice as unknown[] : [];
    return {
      result: out,
      citations: invoices.slice(0, 5).map((inv) => {
        const obj = asObject(inv);
        return toolCitation("quickbooks", `invoice:${obj.Id ?? crypto.randomUUID()}`, String(obj.DocNumber ?? ""));
      }),
    };
  }

  if (toolId === "quickbooks.get_invoice") {
    const invoiceId = String(args.invoiceId ?? "");
    const out = await providerRequest(
      "GET",
      `https://quickbooks.api.intuit.com/v3/company/${encodeURIComponent(realmId)}/invoice/${
        encodeURIComponent(invoiceId)
      }?minorversion=65`,
      accessToken,
      undefined,
      { Accept: "application/json" },
    );
    return {
      result: out,
      citations: [toolCitation("quickbooks", `invoice:${invoiceId}`)],
    };
  }

  if (toolId === "quickbooks.create_customer") {
    const displayName = String(args.displayName ?? "");
    const email = typeof args.email === "string" ? args.email : "";
    const payload: Record<string, unknown> = { DisplayName: displayName };
    if (email) payload.PrimaryEmailAddr = { Address: email };
    const out = await providerRequest(
      "POST",
      `https://quickbooks.api.intuit.com/v3/company/${encodeURIComponent(realmId)}/customer?minorversion=65`,
      accessToken,
      payload,
      { Accept: "application/json" },
    );
    return {
      result: out,
      citations: [toolCitation("quickbooks", `customer:${asObject(out.Customer).Id ?? crypto.randomUUID()}`, displayName)],
    };
  }

  if (toolId === "quickbooks.create_invoice") {
    const customerId = String(args.customerId ?? "");
    const totalAmt = Number(args.totalAmt ?? 0);
    const privateNote = typeof args.privateNote === "string" ? args.privateNote : "";
    const payload: Record<string, unknown> = {
      CustomerRef: { value: customerId },
      Line: [{
        Amount: totalAmt,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: { value: "1" },
        },
      }],
    };
    if (privateNote) payload.PrivateNote = privateNote;
    const out = await providerRequest(
      "POST",
      `https://quickbooks.api.intuit.com/v3/company/${encodeURIComponent(realmId)}/invoice?minorversion=65`,
      accessToken,
      payload,
      { Accept: "application/json" },
    );
    const invoice = asObject(out.Invoice);
    return {
      result: out,
      citations: [toolCitation("quickbooks", `invoice:${invoice.Id ?? crypto.randomUUID()}`, String(invoice.DocNumber ?? ""))],
    };
  }

  if (toolId === "quickbooks.send_invoice_reminder") {
    const invoiceId = String(args.invoiceId ?? "");
    const out = await providerRequest(
      "POST",
      `https://quickbooks.api.intuit.com/v3/company/${
        encodeURIComponent(realmId)
      }/invoice/${encodeURIComponent(invoiceId)}/send?minorversion=65`,
      accessToken,
      undefined,
      { Accept: "application/json", "Content-Type": "application/json" },
    );
    return {
      result: out,
      citations: [toolCitation("quickbooks", `invoice:${invoiceId}`)],
    };
  }

  if (toolId === "quickbooks.update_invoice_safe_fields") {
    const invoiceId = String(args.invoiceId ?? "");
    const getResp = await providerRequest(
      "GET",
      `https://quickbooks.api.intuit.com/v3/company/${encodeURIComponent(realmId)}/invoice/${
        encodeURIComponent(invoiceId)
      }?minorversion=65`,
      accessToken,
      undefined,
      { Accept: "application/json" },
    );
    const invoice = asObject(getResp.Invoice);
    if (!invoice.Id || invoice.SyncToken === undefined) {
      throw new Error("Invoice not found");
    }
    const patch: Record<string, unknown> = {
      sparse: true,
      Id: invoice.Id,
      SyncToken: invoice.SyncToken,
    };
    if (typeof args.privateNote === "string") patch.PrivateNote = args.privateNote;
    if (typeof args.txnStatus === "string") patch.TxnStatus = args.txnStatus;
    const out = await providerRequest(
      "POST",
      `https://quickbooks.api.intuit.com/v3/company/${
        encodeURIComponent(realmId)
      }/invoice?operation=update&minorversion=65`,
      accessToken,
      patch,
      { Accept: "application/json" },
    );
    return {
      result: out,
      citations: [toolCitation("quickbooks", `invoice:${invoiceId}`)],
    };
  }

  throw new Error(`Unsupported tool: ${toolId}`);
}

function findToolDefinition(
  toolId: string,
): RuntimeToolDefinition | undefined {
  return TOOL_DEFINITIONS.find((t) => t.id === toolId);
}

/** Public lookup for intent planning / validation (ai-api, intent-agent). */
export function getRuntimeToolDefinition(
  toolId: string,
): RuntimeToolDefinition | undefined {
  return findToolDefinition(toolId);
}

export function listRuntimeToolDefinitions(): RuntimeToolDefinition[] {
  return TOOL_DEFINITIONS.map((tool) => ({
    ...tool,
    riskTier: getToolRiskTier(tool),
    roleGroup: getToolRoleGroup(tool),
  }));
}

export const runtimePolicyTestHooks = {
  getToolRiskTier,
  getToolRoleGroup,
  constrainToolArgs,
  validateToolArgs,
  canExecuteRoleGroup,
};

/**
 * Primary calendar IANA timezone from Google Calendar API (calendarList).
 * Used for intent-time resolution (provider-first).
 */
export async function getGoogleCalendarPrimaryTimezone(
  supabase: SupabaseClient,
  params: {
    companyId: string;
    masterKey: string;
  },
): Promise<{ timeZone: string | null; resolutionNote: string }> {
  const { data: rows, error } = await supabase
    .from("connectors")
    .select("id, status")
    .eq("company_id", params.companyId)
    .eq("provider_key", "google_calendar");
  if (error) throw error;
  const list = Array.isArray(rows) ? rows : [];
  const connected = list.find((c) =>
    ["connected", "healthy"].includes(String(c.status).toLowerCase())
  );
  if (!connected) {
    return { timeZone: null, resolutionNote: "no_google_calendar_connector" };
  }
  const loaded = await loadConnectorWithCredential(
    supabase,
    params.companyId,
    connected.id as string,
  );
  if (!loaded?.encrypted_payload) {
    return { timeZone: null, resolutionNote: "no_credentials" };
  }
  let credential = await decryptCredential(loaded.encrypted_payload, params.masterKey);
  credential = await refreshAccessTokenIfNeeded(supabase, {
    companyId: params.companyId,
    connectorId: connected.id as string,
    providerKey: "google_calendar",
    credential,
    masterKey: params.masterKey,
  });
  const accessToken = typeof credential.access_token === "string" ? credential.access_token : "";
  if (!accessToken) {
    return { timeZone: null, resolutionNote: "no_access_token" };
  }
  const out = await providerRequest(
    "GET",
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50",
    accessToken,
  );
  const items = Array.isArray(out.items) ? out.items : [];
  let primary: Record<string, unknown> | undefined;
  for (const it of items) {
    const o = asObject(it);
    if (o.primary === true) {
      primary = o;
      break;
    }
  }
  if (!primary) {
    for (const it of items) {
      const o = asObject(it);
      if (String(o.id ?? "") === "primary") {
        primary = o;
        break;
      }
    }
  }
  if (!primary && items.length > 0) primary = asObject(items[0]);
  const tz = typeof primary?.timeZone === "string" ? String(primary.timeZone) : null;
  return {
    timeZone: tz,
    resolutionNote: tz ? "calendar_list" : "no_timezone_in_list",
  };
}

function previewArgs(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === "string" && v.length > 250) {
      out[k] = `${v.slice(0, 250)}...`;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function constrainToolArgs(tool: RuntimeToolDefinition, args: Record<string, unknown>): Record<string, unknown> {
  const next = { ...args };
  if ("limit" in next) next.limit = clampInt(next.limit, 20, 1, 100);
  if ("maxResults" in next) next.maxResults = clampInt(next.maxResults, 20, 1, 100);
  if ("pageSize" in next) next.pageSize = clampInt(next.pageSize, 50, 1, 100);
  if ("page" in next) next.page = clampInt(next.page, 1, 1, 10_000);

  // Keep tool input bounded even if caller sends oversized payloads.
  for (const [key, value] of Object.entries(next)) {
    if (typeof value === "string" && value.length > 20_000) {
      next[key] = value.slice(0, 20_000);
    }
    if (Array.isArray(value) && value.length > 500) {
      next[key] = value.slice(0, 500);
    }
  }

  // Provider-specific minimum constraints for high-cost operations.
  if (tool.id === "gmail.search_messages") {
    next.maxResults = clampInt(next.maxResults, 20, 1, 50);
  }
  if (tool.id === "slack.fetch_channel_messages" || tool.id === "slack.fetch_thread_replies") {
    next.limit = clampInt(next.limit, 20, 1, 100);
  }
  if (tool.id === "google_calendar.list_events") {
    next.maxResults = clampInt(next.maxResults, 50, 1, 150);
  }
  if (tool.id === "zoom.list_meetings") {
    next.pageSize = clampInt(next.pageSize, 20, 1, 100);
  }
  return next;
}

function validateToolArgs(tool: RuntimeToolDefinition, args: Record<string, unknown>): void {
  for (const [argName, shape] of Object.entries(tool.argsShape ?? {})) {
    const optional = shape.includes("?");
    if (!optional && (args[argName] === undefined || args[argName] === null || args[argName] === "")) {
      throw new Error(`Missing required argument: ${argName}`);
    }
  }
  if (tool.id === "google_drive.create_permission") {
    const type = String(args.type ?? "user");
    if (["user", "group"].includes(type) && typeof args.emailAddress !== "string") {
      throw new Error("emailAddress is required for user/group permissions");
    }
  }
  if (tool.id === "quickbooks.create_invoice") {
    const totalAmt = Number(args.totalAmt ?? 0);
    if (!Number.isFinite(totalAmt) || totalAmt <= 0) {
      throw new Error("totalAmt must be a positive number");
    }
  }
  if (tool.id === "zoom.create_meeting") {
    const durationMinutes = Number(args.durationMinutes ?? 30);
    if (!Number.isFinite(durationMinutes) || durationMinutes < 1 || durationMinutes > 600) {
      throw new Error("durationMinutes must be between 1 and 600");
    }
  }
}

export function listProviderCatalog(): ProviderCatalogItem[] {
  return PROVIDER_CATALOG.map((x) => ({ ...x }));
}

export async function oauthStart(
  supabase: SupabaseClient,
  params: {
    companyId: string;
    userId: string;
    providerKey: ProviderKey;
    connectorId?: string;
  },
): Promise<{ connectorId: string; authUrl: string; state: string; providerKey: ProviderKey; expiresAt: string }> {
  const redirectUri = envRequired("INTEGRATIONS_OAUTH_REDIRECT_URI");
  const connector = params.connectorId
    ? await loadConnectorWithCredential(supabase, params.companyId, params.connectorId)
    : await ensureConnector(supabase, params.companyId, params.providerKey);

  if (!connector?.id) {
    throw new Error("Connector not found");
  }
  if (connector.provider_key !== params.providerKey) {
    throw new Error("Connector/provider mismatch");
  }

  const oauth = getOAuthConfig(params.providerKey);
  const state = crypto.randomUUID();
  const statePayload: OAuthStatePayload = {
    providerKey: params.providerKey,
    connectorId: connector.id,
    userId: params.userId,
    redirectUri,
    createdAt: nowIso(),
  };

  await supabase.from("connector_runtime_state").upsert({
    company_id: params.companyId,
    connector_id: connector.id,
    state_key: `oauth_state:${state}`,
    state_json: statePayload,
    updated_at: nowIso(),
  }, { onConflict: "connector_id,state_key" });

  const url = new URL(oauth.authUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", oauth.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", oauth.scopes.join(" "));
  url.searchParams.set("state", state);
  for (const [k, v] of Object.entries(oauth.extraAuthParams ?? {})) {
    url.searchParams.set(k, v);
  }
  if (oauth.provider === "quickbooks") {
    url.searchParams.set("response_type", "code");
  }

  return {
    connectorId: connector.id,
    authUrl: url.toString(),
    state,
    providerKey: params.providerKey,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };
}

export async function oauthCallback(
  supabase: SupabaseClient,
  params: {
    companyId: string;
    code: string;
    state: string;
    masterKey: string;
  },
): Promise<{ ok: true; providerKey: ProviderKey; connectorIds: string[] }> {
  const stateKey = `oauth_state:${params.state}`;
  const { data: rows, error } = await supabase
    .from("connector_runtime_state")
    .select("id, connector_id, state_json")
    .eq("company_id", params.companyId)
    .eq("state_key", stateKey)
    .limit(1);
  if (error) throw error;
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row?.connector_id) {
    throw new Error("OAuth state not found or expired");
  }

  const statePayload = asObject(row.state_json) as OAuthStatePayload;
  const connector = await loadConnectorWithCredential(
    supabase,
    params.companyId,
    String(row.connector_id),
  );
  if (!connector) throw new Error("Connector not found");

  const redirectUri = typeof statePayload.redirectUri === "string"
    ? statePayload.redirectUri
    : envRequired("INTEGRATIONS_OAUTH_REDIRECT_URI");
  const tokenPayload = await exchangeAuthCodeForToken(
    connector.provider_key,
    params.code,
    redirectUri,
  );

  let connectorIds: string[] = [];
  if (GOOGLE_PROVIDER_KEYS.includes(connector.provider_key)) {
    connectorIds = await upsertLinkedGoogleCredential(
      supabase,
      params.companyId,
      tokenPayload,
      params.masterKey,
    );
  } else {
    await upsertEncryptedCredential(supabase, {
      companyId: params.companyId,
      connectorId: connector.id,
      payload: tokenPayload,
      metadata: { oauthProvider: toOAuthProvider(connector.provider_key) },
      masterKey: params.masterKey,
    });
    connectorIds = [connector.id];
  }

  await supabase
    .from("connector_runtime_state")
    .delete()
    .eq("id", row.id);

  return {
    ok: true,
    providerKey: connector.provider_key,
    connectorIds,
  };
}

export async function connectionTest(
  supabase: SupabaseClient,
  params: {
    companyId: string;
    connectorId: string;
    masterKey: string;
  },
): Promise<{ ok: boolean; checkedAt: string; message?: string; remediation?: string; details?: Record<string, unknown> }> {
  const connector = await loadConnectorWithCredential(supabase, params.companyId, params.connectorId);
  if (!connector) {
    return {
      ok: false,
      checkedAt: nowIso(),
      message: "Connector not found",
      remediation: "Create or reconnect integration.",
    };
  }
  const credential = await decryptCredential(connector.encrypted_payload, params.masterKey);

  try {
    const fresh = await refreshAccessTokenIfNeeded(supabase, {
      companyId: params.companyId,
      connectorId: connector.id,
      providerKey: connector.provider_key,
      credential,
      masterKey: params.masterKey,
    });
    const details = await runProviderConnectionTest(connector.provider_key, fresh);
    await supabase
      .from("connectors")
      .update({
        status: "connected",
        last_error_message: null,
        last_error_remediation: null,
        updated_at: nowIso(),
      })
      .eq("id", connector.id)
      .eq("company_id", params.companyId);
    return {
      ok: true,
      checkedAt: nowIso(),
      details,
    };
  } catch (error) {
    const mapped = toConnectorStatusOnFailure(error);
    await supabase
      .from("connectors")
      .update({
        status: "error",
        last_error_message: mapped.message,
        last_error_remediation: mapped.remediation,
        updated_at: nowIso(),
      })
      .eq("id", connector.id)
      .eq("company_id", params.companyId);
    return {
      ok: false,
      checkedAt: nowIso(),
      message: mapped.message,
      remediation: mapped.remediation,
    };
  }
}

export async function syncTrigger(
  supabase: SupabaseClient,
  params: {
    companyId: string;
    userId: string;
    connectorId: string;
    idempotencyKey?: string;
    masterKey: string;
  },
): Promise<{
  run: Record<string, unknown>;
  summary: Record<string, unknown>;
}> {
  const connector = await loadConnectorWithCredential(supabase, params.companyId, params.connectorId);
  if (!connector) throw new Error("Connector not found");
  if (params.idempotencyKey) {
    const { data: dedupe } = await supabase
      .from("connector_sync_runs")
      .select("*")
      .eq("connector_id", params.connectorId)
      .eq("idempotency_key", params.idempotencyKey)
      .maybeSingle();
    if (dedupe) {
      return {
        run: dedupe as Record<string, unknown>,
        summary: asObject(dedupe.result_summary),
      };
    }
  }

  const { data: run, error: runErr } = await supabase
    .from("connector_sync_runs")
    .insert({
      company_id: params.companyId,
      connector_id: params.connectorId,
      status: "running",
      idempotency_key: params.idempotencyKey ?? null,
    })
    .select("*")
    .single();
  if (runErr) {
    const isDuplicateIdempotency = params.idempotencyKey &&
      typeof runErr === "object" &&
      runErr !== null &&
      "code" in runErr &&
      String((runErr as { code?: unknown }).code) === "23505";
    if (isDuplicateIdempotency) {
      const { data: existing } = await supabase
        .from("connector_sync_runs")
        .select("*")
        .eq("connector_id", params.connectorId)
        .eq("idempotency_key", params.idempotencyKey)
        .maybeSingle();
      if (existing) {
        return {
          run: existing as Record<string, unknown>,
          summary: asObject(existing.result_summary),
        };
      }
    }
    throw runErr;
  }
  if (!run) throw new Error("Could not start sync run");
  const runId = String(run.id);
  await appendSyncLog(supabase, runId, "info", `Starting ${providerLabel(connector.provider_key)} sync`);

  try {
    const credentialRaw = await decryptCredential(connector.encrypted_payload, params.masterKey);
    const credential = await refreshAccessTokenIfNeeded(supabase, {
      companyId: params.companyId,
      connectorId: connector.id,
      providerKey: connector.provider_key,
      credential: credentialRaw,
      masterKey: params.masterKey,
    });

    const { data: cursorState } = await supabase
      .from("connector_runtime_state")
      .select("state_json")
      .eq("company_id", params.companyId)
      .eq("connector_id", connector.id)
      .eq("state_key", "sync_cursor")
      .maybeSingle();
    const currentCursor = asObject(cursorState?.state_json);
    const pulled = await pullProviderSyncData(
      connector.provider_key,
      credential,
      currentCursor,
    );
    for (const note of pulled.notes) {
      await appendSyncLog(supabase, runId, "info", note);
    }

    let entitiesUpserted = 0;
    for (const rec of pulled.records) {
      await upsertUnifiedEntityFromRecord(
        supabase,
        params.companyId,
        connector.provider_key,
        rec,
        params.userId,
      );
      entitiesUpserted += 1;
    }

    await upsertIndexDocuments(
      supabase,
      params.companyId,
      connector.provider_key,
      pulled.documents,
    );

    await supabase.from("connector_runtime_state").upsert({
      company_id: params.companyId,
      connector_id: connector.id,
      state_key: "sync_cursor",
      state_json: pulled.nextCursor,
      updated_at: nowIso(),
    }, { onConflict: "connector_id,state_key" });

    if (Array.isArray(pulled.events)) {
      for (const evt of pulled.events) {
        await enqueueConnectorEvent(supabase, params.companyId, {
          ...evt,
          connectorId: connector.id,
        });
      }
    }

    const finishedAt = nowIso();
    const summary = {
      provider: connector.provider_key,
      recordsPulled: pulled.records.length,
      unifiedEntitiesUpserted: entitiesUpserted,
      documentsIndexed: pulled.documents.length,
      eventsQueued: Array.isArray(pulled.events) ? pulled.events.length : 0,
      cursorSaved: true,
      finishedAt,
    };
    await supabase
      .from("connector_sync_runs")
      .update({
        status: "completed",
        ended_at: finishedAt,
        result_summary: summary,
      })
      .eq("id", runId)
      .eq("company_id", params.companyId);
    await supabase
      .from("connectors")
      .update({
        status: "healthy",
        last_sync_at: finishedAt,
        last_error_message: null,
        last_error_remediation: null,
        updated_at: finishedAt,
      })
      .eq("id", connector.id)
      .eq("company_id", params.companyId);

    const payload = {
      connectorId: connector.id,
      providerKey: connector.provider_key,
      runId,
      summary,
    };
    await supabase.from("activity_logs").insert({
      company_id: params.companyId,
      event_type: "connector.sync",
      actor_user_id: params.userId,
      payload,
      redacted_payload: redactPayloadJson(payload) as Record<string, unknown>,
      connector_id: connector.id,
      metadata: { source: "integrations-runtime" },
    });
    const { data: finalRun } = await supabase
      .from("connector_sync_runs")
      .select("*")
      .eq("id", runId)
      .maybeSingle();
    return { run: asObject(finalRun), summary };
  } catch (error) {
    const mapped = toConnectorStatusOnFailure(error);
    const endedAt = nowIso();
    await appendSyncLog(supabase, runId, "error", mapped.message, {
      remediation: mapped.remediation,
    });
    await supabase
      .from("connector_sync_runs")
      .update({
        status: "failed",
        ended_at: endedAt,
        result_summary: {
          error: mapped.message,
          remediation: mapped.remediation,
        },
      })
      .eq("id", runId)
      .eq("company_id", params.companyId);
    await supabase
      .from("connectors")
      .update({
        status: "error",
        last_error_message: mapped.message,
        last_error_remediation: mapped.remediation,
        updated_at: endedAt,
      })
      .eq("id", connector.id)
      .eq("company_id", params.companyId);
    throw new Error(mapped.message);
  }
}

export async function toolsList(
  supabase: SupabaseClient,
  params: {
    companyId: string;
    roles: string[];
  },
): Promise<RuntimeToolListItem[]> {
  const { data, error } = await supabase
    .from("connectors")
    .select("id, provider_key, status")
    .eq("company_id", params.companyId);
  if (error) throw error;
  const connected = (Array.isArray(data) ? data : [])
    .filter((c) => isProviderKey(String(c.provider_key)))
    .filter((c) => ["connected", "healthy"].includes(String(c.status).toLowerCase()));

  const out: RuntimeToolListItem[] = [];
  for (const c of connected) {
    const provider = c.provider_key as ProviderKey;
    for (const tool of TOOL_DEFINITIONS.filter((t) => t.providerKey === provider)) {
      const roleGroup = getToolRoleGroup(tool);
      if (tool.accessLevel === "write" && !canWriteTools(params.roles)) continue;
      if (!canExecuteRoleGroup(params.roles, roleGroup)) continue;
      out.push({
        id: tool.id,
        providerKey: provider,
        connectorId: String(c.id),
        label: tool.label,
        description: tool.description,
        accessLevel: tool.accessLevel,
        riskTier: getToolRiskTier(tool),
        requiresConfirmation: tool.requiresConfirmation,
      });
    }
  }
  return out;
}

export async function toolsExecute(
  supabase: SupabaseClient,
  params: {
    companyId: string;
    userId: string;
    roles: string[];
    toolId: string;
    args: Record<string, unknown>;
    confirmed: boolean;
    conversationId?: string;
    workflowRunId?: string;
    source: "ai_chat" | "workflow" | "integrations_api";
    masterKey: string;
  },
): Promise<RuntimeToolExecutionResult> {
  const startedAt = Date.now();
  const tool = findToolDefinition(params.toolId);
  if (!tool) throw new Error(`Unknown tool: ${params.toolId}`);
  const roleGroup = getToolRoleGroup(tool);
  const riskTier = getToolRiskTier(tool);
  if (!canExecuteRoleGroup(params.roles, roleGroup)) {
    throw new Error("Role does not permit this tool");
  }
  if (tool.accessLevel === "write" && !canWriteTools(params.roles)) {
    throw new Error("Role does not permit write tool execution");
  }
  const connector = await ensureConnector(
    supabase,
    params.companyId,
    tool.providerKey,
  );
  const loaded = await loadConnectorWithCredential(supabase, params.companyId, connector.id);
  if (!loaded?.encrypted_payload) {
    throw new Error(`Connector ${tool.providerKey} is not authorized`);
  }

  if (tool.requiresConfirmation && !params.confirmed) {
    return {
      ok: false,
      pendingConfirmation: true,
      providerKey: tool.providerKey,
      connectorId: connector.id,
      toolId: tool.id,
      riskTier,
      requiresConfirmation: true,
      preview: {
        label: tool.label,
        provider: tool.providerKey,
        riskTier,
        args: previewArgs(params.args),
      },
    };
  }

  const safeArgs = constrainToolArgs(tool, params.args);
  validateToolArgs(tool, safeArgs);
  const rawCredential = await decryptCredential(loaded.encrypted_payload, params.masterKey);
  const credential = await refreshAccessTokenIfNeeded(supabase, {
    companyId: params.companyId,
    connectorId: connector.id,
    providerKey: tool.providerKey,
    credential: rawCredential,
    masterKey: params.masterKey,
  });
  const execution = await providerToolExecute(
    tool.providerKey,
    tool.id,
    credential,
    safeArgs,
  );
  const result = execution.result;
  const citations = execution.citations;

  const auditPayload = {
    source: params.source,
    toolId: tool.id,
    providerKey: tool.providerKey,
    accessLevel: tool.accessLevel,
    roleGroup: roleGroup ?? null,
    riskTier,
    args: previewArgs(safeArgs),
    conversationId: params.conversationId ?? null,
    workflowRunId: params.workflowRunId ?? null,
    resultPreview: previewArgs(result),
    executionMs: Date.now() - startedAt,
  };

  await supabase.from("activity_logs").insert({
    company_id: params.companyId,
    event_type: "connector.tool.execute",
    actor_user_id: params.userId,
    payload: auditPayload,
    redacted_payload: redactPayloadJson(auditPayload) as Record<string, unknown>,
    connector_id: connector.id,
    workflow_run_id: params.workflowRunId ?? null,
    metadata: { source: "integrations-runtime", conversationId: params.conversationId ?? null },
  });

  await supabase.from("ai_action_logs").insert({
    company_id: params.companyId,
    user_id: params.userId,
    action_name: tool.id,
    status: "completed",
    details: {
      providerKey: tool.providerKey,
      accessLevel: tool.accessLevel,
      roleGroup: roleGroup ?? null,
      riskTier,
      executionMs: Date.now() - startedAt,
      source: params.source,
      args: previewArgs(safeArgs),
      result: previewArgs(result),
      citations,
    },
    conversation_id: params.conversationId ?? null,
  });

  return {
    ok: true,
    providerKey: tool.providerKey,
    connectorId: connector.id,
    toolId: tool.id,
    riskTier,
    requiresConfirmation: tool.requiresConfirmation,
    result,
    citations,
  };
}

export async function enqueueConnectorEvent(
  supabase: SupabaseClient,
  companyId: string,
  input: ConnectorEventInput,
): Promise<{ id: string; deduped: boolean }> {
  const row = {
    company_id: companyId,
    connector_id: input.connectorId ?? null,
    provider_key: input.providerKey,
    event_type: input.eventType,
    external_event_id: input.externalEventId,
    payload: input.payload,
    status: "pending",
    attempts: 0,
    available_at: input.availableAt ?? nowIso(),
    updated_at: nowIso(),
  };
  const { data, error } = await supabase
    .from("connector_event_queue")
    .upsert(row, {
      onConflict: "company_id,provider_key,event_type,external_event_id",
      ignoreDuplicates: false,
    })
    .select("id, status, attempts")
    .single();
  if (error) throw error;
  return {
    id: String(data.id),
    deduped: Number(data.attempts ?? 0) > 0,
  };
}

export async function dequeueConnectorEvents(
  supabase: SupabaseClient,
  companyId: string,
  limit: number,
): Promise<ConnectorEventQueueRow[]> {
  const { data, error } = await supabase
    .from("connector_event_queue")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "pending")
    .lte("available_at", nowIso())
    .order("created_at", { ascending: true })
    .limit(Math.max(1, Math.min(limit, 100)));
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  const claimed: ConnectorEventQueueRow[] = [];
  for (const r of rows) {
    const { data: upd, error: updErr } = await supabase
      .from("connector_event_queue")
      .update({
        status: "processing",
        attempts: Number(r.attempts ?? 0) + 1,
        updated_at: nowIso(),
      })
      .eq("id", r.id)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();
    if (updErr) throw updErr;
    if (upd?.id) {
      claimed.push(upd as ConnectorEventQueueRow);
    }
  }
  return claimed;
}

export async function markConnectorEventProcessed(
  supabase: SupabaseClient,
  eventId: string,
): Promise<void> {
  await supabase
    .from("connector_event_queue")
    .update({
      status: "processed",
      processed_at: nowIso(),
      error_message: null,
      updated_at: nowIso(),
    })
    .eq("id", eventId);
}

export async function markConnectorEventFailed(
  supabase: SupabaseClient,
  eventId: string,
  message: string,
  retryDelaySeconds = 45,
): Promise<void> {
  await supabase
    .from("connector_event_queue")
    .update({
      status: "pending",
      error_message: message.slice(0, 1000),
      available_at: new Date(Date.now() + retryDelaySeconds * 1000).toISOString(),
      updated_at: nowIso(),
    })
    .eq("id", eventId);
}
