import { LegalPage } from "@/pages/legal-page";

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      body={[
        "Connected AI Business OS processes tenant data to provide orchestration, dashboards, workflows, and AI features scoped by role.",
        "We apply encryption in transit and at rest, row-level isolation per tenant, and configurable retention for activity logs and AI conversations.",
        "For data subject requests or DPA details, contact your workspace administrator or legal@connected-ai-os.example.",
      ]}
    />
  );
}
