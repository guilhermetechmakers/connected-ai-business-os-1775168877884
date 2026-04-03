import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Map } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  DataMappingPreviewTable,
  ENTITY_OPTIONS,
  type MappingPreviewRow,
} from "@/components/integrations/onboarding/data-mapping-preview-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useMappingsQuery, useReplaceMappingsMutation } from "@/hooks/use-integrations";
import { getProviderDefinition } from "@/lib/connector-registry";
import type { ProviderCatalogItem } from "@/types/integrations";
import { cn } from "@/lib/utils";

const STEPS = ["Data model", "Field mapping", "Preview", "Save"] as const;

type SampleFormValues = Record<string, string | undefined>;

export interface MappingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogItem: ProviderCatalogItem | null;
  connectorId: string | null;
}

export function MappingWizard({
  open,
  onOpenChange,
  catalogItem,
  connectorId,
}: MappingWizardProps) {
  const [step, setStep] = useState(0);
  const [entityOverrides, setEntityOverrides] = useState<
    Record<string, (typeof ENTITY_OPTIONS)[number]>
  >({});

  const mappingsQuery = useMappingsQuery(connectorId ?? undefined);
  const replaceMappings = useReplaceMappingsMutation();

  const providerDef = catalogItem ? getProviderDefinition(catalogItem.id) : undefined;

  const form = useForm<SampleFormValues>({ defaultValues: {} });

  useEffect(() => {
    if (!open) {
      setStep(0);
      setEntityOverrides({});
      form.reset({});
      return;
    }
    const defs = providerDef?.defaultMappings ?? [];
    const initialSamples: Record<string, string> = {};
    for (const m of defs) {
      initialSamples[m.sourceField] = "";
    }
    form.reset(initialSamples);
  }, [open, providerDef, form]);

  useEffect(() => {
    if (!open || !connectorId) return;
    const rows = mappingsQuery.data;
    if (!Array.isArray(rows) || rows.length === 0) return;
    const allowed = new Set<string>(ENTITY_OPTIONS);
    const next: Record<string, (typeof ENTITY_OPTIONS)[number]> = {};
    for (const r of rows) {
      const te = r.target_entity;
      next[r.source_field] = (
        typeof te === "string" && allowed.has(te) ? te : "Contact"
      ) as (typeof ENTITY_OPTIONS)[number];
    }
    setEntityOverrides((prev) => ({ ...next, ...prev }));
  }, [open, connectorId, mappingsQuery.data]);

  const baseMappings = useMemo(() => {
    const defs = providerDef?.defaultMappings ?? [];
    return Array.isArray(defs) ? defs : [];
  }, [providerDef]);

  const previewRows: MappingPreviewRow[] = useMemo(() => {
    const samples = form.watch();
    return baseMappings.map((m) => ({
      sourceField: m.sourceField,
      targetEntity: entityOverrides[m.sourceField] ?? m.targetEntity,
      targetField: m.targetField,
      dataType: m.dataType,
      sampleValue: samples[m.sourceField]?.trim()
        ? samples[m.sourceField]
        : "—",
    }));
  }, [baseMappings, entityOverrides, form]);

  const progress = ((step + 1) / STEPS.length) * 100;

  const persistMappings = () => {
    if (!connectorId) return;

    replaceMappings.mutate(
      {
        connectorId,
        mappings: previewRows.map((r) => ({
          sourceField: r.sourceField,
          targetEntity: r.targetEntity,
          targetField: r.targetField,
          dataType: r.dataType,
        })),
      },
      {
        onSuccess: () => {
          toast.success("Mapping saved to tenant");
          onOpenChange(false);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const title = catalogItem?.name ?? "Integration";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border/80 bg-card sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <Map className="h-5 w-5 text-primary" aria-hidden />
            Mapping wizard · {title}
          </DialogTitle>
          <DialogDescription>
            Map provider fields to unified entities. Sample values are for preview only and are not
            persisted as live data.
          </DialogDescription>
        </DialogHeader>

        <Progress value={progress} className="h-2" />
        <div className="grid gap-2 sm:grid-cols-4">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={cn(
                "rounded-lg border px-2 py-2 text-center text-xs transition-colors duration-150",
                i === step
                  ? "border-primary/50 bg-primary/10 text-foreground"
                  : i < step
                    ? "border-success/40 bg-success/5 text-success"
                    : "border-border/60 bg-surface-inner text-muted-foreground",
              )}
            >
              {label}
            </div>
          ))}
        </div>

        {step === 0 ? (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Canonical targets align with the unified data layer (Accounts, Contacts, Documents,
              etc.). Adjust entities in the next step if your tenant uses different grouping.
            </p>
            <ul className="list-inside list-disc rounded-lg border border-border/60 bg-surface-inner/50 p-3">
              {baseMappings.slice(0, 6).map((m) => (
                <li key={m.sourceField}>
                  <span className="font-mono text-primary">{m.sourceField}</span>
                  <span className="text-foreground"> → </span>
                  {m.targetEntity}.{m.targetField}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {step === 1 ? (
          <DataMappingPreviewTable
            rows={previewRows}
            onEntityChange={(sourceField, entity) =>
              setEntityOverrides((prev) => ({ ...prev, [sourceField]: entity }))
            }
          />
        ) : null}

        {step === 2 ? (
          <Form {...form}>
            <form className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Enter sample values to validate how each source field resolves in the unified model.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {baseMappings.map((m) => (
                  <FormField
                    key={m.sourceField}
                    control={form.control}
                    name={m.sourceField}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs text-primary">
                          {m.sourceField}
                        </FormLabel>
                        <FormControl>
                          <Input
                            className="bg-surface-inner"
                            placeholder="Sample value"
                            autoComplete="off"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </form>
          </Form>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-success/30 bg-success/10 p-4 text-sm">
              <div className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" aria-hidden />
                <div>
                  <p className="font-semibold text-foreground">Ready to apply</p>
                  <p className="text-muted-foreground">
                    Mappings persist per connector. You can re-open this wizard to adjust targets.
                  </p>
                </div>
              </div>
            </div>
            <DataMappingPreviewTable
              readOnly
              rows={previewRows}
              onEntityChange={() => {}}
            />
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
          <Button
            type="button"
            variant="ghost"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" variant="cta" onClick={() => setStep((s) => s + 1)}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="cta"
              disabled={!connectorId || replaceMappings.isPending}
              onClick={persistMappings}
            >
              {replaceMappings.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              Save mapping
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
