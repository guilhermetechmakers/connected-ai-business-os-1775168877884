import { useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ModuleDataBinding } from "@/types/modules";

export type PreviewContext = {
  tenantLabel: string;
  userRole: string;
  department: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPreviewSrcDoc(params: {
  uiEntry: string;
  bindings: ModuleDataBinding[];
  ctx: PreviewContext;
}): string {
  const entry = escapeHtml(params.uiEntry || "/dashboard/modules/preview");
  const bindingsJson = escapeHtml(
    JSON.stringify(params.bindings ?? [], null, 2),
  );
  const tenant = escapeHtml(params.ctx.tenantLabel);
  const role = escapeHtml(params.ctx.userRole);
  const dept = escapeHtml(params.ctx.department);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root { color-scheme: dark; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, sans-serif;
      background: #0C1116;
      color: #F7FAFF;
      padding: 16px;
      line-height: 1.5;
      font-size: 14px;
    }
    h1 { font-size: 18px; margin: 0 0 12px; font-weight: 700; }
    .accent { color: #9AD0FF; }
    .ok { color: #00D27A; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; }
    pre {
      background: #05060A;
      border: 1px solid rgba(21, 78, 120, 0.35);
      border-radius: 12px;
      padding: 12px;
      overflow: auto;
      font-size: 11px;
      color: #8FA0B0;
    }
    .row { margin-bottom: 8px; }
    .label { color: #8FA0B0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
  </style>
</head>
<body>
  <p class="ok">Sandbox preview · no outbound network</p>
  <h1>Module entry <span class="accent">${entry}</span></h1>
  <div class="row"><span class="label">Tenant</span> · ${tenant}</div>
  <div class="row"><span class="label">Role</span> · ${role}</div>
  <div class="row"><span class="label">Department</span> · ${dept}</div>
  <p class="label" style="margin-top:16px">Mock unified bindings</p>
  <pre>${bindingsJson}</pre>
</body>
</html>`;
}

type ModuleLivePreviewProps = {
  uiEntry: string;
  bindings: ModuleDataBinding[];
  context: PreviewContext;
  className?: string;
};

export function ModuleLivePreview({
  uiEntry,
  bindings,
  context,
  className,
}: ModuleLivePreviewProps) {
  const srcDoc = useMemo(
    () =>
      buildPreviewSrcDoc({
        uiEntry,
        bindings: Array.isArray(bindings) ? bindings : [],
        ctx: context,
      }),
    [uiEntry, bindings, context],
  );

  return (
    <Card
      className={cn(
        "border-border/80 bg-card/90 shadow-card transition-all duration-150 hover:-translate-y-1",
        className,
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-lg">Live preview</CardTitle>
        <p className="text-xs text-muted-foreground">
          Isolated iframe — context and bindings only; no cross-tenant data.
        </p>
      </CardHeader>
      <CardContent>
        <iframe
          title="Module preview sandbox"
          sandbox=""
          className="h-[min(420px,55vh)] w-full rounded-xl border border-border/80 bg-[#0C1116]"
          srcDoc={srcDoc}
        />
      </CardContent>
    </Card>
  );
}
