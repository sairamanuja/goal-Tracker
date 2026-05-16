import { notFound, redirect } from "next/navigation";
import { requireManager } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { GoalReviewTable } from "@/components/goals/goal-review-table";
import { Breadcrumb } from "@/components/layout/breadcrumb";

interface PageProps {
  params: Promise<{ employeeId: string }>;
}

import type { Metadata } from "next";
export const metadata: Metadata = { title: "Team Review" };

export default async function ManagerTeamReviewPage(props: PageProps) {
  const { employeeId } = await props.params;
  const session = await requireManager();
  const managerId = session.user.userId;

  const [employee, cycle] = await Promise.all([
    prisma.user.findUnique({ where: { id: employeeId } }),
    prisma.goalCycle.findFirst({ where: { status: "ACTIVE" } }),
  ]);
  if (!employee) notFound();
  if (employee.managerId !== managerId) redirect("/manager/dashboard");

  const goals = cycle
    ? await prisma.goal.findMany({
        where: { userId: employeeId, cycleId: cycle.id },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const hasSubmitted = goals.some((g) => g.status === "SUBMITTED");
  const canEdit = hasSubmitted;

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb
          className="mb-2"
          items={[
            { label: "My Team", href: "/manager/team" },
            { label: employee.name ?? "Employee" },
          ]}
        />
        <h1 className="text-2xl font-semibold">{employee.name}</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {employee.department ?? "—"} ·{" "}
          {cycle ? cycle.name : "No active cycle"}
        </p>
      </div>

      {!cycle && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No active goal cycle found.
        </div>
      )}

      {cycle && goals.length === 0 && (
        <div className="rounded-lg border px-4 py-12 text-center text-muted-foreground text-sm">
          {employee.name} has not added any goals for this cycle.
        </div>
      )}

      {cycle && goals.length > 0 && (
        <GoalReviewTable
          goals={goals}
          employeeId={employeeId}
          employeeName={employee.name ?? "Employee"}
          cycleId={cycle.id}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
