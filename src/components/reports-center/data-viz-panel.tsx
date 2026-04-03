import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ensureArray } from "@/lib/reports-center-safe";

export type VizPoint = { name: string; value: number };

export interface DataVizPanelProps {
  title: string;
  caption?: string;
  mode: "chart_bar" | "chart_line" | "table";
  points: unknown;
  className?: string;
}

function normalizePoints(raw: unknown): VizPoint[] {
  const arr = ensureArray<Record<string, unknown>>(raw);
  return arr
    .map((row, i) => {
      const name =
        typeof row.name === "string"
          ? row.name
          : typeof row.label === "string"
            ? row.label
            : `P${i + 1}`;
      const v = row.value ?? row.v ?? row.amount;
      const value = typeof v === "number" && Number.isFinite(v) ? v : 0;
      return { name, value };
    })
    .filter((p) => p.name.length > 0);
}

export function DataVizPanel({
  title,
  caption,
  mode,
  points,
  className,
}: DataVizPanelProps) {
  const data = normalizePoints(points);
  const safe = data.length > 0 ? data : [{ name: "—", value: 0 }];

  return (
    <div
      className={cn(
        "rounded-xl border border-[rgb(21,78,120)]/40 bg-[rgb(15,23,32)]/95 p-4 shadow-sm transition-shadow duration-200 hover:shadow-md hover:shadow-[rgb(154,208,255)]/5",
        className,
      )}
    >
      <div className="mb-3 flex flex-col gap-1">
        <h3 className="font-display text-sm font-semibold text-[rgb(154,208,255)]">
          {title}
        </h3>
        {caption ? (
          <p className="text-xs text-muted-foreground">{caption}</p>
        ) : null}
      </div>
      {mode === "table" ? (
        <div className="max-h-64 overflow-auto rounded-lg border border-white/[0.06]">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-[rgb(247,250,255)]">Label</TableHead>
                <TableHead className="text-right text-[rgb(247,250,255)]">
                  Value
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {safe.map((row) => (
                <TableRow
                  key={row.name}
                  className="border-white/[0.06] transition-colors duration-150 hover:bg-white/[0.04]"
                >
                  <TableCell className="text-muted-foreground">{row.name}</TableCell>
                  <TableCell className="text-right font-medium text-[rgb(247,250,255)]">
                    {row.value}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="h-64 w-full min-h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            {mode === "chart_line" ? (
              <LineChart data={safe}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="rgb(143,160,176)" tick={{ fontSize: 11 }} />
                <YAxis stroke="rgb(143,160,176)" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "rgb(15,23,32)",
                    border: "1px solid rgb(21,78,120)",
                    borderRadius: "8px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="rgb(0,210,122)"
                  strokeWidth={2}
                  dot={{ fill: "rgb(154,208,255)", r: 3 }}
                />
              </LineChart>
            ) : (
              <BarChart data={safe}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="rgb(143,160,176)" tick={{ fontSize: 11 }} />
                <YAxis stroke="rgb(143,160,176)" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "rgb(15,23,32)",
                    border: "1px solid rgb(21,78,120)",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="value" fill="rgb(154,208,255)" radius={[6, 6, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
