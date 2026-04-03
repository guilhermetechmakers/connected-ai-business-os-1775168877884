import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const data = [
  { t: "Mon", v: 42 },
  { t: "Tue", v: 55 },
  { t: "Wed", v: 48 },
  { t: "Thu", v: 62 },
  { t: "Fri", v: 58 },
  { t: "Sat", v: 71 },
  { t: "Sun", v: 66 },
];

export function LandingHeroChart() {
  return (
    <div className="h-[140px] w-full" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id="landingHeroFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(154 208 255)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="rgb(154 208 255)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="t" stroke="rgb(143 160 176 / 0.5)" tickLine={false} axisLine={false} fontSize={10} />
          <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
          <Tooltip
            contentStyle={{
              background: "rgb(15 23 32)",
              border: "1px solid rgb(21 78 120 / 0.4)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            labelStyle={{ color: "rgb(247 250 255)" }}
          />
          <Area
            type="monotone"
            dataKey="v"
            stroke="rgb(154 208 255)"
            strokeWidth={1.5}
            fill="url(#landingHeroFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
