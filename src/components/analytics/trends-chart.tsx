"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type QuarterlyScore = {
  Q1: number | null;
  Q2: number | null;
  Q3: number | null;
  Q4: number | null;
};

export type EmployeeTrend = {
  id: string;
  name: string;
  department: string | null;
  managerId: string | null;
  scores: QuarterlyScore;
};

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"] as const;
const COLORS = [
  "#4f46e5",
  "#10b981",
  "#f59e0b",
];

const selectClass =
  "h-8 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";

export function TrendsChart({ employees }: { employees: EmployeeTrend[] }) {
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [selectedDept, setSelectedDept] = useState("");

  const departments = useMemo(
    () =>
      [
        ...new Set(
          employees.map((e) => e.department).filter(Boolean) as string[]
        ),
      ].sort(),
    [employees]
  );

  const selectedEmpName = useMemo(
    () => employees.find((e) => e.id === selectedEmpId)?.name ?? "",
    [employees, selectedEmpId]
  );

  const chartData = useMemo(() => {
    return QUARTERS.map((q) => {
      const allScores = employees
        .map((e) => e.scores[q])
        .filter((s): s is number => s !== null);
      const overall =
        allScores.length > 0
          ? allScores.reduce((a, b) => a + b, 0) / allScores.length
          : null;

      const deptEmps = selectedDept
        ? employees.filter((e) => e.department === selectedDept)
        : [];
      const deptScores = deptEmps
        .map((e) => e.scores[q])
        .filter((s): s is number => s !== null);
      const deptAvg =
        deptScores.length > 0
          ? deptScores.reduce((a, b) => a + b, 0) / deptScores.length
          : null;

      const empScore = selectedEmpId
        ? (employees.find((e) => e.id === selectedEmpId)?.scores[q] ?? null)
        : null;

      const point: Record<string, number | null | string> = {
        quarter: q,
        "Overall Avg": overall !== null ? Math.round(overall * 10) / 10 : null,
      };
      if (selectedDept)
        point[`${selectedDept} Avg`] =
          deptAvg !== null ? Math.round(deptAvg * 10) / 10 : null;
      if (selectedEmpId && selectedEmpName)
        point[selectedEmpName] =
          empScore !== null ? Math.round(empScore * 10) / 10 : null;

      return point;
    });
  }, [employees, selectedEmpId, selectedEmpName, selectedDept]);

  const lines = useMemo(() => {
    const ls: { key: string; color: string }[] = [
      { key: "Overall Avg", color: COLORS[0] },
    ];
    if (selectedDept) ls.push({ key: `${selectedDept} Avg`, color: COLORS[1] });
    if (selectedEmpId && selectedEmpName)
      ls.push({ key: selectedEmpName, color: COLORS[2] });
    return ls;
  }, [selectedDept, selectedEmpId, selectedEmpName]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <CardTitle className="text-base">QoQ Achievement Trends</CardTitle>
          <div className="flex gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Employee</label>
              <select
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                className={selectClass}
              >
                <option value="">All</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Department</label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className={selectClass}
              >
                <option value="">All</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="quarter" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value) => [
                `${Number(value ?? 0).toFixed(1)}`,
                "Score",
              ]}
              contentStyle={{ fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {lines.map(({ key, color }) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={color}
                strokeWidth={2}
                dot={{ r: 4 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
