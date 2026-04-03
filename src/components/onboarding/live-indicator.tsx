import { cn } from "@/lib/utils";

type LiveIndicatorProps = {
  label?: string;
  className?: string;
};

/** Neon success pulse used in onboarding step headers (design system). */
export function LiveIndicator({ label = "Live", className }: LiveIndicatorProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-success/35 bg-success/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-success",
        className,
      )}
    >
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-success opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
      </span>
      {label}
    </span>
  );
}
