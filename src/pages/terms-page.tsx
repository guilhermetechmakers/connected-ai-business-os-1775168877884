import { LegalPage } from "@/pages/legal-page";

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      body={[
        "By using Connected AI Business OS you agree to acceptable use policies covering AI-assisted actions, integration credentials, and multi-tenant isolation.",
        "You are responsible for configuring roles, approvals, and data policies within your tenant. Platform administrators may suspend access for security issues.",
        "Service levels, uptime targets, and liability caps are defined in your order form or enterprise agreement.",
      ]}
    />
  );
}
