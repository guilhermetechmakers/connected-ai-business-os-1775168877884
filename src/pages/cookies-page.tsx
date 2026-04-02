import { LegalPage } from "@/pages/legal-page";

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie notice"
      body={[
        "We use essential cookies for authentication, session continuity, and security. Optional analytics cookies help us improve in-product guidance.",
        "You can control non-essential cookies from the Settings → Data policies section once signed in.",
        "Third-party connectors may set their own cookies when you complete OAuth flows; refer to each provider’s policy.",
      ]}
    />
  );
}
