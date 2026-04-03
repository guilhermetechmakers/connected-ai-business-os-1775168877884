import { logExecutiveExport } from "@/api/executive-dashboard";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { ExecutiveDashboardSnapshot } from "@/types/executive-dashboard";

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function snapshotToCsvRows(snapshot: ExecutiveDashboardSnapshot): string {
  const lines: string[] = ["section,key,value,extra"];
  for (const k of snapshot.kpis ?? []) {
    lines.push(
      [
        "kpi",
        escapeCsvCell(k.name),
        escapeCsvCell(k.valueText),
        escapeCsvCell([k.delta, k.unit, k.trend].filter(Boolean).join(" · ")),
      ].join(","),
    );
  }
  for (const r of snapshot.risks ?? []) {
    lines.push(
      [
        "risk",
        escapeCsvCell(r.title),
        escapeCsvCell(r.severity),
        escapeCsvCell(r.status),
      ].join(","),
    );
  }
  for (const d of snapshot.departments ?? []) {
    lines.push(
      [
        "department",
        escapeCsvCell(d.name),
        String(d.intensity),
        escapeCsvCell(d.trend),
      ].join(","),
    );
  }
  return lines.join("\n");
}

function triggerDownload(filename: string, mime: string, body: string): void {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportExecutiveDashboardCsv(snapshot: ExecutiveDashboardSnapshot): Promise<void> {
  const csv = snapshotToCsvRows(snapshot);
  triggerDownload(`executive-dashboard-${Date.now()}.csv`, "text/csv;charset=utf-8", csv);
  if (isSupabaseConfigured) {
    await logExecutiveExport({
      exportType: "csv",
      metadata: { rowEstimate: (snapshot.kpis?.length ?? 0) + (snapshot.risks?.length ?? 0) },
    });
  }
}

export async function exportExecutiveDashboardJson(snapshot: ExecutiveDashboardSnapshot): Promise<void> {
  const body = JSON.stringify(snapshot, null, 2);
  triggerDownload(`executive-dashboard-${Date.now()}.json`, "application/json;charset=utf-8", body);
  if (isSupabaseConfigured) {
    await logExecutiveExport({ exportType: "json", metadata: { bytes: body.length } });
  }
}

/**
 * PDF placeholder: structured print-friendly HTML saved as .html for now (browser print-to-PDF).
 */
export async function exportExecutiveDashboardPrintableHtml(snapshot: ExecutiveDashboardSnapshot): Promise<void> {
  const kpis = Array.isArray(snapshot.kpis) ? snapshot.kpis : [];
  const risks = Array.isArray(snapshot.risks) ? snapshot.risks : [];
  const depts = Array.isArray(snapshot.departments) ? snapshot.departments : [];
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Executive dashboard</title>
  <style>body{font-family:system-ui,sans-serif;padding:24px;color:#081017} h1{color:#154E78} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ccc;padding:8px;text-align:left}</style></head><body>
  <h1>Executive dashboard</h1><p>Generated ${snapshot.generatedAt}</p>
  <h2>KPIs</h2><table><tr><th>Name</th><th>Value</th><th>Delta</th></tr>
  ${kpis.map((k) => `<tr><td>${escapeHtml(k.name)}</td><td>${escapeHtml(k.valueText)}</td><td>${escapeHtml(k.delta ?? "")}</td></tr>`).join("")}
  </table>
  <h2>Risks</h2><table><tr><th>Title</th><th>Severity</th></tr>
  ${risks.map((r) => `<tr><td>${escapeHtml(r.title)}</td><td>${escapeHtml(r.severity)}</td></tr>`).join("")}
  </table>
  <h2>Departments</h2><table><tr><th>Name</th><th>Intensity</th></tr>
  ${depts.map((d) => `<tr><td>${escapeHtml(d.name)}</td><td>${d.intensity}</td></tr>`).join("")}
  </table>
  </body></html>`;
  triggerDownload(`executive-dashboard-${Date.now()}.html`, "text/html;charset=utf-8", html);
  if (isSupabaseConfigured) {
    await logExecutiveExport({ exportType: "pdf", metadata: { format: "printable-html" } });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
