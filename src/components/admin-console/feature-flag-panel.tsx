import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useAdminFeatureFlagsQuery,
  useAdminFlagsUpsertMutation,
} from "@/hooks/use-activity-logs";

export function FeatureFlagPanel() {
  const flagsQuery = useAdminFeatureFlagsQuery(undefined, true);
  const flagUpsert = useAdminFlagsUpsertMutation();

  const [flagKey, setFlagKey] = useState("");
  const [flagTenantId, setFlagTenantId] = useState("");
  const [flagEnabled, setFlagEnabled] = useState(false);
  const [flagRollout, setFlagRollout] = useState(100);

  const flags = Array.isArray(flagsQuery.data) ? flagsQuery.data : [];

  return (
    <div className="space-y-6">
      <Card className="border-border/80 bg-card/90">
        <CardHeader>
          <CardTitle>Upsert flag</CardTitle>
          <p className="text-sm text-muted-foreground">
            Leave tenant ID empty for a global flag. Rollout percentage applies when the flag
            is enabled.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fk">Flag key</Label>
            <Input
              id="fk"
              value={flagKey}
              onChange={(e) => setFlagKey(e.target.value)}
              className="bg-input border-border/60"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fcid">Tenant company ID (optional)</Label>
            <Input
              id="fcid"
              value={flagTenantId}
              onChange={(e) => setFlagTenantId(e.target.value)}
              placeholder="UUID or empty"
              className="font-mono text-xs bg-input border-border/60"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="fe" checked={flagEnabled} onCheckedChange={setFlagEnabled} />
            <Label htmlFor="fe">Enabled</Label>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Rollout {flagRollout}%</Label>
            <Slider
              value={[flagRollout]}
              min={0}
              max={100}
              step={1}
              onValueChange={(v) => {
                const n = Array.isArray(v) ? v[0] : v;
                if (typeof n === "number") setFlagRollout(n);
              }}
              className="py-2"
            />
          </div>
          <Button
            type="button"
            variant="cta"
            className="md:col-span-2"
            disabled={flagUpsert.isPending}
            onClick={() => {
              const cid = flagTenantId.trim();
              void flagUpsert
                .mutateAsync({
                  flagKey: flagKey.trim(),
                  companyId: cid ? cid : null,
                  enabled: flagEnabled,
                  rollout: flagRollout,
                  payload: {},
                })
                .then((r) => {
                  if (r) toast.success("Flag saved");
                  else toast.error("Save failed");
                });
            }}
          >
            Save flag
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/90">
        <CardHeader>
          <CardTitle>Rollout map</CardTitle>
        </CardHeader>
        <CardContent>
          {flagsQuery.isLoading ? (
            <Skeleton className="h-24 w-full bg-surface-inner" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/60">
                  <TableHead>Key</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead>Rollout</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(flags ?? []).map((f) => {
                  const pct = typeof f.rollout === "number" ? f.rollout : 100;
                  return (
                    <TableRow key={f.id} className="border-border/60">
                      <TableCell className="font-mono text-xs">{f.flag_key}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {f.company_id ?? "global"}
                      </TableCell>
                      <TableCell>{f.enabled ? "yes" : "no"}</TableCell>
                      <TableCell>
                        <div className="flex max-w-[200px] flex-col gap-1">
                          <span className="text-xs text-muted-foreground">{pct}%</span>
                          <Progress value={pct} className="h-1.5" />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {!flagsQuery.isLoading && flags.length === 0 ? (
            <p className="text-sm text-muted-foreground">No flags yet.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
