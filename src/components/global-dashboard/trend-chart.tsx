import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type TrendChartDatum = { name: string; value: number };

export type TrendChartProps = {
  data: TrendChartDatum[];
  className?: string;
  /** Accessible label for the chart region. */
  "aria-label"?: string;
};

const DEFAULT_DATA: TrendChartDatum[] = [
  { name: "Mon", value: 32 },
  { name: "Tue", value: 40 },
  { name: "Wed", value: 38 },
  { name: "Thu", value: 52 },
  { name: "Fri", value: 61 },
];

/**
 * Lightweight Recharts area trend — design tokens #9AD0FF primary, neutral axis #8FA0B0.
 */
export function TrendChart({ data, className, "aria-label": ariaLabel }: TrendChartProps) {
  const series = Array.isArray(data) && data.length > 0 ? data : DEFAULT_DATA;

  return (
    <div className={className} role="img" aria-label={ariaLabel ?? "Trend chart"}>
      <div className="h-44 w-full min-h-[176px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series}>
            <defs>
              <linearGradient id="trendChartFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="rgb(154,208,255)" stopOpacity={0.45} />
                <stop offset="95%" stopColor="rgb(154,208,255)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="name" stroke="rgb(143,160,176)" tickLine={false} />
            <YAxis stroke="rgb(143,160,176)" tickLine={false} width={32} />
            <Tooltip
              contentStyle={{
                background: "rgb(15,23,32)",
                border: "1px solid rgb(17,32,43)",
                borderRadius: 8,
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="rgb(154,208,255)"
              fill="url(#trendChartFill)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
