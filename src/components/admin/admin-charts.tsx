"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";

interface FunnelData {
  stage: string;
  count: number;
}

interface DeptData {
  department: string;
  rate: number;
}

const DEPT_COLORS = ["#4f46e5", "#10b981", "#0ea5e9", "#f59e0b", "#f43f5e"];

const TOOLTIP_STYLE = {
  fontSize: 12,
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
};

export function CompletionFunnelChart({ data }: { data: FunnelData[] }) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={data} margin={{ top: 24, right: 10, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="indigoGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#4f46e5" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
        <XAxis dataKey="stage" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(value) => [value ?? 0, "Employees"]}
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: "#f5f3ff" }}
        />
        <Bar dataKey="count" fill="url(#indigoGrad)" radius={[4, 4, 0, 0]} maxBarSize={48}>
          <LabelList
            dataKey="count"
            position="top"
            style={{ fontSize: 11, fill: "#6b7280", fontWeight: 500 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DeptCompletionChart({ data }: { data: DeptData[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 68)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 44, left: 0, bottom: 5 }}
        barCategoryGap="28%"
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
        <YAxis type="category" dataKey="department" tick={{ fontSize: 11 }} width={90} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(value) => [`${Number(value ?? 0).toFixed(0)}%`, "Approval rate"]}
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: "#f5f3ff" }}
        />
        <Bar dataKey="rate" radius={[0, 4, 4, 0]} maxBarSize={48}>
          {data.map((_, index) => (
            <Cell key={index} fill={DEPT_COLORS[index % DEPT_COLORS.length]} />
          ))}
          <LabelList
            dataKey="rate"
            position="right"
            formatter={(v: unknown) => `${Number(v ?? 0).toFixed(0)}%`}
            style={{ fontSize: 11, fill: "#6b7280", fontWeight: 500 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
