import { Link } from "react-router-dom";
import type { ReactNode } from "react";

import { FooterResources } from "@/components/landing/footer-resources";
import { LandingNavBar } from "@/components/landing/landing-nav-bar";
import { cn } from "@/lib/utils";
import type { LandingNavLink } from "@/types/landing-content";

const DEFAULT_PUBLIC_NAV_LINKS: LandingNavLink[] = [
  { label: "Platform", href: "/#features" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Demo", href: "/#demo" },
  { label: "Sign in", href: "/login" },
];

const DEFAULT_FOOTER_RESOURCE_LINKS: LandingNavLink[] = [
  { label: "Documentation", href: "/legal/disclaimer" },
  { label: "Security", href: "/privacy" },
  { label: "Contact", href: "mailto:hello@connected-ai-os.example", external: true },
  { label: "Status", href: "/loading" },
];

function MinimalPublicFooter() {
  return (
    <footer className="border-t border-border/60 py-10 text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 lg:flex-row lg:justify-between lg:px-16">
        <p>© {new Date().getFullYear()} Connected AI Business OS</p>
        <div className="flex flex-wrap gap-6">
          <Link to="/privacy" className="transition-colors duration-150 hover:text-foreground">
            Privacy
          </Link>
          <Link to="/terms" className="transition-colors duration-150 hover:text-foreground">
            Terms
          </Link>
          <Link to="/cookies" className="transition-colors duration-150 hover:text-foreground">
            Cookies
          </Link>
        </div>
      </div>
    </footer>
  );
}

export function PublicChrome({
  children,
  footer,
  extendedMarketingFooter = false,
  showGridBackground = false,
  className,
}: {
  children: ReactNode;
  /** When set, replaces the default minimal footer (e.g. full marketing footer on home). */
  footer?: ReactNode;
  /** Use the full marketing footer with demo form (same as passing footer=&lt;FooterResources /&gt;). */
  extendedMarketingFooter?: boolean;
  /** Adds the decorative grid overlay used on marketing home only. */
  showGridBackground?: boolean;
  className?: string;
}) {
  const resolvedFooter = extendedMarketingFooter ? (
    <FooterResources links={DEFAULT_FOOTER_RESOURCE_LINKS} />
  ) : (
    (footer ?? <MinimalPublicFooter />)
  );

  return (
    <div className={cn("flex min-h-screen flex-col", showGridBackground && "grid-bg", className)}>
      <LandingNavBar
        links={DEFAULT_PUBLIC_NAV_LINKS}
        ctaPrimary={{ label: "Get started", href: "/auth/signup-invite" }}
      />
      <div className="flex-1">{children}</div>
      {resolvedFooter}
    </div>
  );
}
