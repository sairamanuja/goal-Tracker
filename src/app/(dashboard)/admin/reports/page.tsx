import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { ReportsClient } from "@/components/admin/reports-client";
import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import type { Quarter } from "@/generated/prisma";

const QUARTERS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];

const getReportsData = unstable_cache(
  async (cycleId: string, dept?: string, thrust?: string) => {
    const [goals, employees] = await Promise.all([
      prisma.goal.findMany({
        where: {
          cycleId,
          status: "APPROVED",
          user: { role: "EMPLOYEE", ...(dept ? { department: dept } : {}) },
          ...(thrust ? { thrustArea: thrust } : {}),
        },
        orderBy: [{ user: { name: "asc" } }, { createdAt: "asc" }],
        include: {
          user: { select: { name: true, department: true } },
          achievements: { select: { quarter: true, planned: true, actual: true, score: true } },
        },
      }),
      prisma.user.findMany({
        where: { role: "EMPLOYEE", ...(dept ? { department: dept } : {}) },
        orderBy: { name: "asc" },
        include: {
          goals: {
            where: { cycleId },
            include: { achievements: { select: { quarter: true, score: true } } },
          },
        },
      }),
    ]);
    return { goals, employees };
  },
  ["reports-data"],
  { revalidate: 60, tags: ["reports"] }
);

import type { Metadata } from "next";
export const metadata: Metadata = { title: "Reports" };

export default async function AdminReportsPage(props: {
  searchParams: Promise<{ dept?: string; thrust?: string; quarter?: string }>;
}) {
  await requireAdmin();
  const { dept, thrust } = await props.searchParams;

  const cycle = await prisma.goalCycle.findFirst({ where: { status: "ACTIVE" } });

  if (!cycle) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-muted-foreground">No active cycle.</p>
      </div>
    );
  }

  const { goals, employees } = await getReportsData(cycle.id, dept, thrust);

  const reports = goals.map((g) => {
    const achByQ = Object.fromEntries(
      QUARTERS.map((q) => {
        const a = g.achievements.find((a) => a.quarter === q);
        return [q, { planned: a?.planned ?? null, actual: a?.actual ?? null, score: a?.score ?? null }];
      })
    ) as Record<Quarter, { planned: number | null; actual: number | null; score: number | null }>;
    const validScores = QUARTERS.map((q) => ({
      score: achByQ[q].score,
      weightage: g.weightage,
    })).filter((s) => s.score !== null);
    const overallScore =
      validScores.length > 0
        ? Math.round(validScores.reduce((sum, s) => sum + (s.score! * s.weightage) / 100, 0) * 100) / 100
        : null;

    return {
      goalId: g.id,
      employeeName: g.user.name,
      department: g.user.department,
      goalTitle: g.title,
      thrustArea: g.thrustArea,
      uomType: g.uomType,
      target: g.target,
      weightage: g.weightage,
      status: g.status,
      isLocked: g.isLocked,
      q1Planned: achByQ["Q1"].planned,
      q1Actual: achByQ["Q1"].actual,
      q1Score: achByQ["Q1"].score,
      q2Planned: achByQ["Q2"].planned,
      q2Actual: achByQ["Q2"].actual,
      q2Score: achByQ["Q2"].score,
      q3Planned: achByQ["Q3"].planned,
      q3Actual: achByQ["Q3"].actual,
      q3Score: achByQ["Q3"].score,
      q4Planned: achByQ["Q4"].planned,
      q4Actual: achByQ["Q4"].actual,
      q4Score: achByQ["Q4"].score,
      overallScore,
    };
  });

  const completion = employees.map((emp) => {
    const gs = emp.goals;
    const hasGoals = gs.length > 0;
    const submitted = gs.length > 0 && gs.some((g) => g.status === "SUBMITTED" || g.status === "APPROVED");
    const approved = gs.length > 0 && gs.every((g) => g.status === "APPROVED");
    const qDone = (q: Quarter) =>
      approved && gs.some((g) => g.achievements.some((a) => a.quarter === q && a.score !== null));
    return {
      employeeName: emp.name,
      department: emp.department,
      hasGoals,
      submitted,
      approved,
      q1: qDone("Q1"),
      q2: qDone("Q2"),
      q3: qDone("Q3"),
      q4: qDone("Q4"),
    };
  });

  const departments = [...new Set(employees.map((e) => e.department).filter(Boolean) as string[])].sort();
  const thrustAreas = [...new Set(goals.map((g) => g.thrustArea))].sort();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {cycle.name} · achievement summary and completion dashboard
        </p>
      </div>
      <Suspense>
        <ReportsClient
          cycleId={cycle.id}
          reports={reports}
          completion={completion}
          departments={departments}
          thrustAreas={thrustAreas}
          filters={{ dept: dept ?? "", thrust: thrust ?? "", quarter: "" }}
        />
      </Suspense>
    </div>
  );
}
