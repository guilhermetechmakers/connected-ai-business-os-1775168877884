/**
 * Stub sync adapters for Slack, Google Drive, Salesforce, HubSpot.
 * Real implementations would call provider APIs with decrypted credentials (server-only).
 */
export type SyncAdapterResult = {
  recordsProcessed: number;
  unifiedEntitiesUpserted: number;
  notes: string[];
};

export async function runProviderSyncStub(
  providerKey: string,
  _credentials: Record<string, unknown>,
): Promise<SyncAdapterResult> {
  const notes: string[] = [
    `Stub sync for ${providerKey}: no external API call in template build.`,
    "Configure provider env secrets and replace with live adapters in production.",
  ];
  const base = providerKey === "slack"
    ? { recordsProcessed: 12, unifiedEntitiesUpserted: 8 }
    : providerKey === "google_drive"
      ? { recordsProcessed: 24, unifiedEntitiesUpserted: 24 }
      : providerKey === "salesforce"
        ? { recordsProcessed: 48, unifiedEntitiesUpserted: 36 }
        : providerKey === "hubspot"
          ? { recordsProcessed: 32, unifiedEntitiesUpserted: 28 }
          : providerKey === "quickbooks"
            ? { recordsProcessed: 18, unifiedEntitiesUpserted: 14 }
            : { recordsProcessed: 0, unifiedEntitiesUpserted: 0 };

  return { ...base, notes };
}
