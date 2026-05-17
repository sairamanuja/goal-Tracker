import { requireEmployee } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { getActiveQuarter } from "@/lib/scoring";
import { notFound, redirect } from "next/navigation";
import { GoalForm } from "@/components/goals/goal-form";
import { SharedGoalWeightageForm } from "@/components/goals/shared-goal-weightage-form";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { AlertTriangle, Lock, Share2 } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const UOM_LABEL: Record<string, string> = {
  NUMERIC: "Numeric",
  PERCENTAGE: "Percentage",
  TIMELINE: "Timeline",
  ZERO: "Zero Target",
};

import type { Metadata } from "next";
export const metadata: Metadata = { title: "Goal Detail" };

export default async function GoalDetailPage(props: PageProps<"/employee/goals/[id]">) {
  const { id } = await props.params;
  const session = await requireEmployee();
  const userId = session.user.userId;

  const goal = await prisma.goal.findUnique({ where: { id } });
  if (!goal) notFound();
  if (goal.userId !== userId) redirect("/unauthorized");

  const cycle = await prisma.goalCycle.findUnique({ where: { id: goal.cycleId } });
  const now = new Date();
  const isDraftInOpenWindow =
    goal.status === "DRAFT" &&
    !!cycle &&
    cycle.status === "ACTIVE" &&
    now >= cycle.goalSettingOpen &&
    now <= cycle.goalSettingClose;
  const isEditable = goal.status === "RETURNED" || isDraftInOpenWindow;
  const isSharedCopy = goal.sharedFromId !== null;
  const activeQuarter = cycle ? getActiveQuarter(cycle) : null;

  // Pusher name for shared goals
  let pusherName: string | null = null;
  if (isSharedCopy) {
    const primary = await prisma.goal.findUnique({
      where: { id: goal.sharedFromId! },
      select: { user: { select: { name: true } } },
    });
    pusherName = primary?.user?.name ?? null;
  }

  // Total weight of all OTHER goals (for projected total in forms)
  const otherGoals = await prisma.goal.findMany({
    where: { userId, cycleId: goal.cycleId, id: { not: goal.id } },
    select: { weightage: true },
  });
  const otherGoalsTotal = otherGoals.reduce((s, g) => s + g.weightage, 0);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Breadcrumb
          className="mb-2"
          items={[
            { label: "My Goals", href: "/employee/goals" },
            { label: goal.title },
          ]}
        />
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold">
            {isEditable ? (isSharedCopy ? "Edit Shared Goal" : "Edit Goal") : "View Goal"}
          </h1>
          <StatusBadge status={goal.status} />
          {isSharedCopy && (
            <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1">
              <Share2 className="w-3 h-3" />
              Shared
            </span>
          )}
        </div>
        {cycle && (
          <p className="text-muted-foreground text-sm mt-1">{cycle.name}</p>
        )}
        {isSharedCopy && pusherName && (
          <p className="text-sm mt-1 text-blue-600">Pushed by {pusherName}</p>
        )}
        {goal.status === "APPROVED" && (
          <div className="mt-3">
            <Link
              href={`/employee/goals/${goal.id}/achievement`}
              className={cn(buttonVariants({ variant: "outline" }), "h-9")}
            >
              {activeQuarter ? `Log ${activeQuarter} Achievement` : "View Achievement Log"}
            </Link>
          </div>
        )}
      </div>

      {/* Return comment banner */}
      {goal.status === "RETURNED" && goal.returnComment && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Goal Returned by Manager</AlertTitle>
          <AlertDescription>{goal.returnComment}</AlertDescription>
        </Alert>
      )}

      {goal.status === "DRAFT" && !isDraftInOpenWindow && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Goal window is closed</AlertTitle>
          <AlertDescription>
            This draft goal is currently read-only because the goal-setting window is closed.
          </AlertDescription>
        </Alert>
      )}

      {isEditable && isSharedCopy ? (
        /* Shared copy: show read-only locked fields + weightage-only edit */
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="w-4 h-4 text-muted-foreground" />
                Locked Fields
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                These fields are set by the person who pushed this goal and cannot be changed.
              </p>
            </CardHeader>
            <CardContent>
              <dl className="divide-y">
                {[
                  { label: "Thrust Area", value: goal.thrustArea },
                  { label: "Title", value: goal.title },
                  { label: "Description", value: goal.description ?? "—" },
                  { label: "Unit of Measure", value: UOM_LABEL[goal.uomType] ?? goal.uomType },
                  {
                    label: "Direction",
                    value:
                      goal.uomType === "NUMERIC" || goal.uomType === "PERCENTAGE"
                        ? goal.uomDirection === "MIN" ? "Higher is better" : "Lower is better"
                        : "—",
                  },
                  {
                    label: "Target",
                    value:
                      goal.uomType === "TIMELINE" ? "—"
                      : goal.uomType === "ZERO" ? "0"
                      : goal.uomType === "PERCENTAGE" ? `${goal.target}%`
                      : String(goal.target),
                  },
                  {
                    label: "Deadline",
                    value: goal.deadline ? format(new Date(goal.deadline), "dd MMM yyyy") : "—",
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between py-3 text-sm">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-medium text-right max-w-xs">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Weightage</CardTitle>
              <p className="text-xs text-muted-foreground">
                This is the only field you can adjust on a shared goal.
              </p>
            </CardHeader>
            <CardContent>
              <SharedGoalWeightageForm
                goalId={goal.id}
                currentWeightage={goal.weightage}
                otherGoalsTotal={otherGoalsTotal}
              />
            </CardContent>
          </Card>
        </div>
      ) : isEditable ? (
        /* Own goal: full edit form */
        <GoalForm
          cycleId={goal.cycleId}
          currentTotalWeight={otherGoalsTotal}
          existingGoal={goal}
          mode="edit"
        />
      ) : (
        /* Not editable: full read-only view */
        <ReadOnlyGoalView goal={goal} pusherName={pusherName} />
      )}
    </div>
  );
}

function ReadOnlyGoalView({
  goal,
  pusherName,
}: {
  goal: Awaited<ReturnType<typeof prisma.goal.findUnique>> & object;
  pusherName?: string | null;
}) {
  const fields: { label: string; value: string }[] = [
    { label: "Thrust Area", value: goal.thrustArea },
    { label: "Title", value: goal.title },
    { label: "Description", value: goal.description ?? "—" },
    { label: "Unit of Measure", value: UOM_LABEL[goal.uomType] ?? goal.uomType },
    {
      label: "Direction",
      value:
        goal.uomType === "NUMERIC" || goal.uomType === "PERCENTAGE"
          ? goal.uomDirection === "MIN" ? "Higher is better" : "Lower is better"
          : "—",
    },
    {
      label: "Target",
      value:
        goal.uomType === "TIMELINE" ? "—"
        : goal.uomType === "ZERO" ? "0"
        : goal.uomType === "PERCENTAGE" ? `${goal.target}%`
        : String(goal.target),
    },
    {
      label: "Deadline",
      value: goal.deadline ? format(new Date(goal.deadline), "dd MMM yyyy") : "—",
    },
    { label: "Weightage", value: `${goal.weightage}%` },
    ...(pusherName ? [{ label: "Pushed by", value: pusherName }] : []),
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Goal Details</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y">
          {fields.map(({ label, value }) => (
            <div key={label} className="flex justify-between py-3 text-sm">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium text-right max-w-xs">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
