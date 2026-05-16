import { requireEmployee } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { getActiveQuarter } from "@/lib/scoring";
import { AchievementTabs } from "@/components/goals/achievement-tabs";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { format } from "date-fns";
import type { Quarter, ProgressStatus } from "@/generated/prisma";

const UOM_LABEL: Record<string, string> = {
  NUMERIC: "Numeric",
  PERCENTAGE: "Percentage",
  TIMELINE: "Timeline",
  ZERO: "Zero Target",
};

const QUARTERS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];
type QuarterState = "active" | "past" | "future";

import type { Metadata } from "next";
export const metadata: Metadata = { title: "Achievement" };

export default async function AchievementPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const session = await requireEmployee();
  const userId = session.user.userId;

  const goal = await prisma.goal.findUnique({ where: { id } });
  if (!goal) notFound();
  if (goal.userId !== userId) redirect("/unauthorized");
  if (goal.status !== "APPROVED") redirect(`/employee/goals/${id}`);

  const cycle = await prisma.goalCycle.findUnique({ where: { id: goal.cycleId } });
  if (!cycle) notFound();

  const allAchievements = await prisma.achievement.findMany({ where: { goalId: id } });

  const activeQ = getActiveQuarter(cycle);
  const activeIdx = activeQ ? QUARTERS.indexOf(activeQ) : -1;

  // Quarter states — computed server-side so no date parsing needed on client
  const quarterStates = Object.fromEntries(
    QUARTERS.map((q, i) => {
      if (activeQ === q) return [q, "active" as QuarterState];
      if (activeIdx > -1) return [q, i < activeIdx ? ("past" as QuarterState) : ("future" as QuarterState)];
      // No active quarter: fall back to close-date comparison
      const closes: Record<Quarter, Date> = {
        Q1: cycle.q1Close,
        Q2: cycle.q2Close,
        Q3: cycle.q3Close,
        Q4: cycle.q4Close,
      };
      return [q, new Date() > closes[q] ? ("past" as QuarterState) : ("future" as QuarterState)];
    })
  ) as Record<Quarter, QuarterState>;

  const quarterOpenDates: Record<Quarter, string> = {
    Q1: cycle.q1Open.toISOString(),
    Q2: cycle.q2Open.toISOString(),
    Q3: cycle.q3Open.toISOString(),
    Q4: cycle.q4Open.toISOString(),
  };

  // Serialize achievements — strip non-primitive Date fields
  const achievementMap = Object.fromEntries(
    QUARTERS.map((q) => {
      const a = allAchievements.find((x) => x.quarter === q);
      return [
        q,
        a
          ? {
              actual: a.actual,
              completionDate: a.completionDate?.toISOString() ?? null,
              status: a.status,
              score: a.score,
            }
          : null,
      ];
    })
  ) as Record<Quarter, { actual: number | null; completionDate: string | null; status: ProgressStatus; score: number | null } | null>;

  // Pusher name for shared copies
  let pusherName: string | null = null;
  if (goal.sharedFromId) {
    const primary = await prisma.goal.findUnique({
      where: { id: goal.sharedFromId },
      select: { user: { select: { name: true } } },
    });
    pusherName = primary?.user?.name ?? null;
  }

  const goalData = {
    id: goal.id,
    uomType: goal.uomType,
    uomDirection: goal.uomDirection,
    target: goal.target,
    deadline: goal.deadline?.toISOString() ?? null,
    isShared: goal.isShared,
    sharedFromId: goal.sharedFromId,
  };

  const defaultTab: Quarter = activeQ ?? "Q1";

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Breadcrumb
          className="mb-2"
          items={[
            { label: "My Goals", href: "/employee/goals" },
            { label: goal.title, href: `/employee/goals/${id}` },
            { label: "Achievement Log" },
          ]}
        />
        <h1 className="text-2xl font-semibold">Achievement Log</h1>
        <p className="text-muted-foreground text-sm mt-1">{cycle.name}</p>
      </div>

      {/* Goal details banner */}
      <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-1">
        <p className="font-medium">{goal.title}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <span>{goal.thrustArea}</span>
          <span>·</span>
          <span>{UOM_LABEL[goal.uomType]}</span>
          {(goal.uomType === "NUMERIC" || goal.uomType === "PERCENTAGE") && (
            <>
              <span>·</span>
              <span>
                Target: {goal.target}
                {goal.uomType === "PERCENTAGE" ? "%" : ""}
              </span>
              <span>·</span>
              <span>
                {goal.uomDirection === "MIN" ? "Higher is better" : "Lower is better"}
              </span>
            </>
          )}
          {goal.uomType === "TIMELINE" && goal.deadline && (
            <>
              <span>·</span>
              <span>Deadline: {format(new Date(goal.deadline), "dd MMM yyyy")}</span>
            </>
          )}
          {goal.uomType === "ZERO" && (
            <>
              <span>·</span>
              <span>Target: 0 incidents</span>
            </>
          )}
          {activeQ ? (
            <>
              <span>·</span>
              <span className="text-primary font-medium">{activeQ} open</span>
            </>
          ) : (
            <>
              <span>·</span>
              <span className="text-muted-foreground">No quarter currently open</span>
            </>
          )}
        </div>
      </div>

      <AchievementTabs
        goal={goalData}
        quarterStates={quarterStates}
        quarterOpenDates={quarterOpenDates}
        achievements={achievementMap}
        defaultTab={defaultTab}
        isSharedCopy={goal.sharedFromId !== null}
        pusherName={pusherName}
      />
    </div>
  );
}
