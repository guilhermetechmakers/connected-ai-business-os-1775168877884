import type { WorkflowLibraryCatalog } from "@/types/workflows";

/** Client-side catalog when Edge `libraries.list` is unavailable. */
export const WORKFLOW_LIBRARY_FALLBACK: WorkflowLibraryCatalog = {
  triggers: [
    {
      id: "tr-manual",
      type: "trigger",
      label: "Manual / UI",
      description: "Start from console or API",
      preset: { kind: "manual" },
    },
    {
      id: "tr-schedule",
      type: "trigger",
      label: "Schedule (cron)",
      description: "Time-based recurrence",
      preset: { kind: "schedule" },
    },
    {
      id: "tr-slack-message",
      type: "trigger",
      label: "Slack message event",
      description: "Runs when Slack message.created events are enqueued.",
      preset: { kind: "provider_event", providerKey: "slack", eventType: "message.created" },
    },
    {
      id: "tr-hubspot-contact",
      type: "trigger",
      label: "HubSpot contact event",
      description: "Runs for HubSpot contact sync/webhook events.",
      preset: { kind: "provider_event", providerKey: "hubspot", eventType: "contact.synced" },
    },
    {
      id: "tr-quickbooks-invoice",
      type: "trigger",
      label: "QuickBooks invoice event",
      description: "Runs when invoice events arrive from QuickBooks.",
      preset: { kind: "provider_event", providerKey: "quickbooks", eventType: "invoice.synced" },
    },
    {
      id: "tr-google-calendar",
      type: "trigger",
      label: "Google Calendar event",
      description: "Runs from normalized Google Calendar poll events.",
      preset: { kind: "provider_event", providerKey: "google_calendar", eventType: "event.synced" },
    },
  ],
  actions: [
    {
      id: "ac-slack-send",
      type: "action",
      label: "Slack send message",
      description: "Execute tool slack.send_message",
      preset: { toolId: "slack.send_message", args: { channel: "", text: "" } },
    },
    {
      id: "ac-drive-search",
      type: "action",
      label: "Drive search files",
      description: "Execute tool google_drive.search_files",
      preset: { toolId: "google_drive.search_files", args: { query: "", pageSize: 20 } },
    },
    {
      id: "ac-gmail-send",
      type: "action",
      label: "Gmail send email",
      description: "Execute tool gmail.send_email",
      preset: { toolId: "gmail.send_email", args: { to: "", subject: "", body: "" } },
    },
    {
      id: "ac-calendar-create",
      type: "action",
      label: "Calendar create event",
      description: "Execute tool google_calendar.create_event",
      preset: { toolId: "google_calendar.create_event", args: { summary: "", start: "", end: "" } },
    },
    {
      id: "ac-hubspot-upsert-contact",
      type: "action",
      label: "HubSpot upsert contact",
      description: "Execute tool hubspot.upsert_contact",
      preset: { toolId: "hubspot.upsert_contact", args: { email: "" } },
    },
    {
      id: "ac-hubspot-update-deal",
      type: "action",
      label: "HubSpot update deal stage",
      description: "Execute tool hubspot.update_deal_stage",
      preset: { toolId: "hubspot.update_deal_stage", args: { dealId: "", dealstage: "" } },
    },
    {
      id: "ac-qbo-reminder",
      type: "action",
      label: "QuickBooks send reminder",
      description: "Execute tool quickbooks.send_invoice_reminder",
      preset: { toolId: "quickbooks.send_invoice_reminder", args: { invoiceId: "" } },
    },
  ],
  logic: [
    {
      id: "lg-condition",
      type: "condition",
      label: "If / else",
      description: "Boolean gate on payload",
      preset: { expression: "payload.status == 'open'" },
    },
    {
      id: "lg-branch",
      type: "branch",
      label: "Multi-branch",
      description: "Route by rules",
      preset: { mode: "first-match" },
    },
    {
      id: "lg-loop",
      type: "loop",
      label: "Loop",
      description: "Iterate collection",
      preset: { collectionPath: "items" },
    },
    {
      id: "lg-delay",
      type: "delay",
      label: "Delay",
      description: "Wait before next step",
      preset: { seconds: 60 },
    },
    {
      id: "lg-approval",
      type: "approval",
      label: "Approval gate",
      description: "Human decision + SLA",
      preset: { dueByHours: 24, approverUserIds: [] },
    },
  ],
};

export function flattenWorkflowLibrary(
  catalog: WorkflowLibraryCatalog | null | undefined,
) {
  if (!catalog) return [];
  const triggers = Array.isArray(catalog.triggers) ? catalog.triggers : [];
  const actions = Array.isArray(catalog.actions) ? catalog.actions : [];
  const logic = Array.isArray(catalog.logic) ? catalog.logic : [];
  return [...triggers, ...actions, ...logic];
}
