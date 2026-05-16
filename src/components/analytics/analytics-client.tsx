"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { TrendsChart, type EmployeeTrend } from "./trends-chart";
import { CompletionHeatmap, type DeptHeatmapRow } from "./completion-heatmap";
import {
  DistributionCharts,
  type StatusByDept,
} from "./distribution-charts";
import {
  EffectivenessTable,
  type ManagerEffectiveness,
} from "./effectiveness-table";

type AnalyticsClientProps = {
  cycleName: string;
  employeeTrends: EmployeeTrend[];
  deptHeatmap: DeptHeatmapRow[];
  thrustAreaCounts: { name: string; count: number }[];
  uomTypeCounts: { name: string; count: number }[];
  statusByDept: StatusByDept[];
  managerEffectiveness: ManagerEffectiveness[];
};

export function AnalyticsClient({
  cycleName,
  employeeTrends,
  deptHeatmap,
  thrustAreaCounts,
  uomTypeCounts,
  statusByDept,
  managerEffectiveness,
}: AnalyticsClientProps) {
  return (
    <Tabs defaultValue="trends" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="overflow-x-auto">
          <TabsList variant="line" className="min-w-max">
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="completion">Completion</TabsTrigger>
            <TabsTrigger value="distribution">Distribution</TabsTrigger>
            <TabsTrigger value="effectiveness">Effectiveness</TabsTrigger>
          </TabsList>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">{cycleName}</span>
      </div>

      <TabsContent value="trends">
        <TrendsChart employees={employeeTrends} />
      </TabsContent>

      <TabsContent value="completion" className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Completion Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time view of goal-setting and check-in completion rates across departments and managers.
          </p>
        </div>

        <CompletionHeatmap data={deptHeatmap} />

        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Manager Check-in Completion</h3>
          <Card>
            <CardContent className="pt-4 pb-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium">Manager</th>
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Dept</th>
                    <th className="text-center py-2 px-3 font-medium">Team Size</th>
                    <th className="text-center py-2 px-3 font-medium">Check-ins Done</th>
                    <th className="text-center py-2 px-3 font-medium">Completion Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {managerEffectiveness.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                        No managers found.
                      </td>
                    </tr>
                  ) : (
                    managerEffectiveness.map((m) => {
                      const cls =
                        m.checkInRate >= 80
                          ? "bg-green-100 text-green-800"
                          : m.checkInRate >= 50
                            ? "bg-amber-100 text-amber-800"
                            : "bg-red-100 text-red-700";
                      return (
                        <tr key={m.id} className="border-t hover:bg-muted/30">
                          <td className="py-2.5 pr-4 font-medium">{m.name}</td>
                          <td className="py-2.5 pr-4 text-xs text-muted-foreground">{m.department ?? "—"}</td>
                          <td className="px-3 py-2.5 text-center">{m.teamSize}</td>
                          <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">
                            {m.checkInsDone}/{m.checkInsPossible}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${cls}`}>
                              {m.checkInRate}%
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="distribution">
        <DistributionCharts
          thrustAreas={thrustAreaCounts}
          uomTypes={uomTypeCounts}
          statusByDept={statusByDept}
        />
      </TabsContent>

      <TabsContent value="effectiveness">
        <EffectivenessTable managers={managerEffectiveness} />
      </TabsContent>
    </Tabs>
  );
}
