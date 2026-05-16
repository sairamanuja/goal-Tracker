import { requireManager } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { getActiveQuarter } from "@/lib/scoring";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckInForm } from "@/components/check-in/check-in-form";
import { ScoreBadge } from "@/components/goals/score-badge";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { format } from "date-fns";
import type { Quarter } from "@/generated/prisma";

const UOM_LABEL: Record<string, string> = {
  NUMERIC: "Numeric",
  PERCENTAGE: "Percentage",
  TIMELINE: "Timeline",
  ZERO: "Zero",
};

const QUARTERS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];

import type { Metadata } from "next";
export const metadata: Metadata = { title: "Check-in" };

export default async function ManagerCheckInPage(props: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await props.params;
  const session = await requireManager();
  const managerId = session.user.userId;

  const employee = await prisma.user.findUnique({
    where: { id: employeeId },
    select: { id: true, name: true, department: true, managerId: true },
  });
  if (!employee) notFound();
  if (employee.managerId !== managerId) redirect("/manager/dashboard");

  const cycle = await prisma.goalCycle.findFirst({ where: { status: "ACTIVE" } });
  if (!cycle) {
    return (
      <div className="space-y-4">
        <Breadcrumb items={[{ label: "My Team", href: "/manager/team" }, { label: employee.name ?? "Employee" }]} />
        <p className="text-muted-foreground">No active goal cycle.</p>
      </div>
    );
  }

  const activeQ = getActiveQuarter(cycle);

  const goals = await prisma.goal.findMany({
    where: { userId: employeeId, cycleId: cycle.id, status: "APPROVED" },
    orderBy: { createdAt: "asc" },
    include: {
      achievements: { select: { quarter: true, actual: true, completionDate: true, status: true, score: true } },
    },
  });

  // Existing check-in for active quarter
  const currentCheckIn = activeQ
    ? await prisma.checkIn.findUnique({
        where: {
          managerId_employeeId_quarter: { managerId, employeeId, quarter: activeQ },
        },
      })
    : null;

  // All check-ins for history
  const allCheckIns = await prisma.checkIn.findMany({
    where: { managerId, employeeId },
    orderBy: { createdAt: "desc" },
  });

  // Weighted overall score for active quarter
  let overallScore: number | null = null;
  if (activeQ) {
    const pieces = goals.map((g) => {
      const ach = g.achievements.find((a) => a.quarter === activeQ);
      return { score: ach?.score ?? null, weightage: g.weightage };
    });
    const withScores = pieces.filter((p) => p.score !== null);
    if (withScores.length > 0) {
      overallScore = withScores.reduce((sum, p) => sum + (p.score! * p.weightage) / 100, 0);
      overallScore = Math.round(overallScore * 100) / 100;
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Breadcrumb
          className="mb-2"
          items={[
            { label: "My Team", href: "/manager/team" },
            { label: employee.name ?? "Employee" },
          ]}
        />
        <h1 className="text-2xl font-semibold">{employee.name}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {employee.department ?? "—"} · {cycle.name}
          {activeQ && <span className="ml-2 text-primary font-medium">· {activeQ} open</span>}
        </p>
      </div>

      {/* Goals summary table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Approved Goals{activeQ ? ` — ${activeQ} Progress` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {goals.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted-foreground text-center">
              No approved goals for this cycle.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Goal</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Thrust Area</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">UoM</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Target</th>
                    {activeQ && (
                      <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">
                        {activeQ} Actual
                      </th>
                    )}
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Score</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Wt.</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {goals.map((goal) => {
                    const ach = activeQ ? goal.achievements.find((a) => a.quarter === activeQ) : undefined;
                    const actual = ach?.actual;
                    const completionDate = ach?.completionDate;

                    let actualDisplay = "—";
                    if (goal.uomType === "TIMELINE") {
                      actualDisplay = completionDate
                        ? format(new Date(completionDate), "dd MMM yyyy")
                        : "—";
                    } else if (actual !== null && actual !== undefined) {
                      actualDisplay = `${actual}${goal.uomType === "PERCENTAGE" ? "%" : ""}`;
                    }

                    let targetDisplay = "—";
                    if (goal.uomType === "TIMELINE" && goal.deadline) {
                      targetDisplay = format(new Date(goal.deadline), "dd MMM yyyy");
                    } else if (goal.uomType === "ZERO") {
                      targetDisplay = "0";
                    } else {
                      targetDisplay = `${goal.target}${goal.uomType === "PERCENTAGE" ? "%" : ""}`;
                    }

                    return (
                      <tr key={goal.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">{goal.title}</td>
                        <td className="px-4 py-3 text-muted-foreground">{goal.thrustArea}</td>
                        <td className="px-4 py-3 text-muted-foreground">{UOM_LABEL[goal.uomType]}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{targetDisplay}</td>
                        {activeQ && (
                          <td className="px-4 py-3 text-right tabular-nums">{actualDisplay}</td>
                        )}
                        <td className="px-4 py-3 text-right">
                          {ach?.score !== null && ach?.score !== undefined ? (
                            <ScoreBadge score={ach.score} />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground capitalize text-xs">
                          {ach?.status?.replace("_", " ").toLowerCase() ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {goal.weightage}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {overallScore !== null && (
                  <tfoot>
                    <tr className="border-t bg-muted/20">
                      <td colSpan={activeQ ? 5 : 4} className="px-4 py-3 text-sm font-medium">
                        Overall Weighted Score
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ScoreBadge score={overallScore} />
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Check-in form */}
      {activeQ ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{activeQ} Check-in</CardTitle>
          </CardHeader>
          <CardContent>
            <CheckInForm
              employeeId={employeeId}
              quarter={activeQ}
              existingComment={currentCheckIn?.comment ?? null}
              existingUpdatedAt={currentCheckIn?.updatedAt?.toISOString() ?? null}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            No quarter is currently open. Check-ins can only be submitted during an active quarter.
          </CardContent>
        </Card>
      )}

      {/* Previous check-ins */}
      {allCheckIns.length > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-3">Previous Check-ins</h2>
          <div className="space-y-3">
            {allCheckIns
              .filter((c) => activeQ === null || c.quarter !== activeQ)
              .map((checkIn) => (
                <Card key={checkIn.id}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-primary">{checkIn.quarter}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(checkIn.createdAt), "dd MMM yyyy")}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">{checkIn.comment}</p>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

