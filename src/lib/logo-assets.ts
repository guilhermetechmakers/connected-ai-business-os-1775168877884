import type { LogoAsset } from "@/types/landing-content";

/** Canonical logo URLs for Connected AI Business OS (public/ static assets). */
export const LOGO_ASSETS: LogoAsset[] = [
  {
    id: "logo-mark-on-dark",
    variant: "light",
    url: "/logo-wordmark-dark-bg.svg",
  },
  {
    id: "logo-mark-on-light",
    variant: "dark",
    url: "/logo-wordmark-light-bg.svg",
  },
  {
    id: "favicon",
    variant: "favicon",
    url: "/favicon.svg",
  },
  {
    id: "social-share",
    variant: "social",
    url: "/og-social.svg",
  },
];

export function getLogoUrlForTheme(resolvedTheme: string | undefined): string {
  const isLight = resolvedTheme === "light";
  const match = LOGO_ASSETS.find((a) =>
    isLight ? a.variant === "dark" : a.variant === "light",
  );
  return match?.url ?? "/logo-wordmark-dark-bg.svg";
}
