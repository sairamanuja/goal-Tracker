"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type ManagerEffectiveness = {
  id: string;
  name: string;
  department: string | null;
  teamSize: number;
  checkInsDone: number;
  checkInsPossible: number;
  checkInRate: number;
  teamAvgScore: number | null;
  approvedCount: number;
};

function RateBadge({ value }: { value: number }) {
  const cls =
    value >= 80
      ? "bg-green-100 text-green-800"
      : value >= 50
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-700";
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}
    >
      {value}%
    </span>
  );
}

function ScoreBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  const cls =
    value >= 80
      ? "bg-green-100 text-green-800"
      : value >= 50
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-700";
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}
    >
      {value.toFixed(1)}
    </span>
  );
}

export function EffectivenessTable({
  managers,
}: {
  managers: ManagerEffectiveness[];
}) {
  if (managers.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground text-sm">
          No managers found.
        </CardContent>
      </Card>
    );
  }

  const barData = managers.map((m) => ({
    name: m.name.split(" ")[0],
    "Check-in Rate": m.checkInRate,
    "Team Score": m.teamAvgScore ?? 0,
  }));

  return (
    <div className="space-y-6">
      {/* Bar overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Manager Effectiveness Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={barData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="Check-in Rate"
                fill="#4f46e5"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="Team Score"
                fill="#22c55e"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detailed table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detailed Comparison</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2.5 pr-4 font-medium">Manager</th>
                <th className="text-left py-2.5 pr-4 font-medium text-muted-foreground">
                  Dept
                </th>
                <th className="text-center py-2.5 px-3 font-medium">
                  Team Size
                </th>
                <th className="text-center py-2.5 px-3 font-medium">
                  Approved
                </th>
                <th className="text-center py-2.5 px-3 font-medium">
                  Check-ins
                </th>
                <th className="text-center py-2.5 px-3 font-medium">
                  Check-in Rate
                </th>
                <th className="text-center py-2.5 px-3 font-medium">
                  Team Avg Score
                </th>
              </tr>
            </thead>
            <tbody>
              {managers.map((m) => (
                <tr key={m.id} className="border-t hover:bg-muted/30">
                  <td className="py-2.5 pr-4 font-medium">{m.name}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground text-xs">
                    {m.department ?? "—"}
                  </td>
                  <td className="text-center py-2.5 px-3">{m.teamSize}</td>
                  <td className="text-center py-2.5 px-3">{m.approvedCount}</td>
                  <td className="text-center py-2.5 px-3 text-muted-foreground text-xs">
                    {m.checkInsDone}/{m.checkInsPossible}
                  </td>
                  <td className="text-center py-2.5 px-3">
                    <RateBadge value={m.checkInRate} />
                  </td>
                  <td className="text-center py-2.5 px-3">
                    <ScoreBadge value={m.teamAvgScore} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
