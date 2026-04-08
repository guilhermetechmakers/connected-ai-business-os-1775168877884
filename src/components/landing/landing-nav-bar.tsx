import { Menu, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "next-themes";

import { AppLogo } from "@/components/landing/app-logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { LandingCta, LandingNavLink } from "@/types/landing-content";

export interface LandingNavBarProps {
  links: LandingNavLink[];
  ctaPrimary: LandingCta;
  className?: string;
}

export function LandingNavBar({ links, ctaPrimary, className }: LandingNavBarProps) {
  const { setTheme, resolvedTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const safeLinks = Array.isArray(links) ? links : [];

  const toggleTheme = () => {
    setTheme(resolvedTheme === "light" ? "dark" : "light");
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md dark:bg-[#0a0a0a]/90",
        className,
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4 lg:px-16">
        <AppLogo />
        <nav
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 text-sm font-medium text-muted-foreground md:flex"
          aria-label="Primary"
        >
          {safeLinks.map((l) =>
            l.external ? (
              <a
                key={l.href + l.label}
                href={l.href}
                className="transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
                rel="noreferrer"
                target="_blank"
              >
                {l.label}
              </a>
            ) : (
              <Link
                key={l.href + l.label}
                to={l.href}
                className="transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
              >
                {l.label}
              </Link>
            ),
          )}
        </nav>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={
              resolvedTheme !== "light" ? "Switch to light theme" : "Switch to dark theme"
            }
            onClick={() => toggleTheme()}
          >
            {resolvedTheme !== "light" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
          <Button variant="cta" size="sm" className="hidden sm:inline-flex" asChild>
            <Link to={ctaPrimary.href}>{ctaPrimary.label}</Link>
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="md:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="border-border/80 bg-card">
              <SheetHeader>
                <SheetTitle className="font-display text-left">Menu</SheetTitle>
              </SheetHeader>
              <nav className="mt-8 flex flex-col gap-4 text-sm font-medium" aria-label="Mobile">
                {safeLinks.map((l) =>
                  l.external ? (
                    <a
                      key={l.href + l.label}
                      href={l.href}
                      className="text-muted-foreground hover:text-foreground"
                      rel="noreferrer"
                      target="_blank"
                      onClick={() => setOpen(false)}
                    >
                      {l.label}
                    </a>
                  ) : (
                    <Link
                      key={l.href + l.label}
                      to={l.href}
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => setOpen(false)}
                    >
                      {l.label}
                    </Link>
                  ),
                )}
                <Button variant="cta" className="mt-4 w-full" asChild>
                  <Link to={ctaPrimary.href} onClick={() => setOpen(false)}>
                    {ctaPrimary.label}
                  </Link>
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
