import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getLogoUrlForTheme } from "@/lib/logo-assets";
import { cn } from "@/lib/utils";

export function AppLogo({
  className,
  to = "/",
  label = "Connected AI Business OS home",
}: {
  className?: string;
  to?: string;
  label?: string;
}) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const src = mounted
    ? getLogoUrlForTheme(resolvedTheme)
    : "/logo-wordmark-dark-bg.svg";

  return (
    <Link
      to={to}
      className={cn("flex items-center gap-2.5 outline-none", className)}
      aria-label={label}
    >
      <img
        src={src}
        alt=""
        width={36}
        height={36}
        className="h-9 w-9 shrink-0"
        decoding="async"
      />
      <span className="font-display text-lg font-bold tracking-tight text-foreground">
        Connected<span className="text-primary"> AI</span> OS
      </span>
    </Link>
  );
}
