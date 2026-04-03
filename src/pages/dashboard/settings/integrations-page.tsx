import { SettingsIntegrationsManager } from "@/components/settings/settings-integrations-manager";

export default function SettingsIntegrationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-foreground">Integrations</h2>
        <p className="text-sm text-muted-foreground">
          Connectors, credentials, sync health (Recharts), and provider registry.
        </p>
      </div>
      <SettingsIntegrationsManager />
    </div>
  );
}
