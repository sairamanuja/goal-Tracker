"use client";

import {
  LineChart,
  Line,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type TrendPoint = { quarter: string; avg: number | null };

export function TeamTrendSparkline({ data }: { data: TrendPoint[] }) {
  const hasData = data.some((d) => d.avg !== null);
  if (!hasData) {
    return (
      <p className="text-xs text-muted-foreground text-center py-4">
        No score data yet
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={80}>
      <LineChart
        data={data}
        margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
      >
        <XAxis
          dataKey="quarter"
          tick={{ fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value) => [
            `${Number(value ?? 0).toFixed(1)}`,
            "Team Avg",
          ]}
          contentStyle={{ fontSize: 11 }}
        />
        <Line
          type="monotone"
          dataKey="avg"
          stroke="hsl(221, 83%, 53%)"
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
