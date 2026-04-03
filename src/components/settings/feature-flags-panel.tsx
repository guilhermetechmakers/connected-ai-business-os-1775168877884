import { Loader2, ToggleLeft } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  useTenantFeatureFlagUpsertMutation,
  useTenantFeatureFlagsQuery,
} from "@/hooks/use-settings-hub";
import type { TenantFeatureFlagRow } from "@/lib/settings-hub-api";

const PRESET_FLAGS = [
  { key: "ai_actions_beta", label: "AI actions (beta)" },
  { key: "workflow_canvas_v2", label: "Workflow canvas v2" },
  { key: "demo_integrations_ui", label: "Demo integrations UI" },
] as const;

function flagMap(rows: TenantFeatureFlagRow[]): Map<string, TenantFeatureFlagRow> {
  const m = new Map<string, TenantFeatureFlagRow>();
  const list = Array.isArray(rows) ? rows : [];
  for (const r of list) {
    if (r && typeof r.flag_key === "string") m.set(r.flag_key, r);
  }
  return m;
}

export function FeatureFlagsPanel() {
  const q = useTenantFeatureFlagsQuery();
  const mut = useTenantFeatureFlagUpsertMutation();

  const rows = Array.isArray(q.data) ? q.data : [];
  const byName = useMemo(() => flagMap(rows), [rows]);

  if (q.isLoading) {
    return <Skeleton className="h-56 w-full max-w-2xl rounded-xl bg-surface-inner" />;
  }

  if (q.isError) {
    return (
      <p className="text-sm text-destructive">
        {q.error instanceof Error ? q.error.message : "Could not load feature flags"}
      </p>
    );
  }

  const toggle = (flagKey: string, enabled: boolean, rollout: number) => {
    mut.mutate(
      { flagKey, enabled, rollout },
      {
        onSuccess: () => toast.success("Feature flag updated"),
        onError: (e: Error) => toast.error(e.message),
      },
    );
  };

  return (
    <Card className="border-border/80 bg-card/90">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ToggleLeft className="h-5 w-5 text-primary" aria-hidden />
          Feature flags
        </CardTitle>
        <CardDescription>
          Per-tenant toggles and rollout percentages stored in <code className="text-xs">feature_flags</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {(PRESET_FLAGS ?? []).map((preset) => {
          const row = byName.get(preset.key);
          const enabled = row?.enabled ?? false;
          const rollout = typeof row?.rollout === "number" ? row.rollout : 0;
          return (
            <div
              key={preset.key}
              className="flex flex-col gap-3 rounded-xl border border-border/60 bg-surface-inner p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-1 items-center justify-between gap-4">
                <div>
                  <Label className="text-base text-foreground" htmlFor={`ff-${preset.key}`}>
                    {preset.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{preset.key}</p>
                </div>
                <Switch
                  id={`ff-${preset.key}`}
                  checked={enabled}
                  onCheckedChange={(v) => toggle(preset.key, v, rollout)}
                  disabled={mut.isPending}
                />
              </div>
              <div className="flex items-center gap-2 sm:w-40">
                <Label htmlFor={`ff-roll-${preset.key}`} className="sr-only">
                  Rollout %
                </Label>
                <Input
                  id={`ff-roll-${preset.key}`}
                  type="number"
                  min={0}
                  max={100}
                  className="bg-background/80"
                  defaultValue={rollout}
                  key={`${preset.key}-${rollout}-${enabled}`}
                  onBlur={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n) && n >= 0 && n <= 100 && n !== rollout) {
                      toggle(preset.key, enabled, n);
                    }
                  }}
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
          );
        })}

        <div className="rounded-xl border border-dashed border-border/60 p-4">
          <p className="mb-2 text-sm font-medium text-foreground">Custom flag</p>
          <CustomFlagForm
            disabled={mut.isPending}
            onCreate={(flagKey, enabled, rollout) => {
              mut.mutate(
                { flagKey, enabled, rollout },
                {
                  onSuccess: () => toast.success("Flag saved"),
                  onError: (e: Error) => toast.error(e.message),
                },
              );
            }}
          />
        </div>

        {rows.length > 0 ? (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{rows.length}</span> flags stored for this
            tenant.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CustomFlagForm({
  disabled,
  onCreate,
}: {
  disabled: boolean;
  onCreate: (flagKey: string, enabled: boolean, rollout: number) => void;
}) {
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const flagKey = String(fd.get("fname") ?? "").trim();
        if (!flagKey) return;
        const pct = Number(fd.get("fpct") ?? 0);
        const en = fd.get("fen") === "on";
        onCreate(flagKey, en, Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0);
        e.currentTarget.reset();
      }}
    >
      <div className="flex-1 space-y-1">
        <Label htmlFor="fname">Feature key</Label>
        <Input id="fname" name="fname" className="bg-surface-inner" placeholder="my_feature_key" />
      </div>
      <div className="w-24 space-y-1">
        <Label htmlFor="fpct">Rollout</Label>
        <Input id="fpct" name="fpct" type="number" min={0} max={100} className="bg-surface-inner" defaultValue={0} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="fen" className="h-4 w-4 rounded border-border" defaultChecked />
        Enabled
      </label>
      <Button type="submit" variant="cta" size="sm" disabled={disabled}>
        {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upsert"}
      </Button>
    </form>
  );
}
