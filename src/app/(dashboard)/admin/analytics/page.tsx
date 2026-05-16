import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import { AnalyticsClient } from "@/components/analytics/analytics-client";
import type { DeptHeatmapRow } from "@/components/analytics/completion-heatmap";
import type { ManagerEffectiveness } from "@/components/analytics/effectiveness-table";
import type { EmployeeTrend } from "@/components/analytics/trends-chart";
import type { StatusByDept } from "@/components/analytics/distribution-charts";

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"] as const;

type GoalWithAchievements = {
  id: string;
  status: string;
  weightage: number;
  thrustArea: string;
  uomType: string;
  achievements: { quarter: string; score: number | null; actual: number | null }[];
};

function computeQuarterScore(
  goals: GoalWithAchievements[],
  quarter: string
): number | null {
  const approved = goals.filter((g) => g.status === "APPROVED");
  if (approved.length === 0) return null;
  const contributions = approved.flatMap((g) => {
    const ach = g.achievements.find(
      (a) => a.quarter === quarter && a.score !== null
    );
    return ach ? [{ score: ach.score!, weightage: g.weightage }] : [];
  });
  if (contributions.length === 0) return null;
  return contributions.reduce(
    (sum, { score, weightage }) => sum + (score * weightage) / 100,
    0
  );
}

const getAnalyticsData = unstable_cache(
  async (cycleId: string) => {
    return Promise.all([
      prisma.user.findMany({
        where: { role: "EMPLOYEE" },
        orderBy: { name: "asc" },
        include: {
          goals: {
            where: { cycleId },
            include: { achievements: true },
          },
        },
      }),
      prisma.user.findMany({
        where: { role: "MANAGER" },
        orderBy: { name: "asc" },
        include: {
          reports: {
            where: { role: "EMPLOYEE" },
            include: {
              goals: {
                where: { cycleId },
                include: { achievements: true },
              },
            },
          },
          checkInsGiven: {
            select: { employeeId: true, quarter: true },
          },
        },
      }),
    ]);
  },
  ["analytics-data"],
  { revalidate: 60, tags: ["analytics"] }
);

import type { Metadata } from "next";
export const metadata: Metadata = { title: "Analytics" };

export default async function AdminAnalyticsPage() {
  await requireAdmin();

  const cycle = await prisma.goalCycle.findFirst({
    where: { status: "ACTIVE" },
  });

  if (!cycle) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-muted-foreground text-sm">
          No active goal cycle. Analytics are available when a cycle is active.
        </p>
      </div>
    );
  }

  const [employees, managers] = await getAnalyticsData(cycle.id);

  // ── 1. Employee quarterly trends ─────────────────────────────────────────
  const employeeTrends: EmployeeTrend[] = employees.map((emp) => ({
    id: emp.id,
    name: emp.name,
    department: emp.department,
    managerId: emp.managerId,
    scores: {
      Q1: computeQuarterScore(emp.goals, "Q1"),
      Q2: computeQuarterScore(emp.goals, "Q2"),
      Q3: computeQuarterScore(emp.goals, "Q3"),
      Q4: computeQuarterScore(emp.goals, "Q4"),
    },
  }));

  // ── 2. Department heatmap ─────────────────────────────────────────────────
  const deptMap = new Map<string, typeof employees>();
  employees.forEach((emp) => {
    const dept = emp.department ?? "Unassigned";
    if (!deptMap.has(dept)) deptMap.set(dept, []);
    deptMap.get(dept)!.push(emp);
  });

  const deptHeatmap: DeptHeatmapRow[] = Array.from(
    deptMap.entries()
  ).map(([dept, emps]) => ({
    department: dept,
    total: emps.length,
    goalsSet: emps.filter((e) => e.goals.length > 0).length,
    submitted: emps.filter(
      (e) =>
        e.goals.length > 0 &&
        e.goals.every((g) => ["SUBMITTED", "APPROVED"].includes(g.status))
    ).length,
    approved: emps.filter(
      (e) =>
        e.goals.length > 0 && e.goals.every((g) => g.status === "APPROVED")
    ).length,
    q1: emps.filter((e) =>
      e.goals.some((g) =>
        g.achievements.some((a) => a.quarter === "Q1" && a.actual !== null)
      )
    ).length,
    q2: emps.filter((e) =>
      e.goals.some((g) =>
        g.achievements.some((a) => a.quarter === "Q2" && a.actual !== null)
      )
    ).length,
    q3: emps.filter((e) =>
      e.goals.some((g) =>
        g.achievements.some((a) => a.quarter === "Q3" && a.actual !== null)
      )
    ).length,
    q4: emps.filter((e) =>
      e.goals.some((g) =>
        g.achievements.some((a) => a.quarter === "Q4" && a.actual !== null)
      )
    ).length,
  }));

  // ── 3. Goal distribution ──────────────────────────────────────────────────
  const allGoals = employees.flatMap((e) => e.goals);
  const thrustMap = new Map<string, number>();
  const uomMap = new Map<string, number>();
  allGoals.forEach((g) => {
    thrustMap.set(g.thrustArea, (thrustMap.get(g.thrustArea) ?? 0) + 1);
    uomMap.set(g.uomType, (uomMap.get(g.uomType) ?? 0) + 1);
  });
  const thrustAreaCounts = Array.from(thrustMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  const uomTypeCounts = Array.from(uomMap.entries()).map(([name, count]) => ({
    name,
    count,
  }));

  const statusByDept: StatusByDept[] = Array.from(deptMap.entries()).map(
    ([dept, emps]) => {
      const deptGoals = emps.flatMap((e) => e.goals);
      return {
        department: dept,
        DRAFT: deptGoals.filter((g) => g.status === "DRAFT").length,
        SUBMITTED: deptGoals.filter((g) => g.status === "SUBMITTED").length,
        RETURNED: deptGoals.filter((g) => g.status === "RETURNED").length,
        APPROVED: deptGoals.filter((g) => g.status === "APPROVED").length,
      };
    }
  );

  // ── 4. Manager effectiveness ──────────────────────────────────────────────
  const managerEffectiveness: ManagerEffectiveness[] = managers.map((mgr) => {
    const reports = mgr.reports;
    const approvedReports = reports.filter(
      (r) =>
        r.goals.length > 0 && r.goals.every((g) => g.status === "APPROVED")
    );
    const reportIds = new Set(reports.map((r) => r.id));

    const checkInsDone = mgr.checkInsGiven.filter((c) =>
      reportIds.has(c.employeeId)
    ).length;
    const checkInsPossible = approvedReports.length * QUARTERS.length;
    const checkInRate =
      checkInsPossible > 0
        ? Math.round((checkInsDone / checkInsPossible) * 100)
        : 0;

    const allScores = reports.flatMap((r) =>
      QUARTERS.map((q) => computeQuarterScore(r.goals, q)).filter(
        (s): s is number => s !== null
      )
    );
    const teamAvgScore =
      allScores.length > 0
        ? Math.round(
            (allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10
          ) / 10
        : null;

    return {
      id: mgr.id,
      name: mgr.name,
      department: mgr.department,
      teamSize: reports.length,
      checkInsDone,
      checkInsPossible,
      checkInRate,
      teamAvgScore,
      approvedCount: approvedReports.length,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {cycle.name} · Interactive performance insights
        </p>
      </div>
      <AnalyticsClient
        cycleName={cycle.name}
        employeeTrends={employeeTrends}
        deptHeatmap={deptHeatmap}
        thrustAreaCounts={thrustAreaCounts}
        uomTypeCounts={uomTypeCounts}
        statusByDept={statusByDept}
        managerEffectiveness={managerEffectiveness}
      />
    </div>
  );
}
