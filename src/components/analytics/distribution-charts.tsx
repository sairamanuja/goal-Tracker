"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type StatusByDept = {
  department: string;
  DRAFT: number;
  SUBMITTED: number;
  RETURNED: number;
  APPROVED: number;
};

const CHART_COLORS = [
  "#4f46e5", // indigo
  "#10b981", // emerald
  "#f59e0b", // amber
  "#f43f5e", // rose
  "#0ea5e9", // sky
  "#8b5cf6", // violet
];

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#94a3b8",
  SUBMITTED: "#f59e0b",
  RETURNED: "#ef4444",
  APPROVED: "#22c55e",
};

const UOM_LABEL: Record<string, string> = {
  NUMERIC: "Numeric",
  PERCENTAGE: "Percentage",
  TIMELINE: "Timeline",
  ZERO: "Zero",
};

export function DistributionCharts({
  thrustAreas,
  uomTypes,
  statusByDept,
}: {
  thrustAreas: { name: string; count: number }[];
  uomTypes: { name: string; count: number }[];
  statusByDept: StatusByDept[];
}) {
  const uomData = uomTypes.map((u) => ({
    ...u,
    label: UOM_LABEL[u.name] ?? u.name,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pie: by thrust area */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Goals by Thrust Area</CardTitle>
          </CardHeader>
          <CardContent>
            {thrustAreas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No data
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={thrustAreas}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    outerRadius={85}
                  >
                    {thrustAreas.map((_, i) => (
                      <Cell
                        key={i}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => [v ?? 0, "Goals"]}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    iconSize={10}
                    formatter={(value) =>
                      value.length > 18 ? value.slice(0, 17) + "…" : value
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Bar: by UoM */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Goals by UoM Type</CardTitle>
          </CardHeader>
          <CardContent>
            {uomData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No data
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={uomData}
                  margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(v) => [v ?? 0, "Goals"]}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={52}>
                    {uomData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                    <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: "#6b7280", fontWeight: 500 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stacked bar: status by dept */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Goals by Status per Department
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statusByDept.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No data
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={statusByDept}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="department" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {(
                  ["DRAFT", "SUBMITTED", "RETURNED", "APPROVED"] as const
                ).map((status) => (
                  <Bar
                    key={status}
                    dataKey={status}
                    stackId="a"
                    fill={STATUS_COLORS[status]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
