import { Check, Minus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { COMPARE_FEATURE_MATRIX } from "@/data/landing-defaults";
import { cn } from "@/lib/utils";
import type { CompareFeatureRow, LandingPricingTier } from "@/types/landing-content";

export interface PricingSectionProps {
  tiers?: LandingPricingTier[] | null;
  compareMatrix?: CompareFeatureRow[] | null;
  compareColumnLabels?: [string, string, string];
  className?: string;
}

const DEFAULT_MATRIX = Array.isArray(COMPARE_FEATURE_MATRIX)
  ? COMPARE_FEATURE_MATRIX
  : [];

function MatrixCell({ value }: { value: boolean | string }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className="mx-auto h-4 w-4 text-success" aria-label="Included" />
    ) : (
      <Minus className="mx-auto h-4 w-4 text-muted-foreground/50" aria-label="Not included" />
    );
  }
  return <span className="text-sm text-muted-foreground">{value}</span>;
}

export function PricingSection({
  tiers,
  compareMatrix,
  compareColumnLabels,
  className,
}: PricingSectionProps) {
  const tierList = Array.isArray(tiers) ? tiers : [];
  const matrix =
    Array.isArray(compareMatrix) && compareMatrix.length > 0
      ? compareMatrix
      : DEFAULT_MATRIX;
  const [open, setOpen] = useState(false);
  const labels = useMemo<[string, string, string]>(
    () => compareColumnLabels ?? ["Starter", "Growth", "Enterprise"],
    [compareColumnLabels],
  );

  return (
    <section
      id="pricing"
      className={cn("border-t border-border/60 px-6 py-24 lg:px-24", className)}
      aria-labelledby="pricing-heading"
    >
      <div className="mx-auto max-w-6xl space-y-12">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl space-y-4">
            <h2
              id="pricing-heading"
              className="font-display text-3xl font-bold md:text-4xl"
            >
              Transparent tiers
            </h2>
            <p className="text-lg text-muted-foreground">
              Start with templates and scale into custom modules, workflows, and AI policies.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full shrink-0 md:w-auto">
                Compare features
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto border-border/80 bg-card sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle className="font-display">Feature matrix</DialogTitle>
                <DialogDescription>
                  Side-by-side view of plan capabilities. Values can be driven from CMS later.
                </DialogDescription>
              </DialogHeader>
              <div className="overflow-x-auto rounded-xl border border-border/60">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border/60 bg-surface-inner/80">
                      <th className="p-3 font-medium text-foreground">Capability</th>
                      <th className="p-3 font-medium text-foreground">{labels[0]}</th>
                      <th className="p-3 font-medium text-foreground">{labels[1]}</th>
                      <th className="p-3 font-medium text-foreground">{labels[2]}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.map((row) => (
                      <tr key={row.id} className="border-b border-border/40 last:border-0">
                        <td className="p-3 font-medium text-foreground">{row.capability}</td>
                        <td className="p-3 text-center">
                          <MatrixCell value={row.starter} />
                        </td>
                        <td className="p-3 text-center">
                          <MatrixCell value={row.growth} />
                        </td>
                        <td className="p-3 text-center">
                          <MatrixCell value={row.enterprise} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {tierList.map((tier) => (
            <Card
              key={tier.id}
              className={cn(
                "border-border/80 bg-card/90 shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover",
                tier.highlight && "ring-2 ring-primary/40 shadow-card-hover",
              )}
            >
              <CardHeader>
                <CardTitle className="font-display text-xl">{tier.name}</CardTitle>
                <CardDescription>
                  <span className="block text-3xl font-bold text-foreground">{tier.price}</span>
                  <span className="mt-1 block text-sm">{tier.period}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {(tier.features ?? []).map((b) => (
                    <li key={b} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                      {b}
                    </li>
                  ))}
                </ul>
                {tier.cta.href.startsWith("#") ? (
                  <Button
                    type="button"
                    variant={tier.highlight ? "cta" : "outline"}
                    className="w-full transition-transform duration-150 hover:scale-[1.02]"
                    onClick={() => {
                      const id = tier.cta.href.slice(1);
                      document.getElementById(id)?.scrollIntoView({
                        behavior: "smooth",
                      });
                    }}
                  >
                    {tier.cta.label}
                  </Button>
                ) : (
                  <Button
                    variant={tier.highlight ? "cta" : "outline"}
                    className="w-full transition-transform duration-150 hover:scale-[1.02]"
                    asChild
                  >
                    <Link to={tier.cta.href}>{tier.cta.label}</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
