"use client";

import {
  LineChart,
  Line,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type TrendPoint = { quarter: string; score: number | null };

export function ScoreSparkline({ data }: { data: TrendPoint[] }) {
  const hasData = data.some((d) => d.score !== null);
  if (!hasData) return null;

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
            "Score",
          ]}
          contentStyle={{ fontSize: 11 }}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke="hsl(142, 71%, 45%)"
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
