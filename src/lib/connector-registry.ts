import type { ProviderDefinition } from "@/types/integrations";

export const CONNECTOR_PROVIDERS: ProviderDefinition[] = [
  {
    key: "slack",
    label: "Slack",
    description:
      "Post messages, ingest channel events, and attach conversations for AI retrieval.",
    capabilities: ["oauth2", "webhooks", "rate_limited", "read", "write"],
    auth: "oauth2",
    defaultMappings: [
      {
        sourceField: "channel.id",
        targetEntity: "Conversation",
        targetField: "externalId",
        dataType: "string",
      },
      {
        sourceField: "channel.name",
        targetEntity: "Conversation",
        targetField: "title",
        dataType: "string",
      },
      {
        sourceField: "message.ts",
        targetEntity: "Message",
        targetField: "sentAt",
        dataType: "timestamp",
      },
      {
        sourceField: "message.text",
        targetEntity: "Message",
        targetField: "body",
        dataType: "string",
      },
      {
        sourceField: "user.id",
        targetEntity: "User",
        targetField: "externalParticipantId",
        dataType: "string",
      },
    ],
  },
  {
    key: "google_drive",
    label: "Google Drive",
    description:
      "Index files and metadata into unified Document entities for RAG and dashboards.",
    capabilities: ["oauth2", "rate_limited", "read", "write"],
    auth: "oauth2",
    defaultMappings: [
      {
        sourceField: "file.id",
        targetEntity: "Document",
        targetField: "externalId",
        dataType: "string",
      },
      {
        sourceField: "file.name",
        targetEntity: "Document",
        targetField: "title",
        dataType: "string",
      },
      {
        sourceField: "file.mimeType",
        targetEntity: "Document",
        targetField: "mimeType",
        dataType: "string",
      },
      {
        sourceField: "file.modifiedTime",
        targetEntity: "Document",
        targetField: "updatedAt",
        dataType: "timestamp",
      },
      {
        sourceField: "file.owners",
        targetEntity: "Document",
        targetField: "owners",
        dataType: "json",
      },
    ],
  },
  {
    key: "gmail",
    label: "Gmail",
    description:
      "Sync mailbox threads and execute send/search actions from AI and workflows.",
    capabilities: ["oauth2", "rate_limited", "read", "write"],
    auth: "oauth2",
    defaultMappings: [
      {
        sourceField: "message.id",
        targetEntity: "Message",
        targetField: "externalId",
        dataType: "string",
      },
      {
        sourceField: "message.subject",
        targetEntity: "Message",
        targetField: "title",
        dataType: "string",
      },
      {
        sourceField: "message.from",
        targetEntity: "Message",
        targetField: "sender",
        dataType: "string",
      },
      {
        sourceField: "thread.id",
        targetEntity: "Conversation",
        targetField: "externalId",
        dataType: "string",
      },
      {
        sourceField: "message.snippet",
        targetEntity: "Message",
        targetField: "body",
        dataType: "string",
      },
    ],
  },
  {
    key: "google_calendar",
    label: "Google Calendar",
    description:
      "Sync and update calendar events to coordinate workflows and scheduling actions.",
    capabilities: ["oauth2", "rate_limited", "read", "write"],
    auth: "oauth2",
    defaultMappings: [
      {
        sourceField: "event.id",
        targetEntity: "Activity",
        targetField: "externalId",
        dataType: "string",
      },
      {
        sourceField: "event.summary",
        targetEntity: "Activity",
        targetField: "title",
        dataType: "string",
      },
      {
        sourceField: "event.start",
        targetEntity: "Activity",
        targetField: "startAt",
        dataType: "timestamp",
      },
      {
        sourceField: "event.end",
        targetEntity: "Activity",
        targetField: "endAt",
        dataType: "timestamp",
      },
      {
        sourceField: "event.attendees",
        targetEntity: "Activity",
        targetField: "participants",
        dataType: "json",
      },
    ],
  },
  {
    key: "quickbooks",
    label: "QuickBooks Online",
    description:
      "Sync customers and invoices into unified finance entities and workflow-safe updates.",
    capabilities: ["oauth2", "webhooks", "rate_limited", "read", "write"],
    auth: "oauth2",
    defaultMappings: [
      {
        sourceField: "customer.id",
        targetEntity: "Account",
        targetField: "externalId",
        dataType: "string",
      },
      {
        sourceField: "customer.displayName",
        targetEntity: "Account",
        targetField: "name",
        dataType: "string",
      },
      {
        sourceField: "invoice.id",
        targetEntity: "Document",
        targetField: "externalId",
        dataType: "string",
      },
      {
        sourceField: "invoice.status",
        targetEntity: "Document",
        targetField: "status",
        dataType: "string",
      },
      {
        sourceField: "invoice.totalAmt",
        targetEntity: "Opportunity",
        targetField: "amount",
        dataType: "number",
      },
    ],
  },
  {
    key: "hubspot",
    label: "HubSpot",
    description:
      "Ingest contacts/companies/deals and execute CRM writes from chat and workflows.",
    capabilities: ["oauth2", "webhooks", "rate_limited", "read", "write"],
    auth: "oauth2",
    defaultMappings: [
      {
        sourceField: "contact.id",
        targetEntity: "Contact",
        targetField: "externalId",
        dataType: "string",
      },
      {
        sourceField: "contact.email",
        targetEntity: "Contact",
        targetField: "email",
        dataType: "string",
      },
      {
        sourceField: "company.name",
        targetEntity: "Account",
        targetField: "name",
        dataType: "string",
      },
      {
        sourceField: "deal.id",
        targetEntity: "Opportunity",
        targetField: "externalId",
        dataType: "string",
      },
      {
        sourceField: "deal.dealstage",
        targetEntity: "Opportunity",
        targetField: "stage",
        dataType: "string",
      },
      {
        sourceField: "engagement.type",
        targetEntity: "Activity",
        targetField: "kind",
        dataType: "string",
      },
    ],
  },
];

export function getProviderDefinition(
  key: string,
): ProviderDefinition | undefined {
  return CONNECTOR_PROVIDERS.find((p) => p.key === key);
}
