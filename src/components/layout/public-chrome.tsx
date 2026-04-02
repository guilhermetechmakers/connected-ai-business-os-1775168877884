import { Link } from "react-router-dom";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PublicChrome({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid-bg min-h-screen", className)}>
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4 lg:px-16">
          <Link
            to="/"
            className="font-display text-lg font-bold tracking-tight text-foreground"
          >
            Connected<span className="text-primary"> AI</span> OS
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">
              Platform
            </a>
            <a href="#pricing" className="transition-colors hover:text-foreground">
              Pricing
            </a>
            <Link to="/login" className="transition-colors hover:text-foreground">
              Sign in
            </Link>
          </nav>
          <Button variant="cta" size="sm" asChild>
            <Link to="/signup">Get started</Link>
          </Button>
        </div>
      </header>
      {children}
      <footer className="border-t border-border/60 py-12 text-sm text-muted-foreground">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 lg:flex-row lg:justify-between lg:px-16">
          <p>© {new Date().getFullYear()} Connected AI Business OS</p>
          <div className="flex flex-wrap gap-6">
            <Link to="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link to="/cookies" className="hover:text-foreground">
              Cookies
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
