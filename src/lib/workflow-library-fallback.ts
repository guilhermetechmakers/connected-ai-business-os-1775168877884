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
      id: "tr-webhook",
      type: "trigger",
      label: "Webhook",
      description: "HTTP callback ingress",
      preset: { kind: "webhook", path: "/hooks/tenant" },
    },
    {
      id: "tr-event",
      type: "trigger",
      label: "Domain event",
      description: "Unified data layer event",
      preset: { kind: "event", topic: "entity.updated" },
    },
  ],
  actions: [
    {
      id: "ac-slack",
      type: "action",
      label: "Notify Slack",
      description: "Post to channel",
      preset: { channel: "slack", template: "default" },
    },
    {
      id: "ac-email",
      type: "action",
      label: "Send email",
      description: "Transactional template",
      preset: { channel: "email", templateId: "notify" },
    },
    {
      id: "ac-http",
      type: "action",
      label: "HTTP request",
      description: "Signed outbound call",
      preset: { method: "POST", url: "https://api.example.com/hook" },
    },
    {
      id: "ac-crm",
      type: "action",
      label: "CRM update",
      description: "Patch lead / deal",
      preset: { integration: "crm", operation: "upsert" },
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
