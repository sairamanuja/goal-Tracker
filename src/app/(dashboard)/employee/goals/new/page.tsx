import { requireEmployee } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { GoalForm } from "@/components/goals/goal-form";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";

import type { Metadata } from "next";
export const metadata: Metadata = { title: "New Goal" };

export default async function NewGoalPage() {
  const session = await requireEmployee();
  const userId = session.user.userId;

  const cycle = await prisma.goalCycle.findFirst({ where: { status: "ACTIVE" } });
  if (!cycle) redirect("/employee/goals");

  const now = new Date();
  const isGoalWindowOpen = now >= cycle.goalSettingOpen && now <= cycle.goalSettingClose;

  const goalCount = await prisma.goal.count({
    where: { userId, cycleId: cycle.id },
  });

  if (goalCount >= 8) redirect("/employee/goals");

  if (!isGoalWindowOpen) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <Breadcrumb
            className="mb-2"
            items={[
              { label: "My Goals", href: "/employee/goals" },
              { label: "New Goal" },
            ]}
          />
          <h1 className="text-2xl font-semibold">Add New Goal</h1>
          <p className="text-muted-foreground text-sm mt-1">{cycle.name}</p>
        </div>

        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Goal setting window is currently closed. It opens on {" "}
            {format(new Date(cycle.goalSettingOpen), "dd MMM yyyy")} and closes on {" "}
            {format(new Date(cycle.goalSettingClose), "dd MMM yyyy")}. Please contact your administrator if this seems incorrect.
          </CardContent>
        </Card>
      </div>
    );
  }

  const goals = await prisma.goal.findMany({
    where: { userId, cycleId: cycle.id },
    select: { weightage: true },
  });

  const currentTotalWeight = goals.reduce((s, g) => s + g.weightage, 0);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Breadcrumb
          className="mb-2"
          items={[
            { label: "My Goals", href: "/employee/goals" },
            { label: "New Goal" },
          ]}
        />
        <h1 className="text-2xl font-semibold">Add New Goal</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {cycle.name} · Goal {goalCount + 1} of 8 · Current total: {currentTotalWeight.toFixed(0)}%
        </p>
      </div>

      <GoalForm
        cycleId={cycle.id}
        currentTotalWeight={currentTotalWeight}
        mode="create"
      />
    </div>
  );
}
