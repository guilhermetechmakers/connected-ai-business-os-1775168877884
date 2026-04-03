import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Company setup", to: "/onboarding/company" },
  { label: "Integrations", to: "/onboarding/integrations" },
  { label: "Workspace", to: "/dashboard/global" },
] as const;

export function IntegrationOnboardingBreadcrumbs({
  currentIndex,
}: {
  /** 0 = company, 1 = integrations (this page), 2 = workspace */
  currentIndex: number;
}) {
  return (
    <nav aria-label="Onboarding progress" className="w-full">
      <ol className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
        {STEPS.map((step, i) => {
          const active = i === currentIndex;
          const done = i < currentIndex;
          return (
            <li key={step.label} className="flex items-center gap-2">
              {i > 0 ? (
                <span className="hidden text-border sm:inline" aria-hidden>
                  /
                </span>
              ) : null}
              <Link
                to={step.to}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors duration-150",
                  active
                    ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                    : done
                      ? "text-success hover:text-success/90"
                      : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-current text-[10px]">
                  {i + 1}
                </span>
                {step.label}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
