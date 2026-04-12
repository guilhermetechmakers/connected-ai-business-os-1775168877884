import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CustomDashboardQueryPlanStep } from "@/types/dashboard";

type RuntimeDiagnostic = {
  level: "info" | "error" | "warning";
  message: string;
  timestamp: string;
};

function looksLikeLegacyJsonFallback(codeTsx: string): boolean {
  const code = codeTsx.toLowerCase();
  return code.includes("snapshot preview") && code.includes("json.stringify(snapshot");
}

function buildEnhancedFallbackCode(titleHint?: string): string {
  const safeTitle = (titleHint ?? "Custom dashboard").replace(/`/g, "'").trim() || "Custom dashboard";
  return [
    "export default function CustomDashboard(props) {",
    "  const snapshot = props?.snapshotData && typeof props.snapshotData === 'object' ? props.snapshotData : {};",
    "  const datasets = Array.isArray(snapshot.datasets) ? snapshot.datasets : [];",
    "  const rows = [];",
    "  const seen = new Set();",
    "  for (const dataset of datasets) {",
    "    const result = dataset && typeof dataset === 'object' && dataset.result && typeof dataset.result === 'object' ? dataset.result : {};",
    "    const files = Array.isArray(result.files) ? result.files : Array.isArray(result.items) ? result.items : [];",
    "    for (const raw of files) {",
    "      if (!raw || typeof raw !== 'object') continue;",
    "      const file = raw;",
    "      const key = typeof file.id === 'string' && file.id.length > 0 ? file.id : typeof file.webViewLink === 'string' ? file.webViewLink : null;",
    "      if (!key || seen.has(key)) continue;",
    "      seen.add(key);",
    "      rows.push(file);",
    "    }",
    "  }",
    "  const folderMime = 'application/vnd.google-apps.folder';",
    "  const folderCount = rows.filter((row) => row && row.mimeType === folderMime).length;",
    "  const fileCount = Math.max(rows.length - folderCount, 0);",
    "  const typeCounts = new Map();",
    "  for (const row of rows) {",
    "    const mime = typeof row.mimeType === 'string' && row.mimeType.length > 0 ? row.mimeType : 'unknown';",
    "    const shortType = mime.includes('/') ? mime.split('/').slice(-1)[0] : mime;",
    "    typeCounts.set(shortType, (typeCounts.get(shortType) ?? 0) + 1);",
    "  }",
    "  const topTypes = Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);",
    "  const maxTypeCount = Math.max(1, ...topTypes.map((entry) => Number(entry[1] ?? 0)));",
    "  const styles = {",
    "    shell: { display: 'grid', gap: 12, fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif' },",
    "    title: { margin: 0, fontSize: 30, lineHeight: 1.1, fontWeight: 700 },",
    "    subtitle: { margin: '6px 0 0', fontSize: 12, color: 'var(--cd-muted)' },",
    "    kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 },",
    "    kpi: { border: '1px solid var(--cd-panel-border)', borderRadius: 12, padding: 12, background: 'var(--cd-panel-bg)' },",
    "    label: { fontSize: 12, color: 'var(--cd-muted)', marginBottom: 6 },",
    "    value: { fontSize: 28, fontWeight: 700, lineHeight: 1, color: 'var(--cd-strong)' },",
    "    panel: { border: '1px solid var(--cd-panel-border)', borderRadius: 12, padding: 12, background: 'var(--cd-panel-bg)' },",
    "    barRow: { display: 'grid', gridTemplateColumns: 'minmax(90px,1fr) minmax(120px,2fr) 36px', alignItems: 'center', gap: 8, marginBottom: 8 },",
    "    barTrack: { height: 8, borderRadius: 999, background: 'var(--cd-track)' },",
    "    barFill: { height: '100%', borderRadius: 999, background: 'var(--cd-accent)' },",
    "    muted: { fontSize: 12, color: 'var(--cd-muted)' },",
    "  };",
    "  return (",
    "    <div style={styles.shell}>",
    `      <h2 style={styles.title}>${safeTitle}</h2>`,
    "      <p style={styles.subtitle}>Runtime-upgraded preview for this legacy dashboard code.</p>",
    "      <div style={styles.kpiGrid}>",
    "        <div style={styles.kpi}><div style={styles.label}>Total items</div><div style={styles.value}>{rows.length}</div></div>",
    "        <div style={styles.kpi}><div style={styles.label}>Folders</div><div style={styles.value}>{folderCount}</div></div>",
    "        <div style={styles.kpi}><div style={styles.label}>Files</div><div style={styles.value}>{fileCount}</div></div>",
    "      </div>",
    "      <div style={styles.panel}>",
    "        <div style={{ ...styles.label, marginBottom: 10 }}>Top file types</div>",
    "        {topTypes.length === 0 ? (",
    "          <div style={styles.muted}>No file rows available in this snapshot.</div>",
    "        ) : (",
    "          <div>",
    "            {topTypes.map(([label, count]) => {",
    "              const width = Math.max(8, Math.round((Number(count) / maxTypeCount) * 100));",
    "              return (",
    "                <div key={label} style={styles.barRow}>",
    "                  <div style={styles.muted}>{label}</div>",
    "                  <div style={styles.barTrack}><div style={{ ...styles.barFill, width: `${width}%` }} /></div>",
    "                  <div style={{ fontSize: 12, fontWeight: 600, textAlign: 'right' }}>{count}</div>",
    "                </div>",
    "              );",
    "            })}",
    "          </div>",
    "        )}",
    "      </div>",
    "    </div>",
    "  );",
    "}",
  ].join("\\n");
}

function normalizeRuntimeCode(codeTsx: string, titleHint?: string): string {
  if (!codeTsx.trim()) return codeTsx;
  if (looksLikeLegacyJsonFallback(codeTsx)) {
    return buildEnhancedFallbackCode(titleHint);
  }
  return codeTsx;
}

function buildSandboxSrcDoc(params: { token: string; parentOrigin: string; themeMode: "dark" | "light" }): string {
  const tokenJson = JSON.stringify(params.token);
  const parentOriginJson = JSON.stringify(params.parentOrigin);
  const isDark = params.themeMode === "dark";
  const pageBg = isDark ? "#020617" : "#f8fafc";
  const pageFg = isDark ? "#e2e8f0" : "#0f172a";
  const cardBg = isDark ? "#0b1220" : "#ffffff";
  const cardBorder = isDark ? "rgba(148, 163, 184, 0.22)" : "rgba(15, 23, 42, 0.12)";
  const cardShadow = isDark ? "0 8px 26px rgba(2, 6, 23, 0.5)" : "0 8px 26px rgba(15, 23, 42, 0.08)";
  const kpiLabelColor = isDark ? "#94a3b8" : "#475569";
  const kpiValueColor = isDark ? "#f8fafc" : "#0f172a";
  const errorBg = isDark ? "#2b0b10" : "#fff1f2";
  const errorBorder = isDark ? "rgba(248, 113, 113, 0.5)" : "rgba(239, 68, 68, 0.4)";
  const errorText = isDark ? "#fecaca" : "#7f1d1d";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' https://unpkg.com; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none';" />
  <style>
    :root {
      color-scheme: light;
      --cd-panel-bg: ${cardBg};
      --cd-panel-alt: ${isDark ? "#111b2f" : "#f8fafc"};
      --cd-panel-border: ${cardBorder};
      --cd-muted: ${kpiLabelColor};
      --cd-strong: ${kpiValueColor};
      --cd-accent: ${isDark ? "#38bdf8" : "#0284c7"};
      --cd-track: ${isDark ? "rgba(148, 163, 184, 0.2)" : "rgba(148, 163, 184, 0.3)"};
    }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
      background: ${pageBg};
      color: ${pageFg};
      padding: 14px;
    }
    #root { min-height: 320px; }
    .runtime-card {
      border: 1px solid ${cardBorder};
      background: ${cardBg};
      border-radius: 14px;
      padding: 14px;
      box-shadow: ${cardShadow};
    }
    .runtime-kpis {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    }
    .runtime-kpi {
      border: 1px solid ${cardBorder};
      border-radius: 12px;
      padding: 12px;
      background: ${cardBg};
    }
    .runtime-kpi-label {
      font-size: 11px;
      color: ${kpiLabelColor};
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 6px;
    }
    .runtime-kpi-value {
      font-size: 24px;
      font-weight: 700;
      color: ${kpiValueColor};
      line-height: 1;
    }
    .runtime-error {
      border: 1px solid ${errorBorder};
      border-radius: 12px;
      background: ${errorBg};
      color: ${errorText};
      padding: 12px;
      font-size: 12px;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div id="root"></div>

  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone@7.27.6/babel.min.js"></script>

  <script>
    (() => {
      const BRIDGE_TOKEN = ${tokenJson};
      const PARENT_ORIGIN = ${parentOriginJson};
      const rootEl = document.getElementById("root");
      let root = null;

      function post(type, payload) {
        window.parent.postMessage({
          __custom_dashboard_bridge: true,
          token: BRIDGE_TOKEN,
          type,
          payload
        }, PARENT_ORIGIN || "*");
      }

      function ensureRoot() {
        if (!root) {
          root = window.ReactDOM.createRoot(rootEl);
        }
        return root;
      }

      function setInlineError(message) {
        rootEl.innerHTML = '<div class="runtime-error">' + message
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;") + '</div>';
      }

      class RuntimeErrorBoundary extends window.React.Component {
        constructor(props) {
          super(props);
          this.state = { hasError: false, message: "" };
        }
        static getDerivedStateFromError(error) {
          return { hasError: true, message: String(error && error.message ? error.message : error) };
        }
        componentDidCatch(error) {
          post("diagnostic", {
            level: "error",
            message: "Runtime error: " + String(error && error.message ? error.message : error),
            timestamp: new Date().toISOString()
          });
        }
        render() {
          if (this.state.hasError) {
            return window.React.createElement("div", { className: "runtime-error" }, this.state.message);
          }
          return this.props.children;
        }
      }

      function compileAndRender(payload) {
        const codeTsx = payload && typeof payload.codeTsx === "string" ? payload.codeTsx : "";
        if (!codeTsx.trim()) {
          const msg = "Empty custom dashboard code payload.";
          setInlineError(msg);
          post("diagnostic", { level: "error", message: msg, timestamp: new Date().toISOString() });
          return;
        }

        try {
          const transpiled = window.Babel.transform(codeTsx, {
            filename: "custom-dashboard.tsx",
            presets: [
              ["typescript", { isTSX: true, allExtensions: true }],
              "react"
            ],
            plugins: ["transform-modules-commonjs"]
          }).code;

          const module = { exports: {} };
          const exports = module.exports;
          const factory = new Function(
            "React",
            "module",
            "exports",
            transpiled + "\\n; return (module.exports && module.exports.default) || (exports && exports.default) || (typeof CustomDashboard !== 'undefined' ? CustomDashboard : null);"
          );
          const Component = factory(window.React, module, exports);
          if (typeof Component !== "function") {
            throw new Error("Generated code must export default a React component.");
          }

          const props = {
            snapshotData: payload && typeof payload.snapshotData === "object" ? payload.snapshotData : {},
            queryPlan: payload && Array.isArray(payload.queryPlan) ? payload.queryPlan : [],
            sources: payload && Array.isArray(payload.sources) ? payload.sources : [],
            refreshedAt: payload && typeof payload.refreshedAt === "string" ? payload.refreshedAt : null
          };

          ensureRoot().render(
            window.React.createElement(
              RuntimeErrorBoundary,
              null,
              window.React.createElement(Component, props)
            )
          );

          post("diagnostic", {
            level: "info",
            message: "Render completed.",
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          const msg = "Compile error: " + String(error && error.message ? error.message : error);
          setInlineError(msg);
          post("diagnostic", {
            level: "error",
            message: msg,
            timestamp: new Date().toISOString()
          });
        }
      }

      window.addEventListener("message", (event) => {
        if (event.source !== window.parent) return;
        if (PARENT_ORIGIN && event.origin !== PARENT_ORIGIN) {
          post("bridge_reject", {
            level: "warning",
            reason: "origin_mismatch",
            timestamp: new Date().toISOString()
          });
          return;
        }
        const msg = event.data;
        if (!msg || msg.__custom_dashboard_bridge !== true || msg.token !== BRIDGE_TOKEN) return;
        if (msg.type !== "render") {
          post("bridge_reject", {
            level: "warning",
            reason: "unknown_command",
            command: msg.type,
            timestamp: new Date().toISOString()
          });
          return;
        }
        compileAndRender(msg.payload || {});
      });

      post("ready", { timestamp: new Date().toISOString() });
    })();
  </script>
</body>
</html>`;
}

export function CustomDashboardRuntime({
  codeTsx,
  snapshotData,
  queryPlan,
  sources,
  className,
  embedded = false,
  showDiagnostics = true,
  iframeClassName,
  titleHint,
}: {
  codeTsx: string;
  snapshotData: Record<string, unknown>;
  queryPlan: CustomDashboardQueryPlanStep[];
  sources: string[];
  className?: string;
  embedded?: boolean;
  showDiagnostics?: boolean;
  iframeClassName?: string;
  titleHint?: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [frameReady, setFrameReady] = useState(false);
  const [diagnostics, setDiagnostics] = useState<RuntimeDiagnostic[]>([]);
  const token = useMemo(() => crypto.randomUUID(), []);
  const parentOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const themeMode: "dark" | "light" = typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark")
    ? "dark"
    : "light";
  const srcDoc = useMemo(
    () => buildSandboxSrcDoc({ token, parentOrigin, themeMode }),
    [token, parentOrigin, themeMode],
  );
  const effectiveCodeTsx = useMemo(() => normalizeRuntimeCode(codeTsx, titleHint), [codeTsx, titleHint]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== "null") return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;
      const bridge = data as {
        __custom_dashboard_bridge?: unknown;
        token?: unknown;
        type?: unknown;
        payload?: unknown;
      };
      if (bridge.__custom_dashboard_bridge !== true || bridge.token !== token) return;

      if (bridge.type === "ready") {
        setFrameReady(true);
        return;
      }

      if (bridge.type === "diagnostic" && bridge.payload && typeof bridge.payload === "object") {
        const payload = bridge.payload as {
          level?: unknown;
          message?: unknown;
          timestamp?: unknown;
        };
        const level = payload.level === "error" || payload.level === "warning" ? payload.level : "info";
        const message = typeof payload.message === "string" ? payload.message : "Runtime diagnostic";
        const timestamp = typeof payload.timestamp === "string" ? payload.timestamp : new Date().toISOString();
        setDiagnostics((prev) => [...prev.slice(-11), { level, message, timestamp }]);
        return;
      }

      if (bridge.type === "bridge_reject" && bridge.payload && typeof bridge.payload === "object") {
        const payload = bridge.payload as { reason?: unknown; command?: unknown };
        const reason = typeof payload.reason === "string" ? payload.reason : "bridge_reject";
        const command = typeof payload.command === "string" ? payload.command : "";
        setDiagnostics((prev) => [
          ...prev.slice(-11),
          {
            level: "warning",
            message: `Bridge rejected message (${reason})${command ? `: ${command}` : ""}.`,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [token]);

  useEffect(() => {
    setDiagnostics([]);
  }, [effectiveCodeTsx]);

  useEffect(() => {
    if (!frameReady) return;
    const target = iframeRef.current?.contentWindow;
    if (!target) return;
    target.postMessage(
      {
        __custom_dashboard_bridge: true,
        token,
        type: "render",
        payload: {
          codeTsx: effectiveCodeTsx,
          snapshotData,
          queryPlan,
          sources,
          refreshedAt: typeof snapshotData?.refreshedAt === "string" ? snapshotData.refreshedAt : null,
        },
      },
      "*",
    );
  }, [frameReady, token, effectiveCodeTsx, snapshotData, queryPlan, sources]);

  const frameNode = (
    <iframe
      ref={iframeRef}
      title="Custom dashboard sandbox runtime"
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      className={cn(
        "h-[min(640px,70vh)] w-full rounded-xl border border-border/70 bg-transparent",
        iframeClassName,
      )}
      srcDoc={srcDoc}
    />
  );

  const diagnosticsNode = showDiagnostics && diagnostics.length > 0 ? (
    <div className="space-y-2 rounded-xl border border-border/70 bg-muted/20 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Runtime diagnostics
      </p>
      <div className="space-y-1.5">
        {diagnostics.map((diag, idx) => (
          <div
            key={`${diag.timestamp}-${idx}`}
            className={cn(
              "flex items-start gap-2 text-xs",
              diag.level === "error" ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {diag.level === "error" ? (
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
            )}
            <span>{diag.message}</span>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  if (embedded) {
    return (
      <div className={cn("space-y-2", className)}>
        {frameNode}
        {diagnosticsNode}
      </div>
    );
  }

  return (
    <Card className={cn("border-border/80 bg-card/90", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Custom runtime preview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {frameNode}
        {diagnosticsNode}
      </CardContent>
    </Card>
  );
}
