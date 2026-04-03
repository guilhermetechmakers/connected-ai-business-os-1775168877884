import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DataMappingPreviewTable } from "@/components/onboarding/integration-connection-wizard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  useMappingsQuery,
  useReplaceMappingsMutation,
} from "@/hooks/use-integrations";
import { getProviderDefinition } from "@/lib/connector-registry";
import { cn } from "@/lib/utils";
import type { FieldMappingRow } from "@/types/integrations";

const STEPS = [
  "Data model",
  "Field mapping",
  "Preview",
  "Save & apply",
] as const;

const ENTITY_OPTIONS = [
  "Conversation",
  "Message",
  "Document",
  "Account",
  "Contact",
  "Opportunity",
  "Activity",
  "User",
] as const;

function mappingsToRows(
  existing: FieldMappingRow[],
  defaults: {
    sourceField: string;
    targetEntity: string;
    targetField: string;
    dataType: string;
  }[],
): Array<{
  sourceField: string;
  targetEntity: string;
  targetField: string;
  dataType: string;
}> {
  const ex = Array.isArray(existing) ? existing : [];
  if (ex.length > 0) {
    return ex.map((m) => ({
      sourceField: m.source_field,
      targetEntity: m.target_entity,
      targetField: m.target_field,
      dataType: m.data_type,
    }));
  }
  const defs = Array.isArray(defaults) ? defaults : [];
  return defs.map((d) => ({
    sourceField: d.sourceField,
    targetEntity: d.targetEntity,
    targetField: d.targetField,
    dataType: d.dataType,
  }));
}

export type MappingWizardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectorId: string;
  providerKey: string;
  onSaved?: () => void;
};

export function MappingWizardDialog({
  open,
  onOpenChange,
  connectorId,
  providerKey,
  onSaved,
}: MappingWizardDialogProps) {
  const [step, setStep] = useState(0);
  const [overrides, setOverrides] = useState<
    Record<string, (typeof ENTITY_OPTIONS)[number]>
  >({});

  const def = getProviderDefinition(providerKey);
  const mappingsQuery = useMappingsQuery(open ? connectorId : undefined);
  const replace = useReplaceMappingsMutation();

  const baseRows = useMemo(
    () =>
      mappingsToRows(
        Array.isArray(mappingsQuery.data) ? mappingsQuery.data : [],
        def?.defaultMappings ?? [],
      ),
    [mappingsQuery.data, def?.defaultMappings],
  );

  const activeRows = useMemo(
    () =>
      baseRows.map((r) => ({
        ...r,
        targetEntity: overrides[r.sourceField] ?? r.targetEntity,
      })),
    [baseRows, overrides],
  );

  const preview = useMemo(() => {
    const samples: Record<string, string> = {};
    for (const r of activeRows) {
      samples[r.sourceField] = `[sample:${r.dataType}]`;
    }
    return samples;
  }, [activeRows]);

  useEffect(() => {
    if (!open) {
      setStep(0);
      setOverrides({});
    }
  }, [open]);

  const progress = ((step + 1) / STEPS.length) * 100;

  const save = () => {
    replace.mutate(
      {
        connectorId,
        mappings: activeRows.map((m) => ({
          sourceField: m.sourceField,
          targetEntity: m.targetEntity,
          targetField: m.targetField,
          dataType: m.dataType,
        })),
      },
      {
        onSuccess: () => {
          toast.success("Mapping saved");
          onSaved?.();
          onOpenChange(false);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-border/60 bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Mapping wizard · {def?.label ?? providerKey}
          </DialogTitle>
          <DialogDescription>
            Map provider fields to unified entities. Required paths are validated
            before sync jobs run.
          </DialogDescription>
        </DialogHeader>
        <Progress value={progress} className="h-2" />
        <ol
          className="mt-4 flex flex-wrap gap-2"
          aria-label="Wizard steps"
        >
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs transition-all duration-150",
                i === step
                  ? "border-primary/50 bg-primary/10 text-foreground"
                  : i < step
                    ? "border-success/40 bg-success/5 text-success"
                    : "border-border/60 bg-surface-inner text-muted-foreground",
              )}
            >
              {i + 1}. {label}
            </li>
          ))}
        </ol>

        {step === 0 ? (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Canonical targets include Accounts, Contacts, Documents, and
              Activities so dashboards and RAG stay aligned across tools.
            </p>
            <ul className="list-inside list-disc rounded-xl border border-border/50 bg-surface-inner/50 p-4 text-foreground">
              {(def?.defaultMappings ?? []).slice(0, 6).map((m) => (
                <li key={m.sourceField}>
                  <span className="font-mono text-primary">{m.sourceField}</span>
                  {" → "}
                  {m.targetEntity}.{m.targetField}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {step === 1 ? (
          <DataMappingPreviewTable
            rows={activeRows}
            onEntityChange={(sourceField, entity) =>
              setOverrides((p) => ({ ...p, [sourceField]: entity }))
            }
          />
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sample payload preview (no live PII):
            </p>
            <pre className="max-h-48 overflow-auto rounded-xl border border-border/50 bg-surface-inner p-4 font-mono text-xs text-primary">
              {JSON.stringify(preview, null, 2)}
            </pre>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/10 p-4 text-sm">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" aria-hidden />
            <div>
              <p className="font-semibold text-foreground">Ready to apply</p>
              <p className="text-muted-foreground">
                Mappings persist per connector and tenant. You can re-open this
                wizard anytime.
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div className="flex flex-wrap gap-2">
            {step < STEPS.length - 1 ? (
              <Button
                type="button"
                variant="cta"
                className="transition-transform duration-150 hover:scale-[1.02]"
                onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                variant="cta"
                disabled={replace.isPending}
                onClick={() => save()}
              >
                {replace.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                )}
                Save mapping
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
