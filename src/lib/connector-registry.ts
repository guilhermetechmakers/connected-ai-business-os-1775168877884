import type { ProviderDefinition } from "@/types/integrations";

export const CONNECTOR_PROVIDERS: ProviderDefinition[] = [
  {
    key: "slack",
    label: "Slack",
    description:
      "Post messages, ingest channel events, and attach conversations for AI retrieval.",
    capabilities: ["oauth2", "api_key", "webhooks", "rate_limited", "read", "write"],
    auth: "both",
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
    key: "salesforce",
    label: "Salesforce",
    description:
      "Sync Accounts, Contacts, Opportunities, and custom objects with CRUD where permitted.",
    capabilities: ["oauth2", "rate_limited", "read", "write"],
    auth: "oauth2",
    defaultMappings: [
      {
        sourceField: "Account.Id",
        targetEntity: "Account",
        targetField: "externalId",
        dataType: "string",
      },
      {
        sourceField: "Account.Name",
        targetEntity: "Account",
        targetField: "name",
        dataType: "string",
      },
      {
        sourceField: "Contact.Email",
        targetEntity: "Contact",
        targetField: "email",
        dataType: "string",
      },
      {
        sourceField: "Opportunity.Amount",
        targetEntity: "Opportunity",
        targetField: "amount",
        dataType: "number",
      },
      {
        sourceField: "Opportunity.StageName",
        targetEntity: "Opportunity",
        targetField: "stage",
        dataType: "string",
      },
    ],
  },
  {
    key: "hubspot",
    label: "HubSpot",
    description:
      "Ingest contacts, companies, deals, and activities; push updates from workflows.",
    capabilities: ["oauth2", "api_key", "rate_limited", "read", "write"],
    auth: "both",
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
