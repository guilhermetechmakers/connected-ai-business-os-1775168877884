import { AlertPanel, type AlertPanelProps } from "@/components/unified-data/alert-panel";

export type AlertsPanelProps = AlertPanelProps;

export function AlertsPanel(props: AlertsPanelProps) {
  return <AlertPanel {...props} />;
}
