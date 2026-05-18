import { requireEmployee } from "@/lib/auth-guard";
import { getActiveCycle, getEmployeeGoals } from "@/lib/cached-queries";
import { getActiveQuarter } from "@/lib/scoring";
import { isTotalWeightageExact } from "@/lib/goal-rules";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { ScoreBadge } from "@/components/goals/score-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { WeightageBar } from "@/components/goals/weightage-bar";
import { SubmitSheetButton } from "@/components/goals/submit-sheet-button";
import { DeleteGoalButton } from "@/components/goals/delete-goal-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { ScoreSparkline } from "@/components/analytics/score-sparkline";
import { Plus, Pencil, Eye, Lock, Share2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const UOM_LABEL: Record<string, string> = {
  NUMERIC: "Numeric",
  PERCENTAGE: "Percentage",
  TIMELINE: "Timeline",
  ZERO: "Zero",
};

import type { Metadata } from "next";
export const metadata: Metadata = { title: "My Goals" };

export default async function EmployeeGoalsPage() {
  const session = await requireEmployee();
  const userId = session.user.userId;

  const cycle = await getActiveCycle();

  if (!cycle) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">My Goals</h1>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No active goal cycle. Please contact your administrator.
          </CardContent>
        </Card>
      </div>
    );
  }

  const goals = await getEmployeeGoals(userId, cycle.id);

  const activeQuarter = getActiveQuarter(cycle);
  const totalWeight = goals.reduce((s, g) => s + g.weightage, 0);

  // Personal QoQ score sparkline
  const personalTrend = (["Q1", "Q2", "Q3", "Q4"] as const).map((q) => {
    const approved = goals.filter((g) => g.status === "APPROVED");
    const contributions = approved.flatMap((g) => {
      const ach = g.achievements.find(
        (a) => a.quarter === q && a.score !== null
      );
      return ach ? [{ score: ach.score!, weightage: g.weightage }] : [];
    });
    return {
      quarter: q,
      score:
        contributions.length > 0
          ? Math.round(
              contributions.reduce(
                (sum, { score, weightage }) => sum + (score * weightage) / 100,
                0
              ) * 10
            ) / 10
          : null,
    };
  });
  const goalCount = goals.length;
  const atMaxGoals = goalCount >= 8;
  const allLocked = goals.length > 0 && goals.every((g) => g.status === "SUBMITTED" || g.status === "APPROVED");
  const canSubmit =
    !allLocked &&
    goals.filter((g) => g.status === "DRAFT" || g.status === "RETURNED").length > 0 &&
    isTotalWeightageExact(totalWeight);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">My Goals</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {cycle.name} · {goalCount}/8 goals
            {activeQuarter && (
              <span className="ml-2 text-primary font-medium">· {activeQuarter} open</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {!allLocked && (
            atMaxGoals ? (
              <Tooltip>
                <TooltipTrigger>
                  <span
                    className={cn(
                      buttonVariants(),
                      "opacity-50 pointer-events-none gap-2 cursor-not-allowed"
                    )}
                    aria-disabled
                  >
                    <Plus className="w-4 h-4" />
                    Add Goal
                  </span>
                </TooltipTrigger>
                <TooltipContent>Maximum 8 goals allowed per cycle</TooltipContent>
              </Tooltip>
            ) : (
              <Link href="/employee/goals/new" className={cn(buttonVariants(), "gap-2")}>
                <Plus className="w-4 h-4" />
                Add Goal
              </Link>
            )
          )}
          {!allLocked && goals.length > 0 && (
            <SubmitSheetButton
              cycleId={cycle.id}
              canSubmit={canSubmit}
              totalWeight={totalWeight}
              goalCount={goals.length}
            />
          )}
        </div>
      </div>

      {/* Submitted banner */}
      {allLocked && goals.some((g) => g.status === "SUBMITTED") && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary font-medium">
          Goal sheet submitted — pending manager approval. Goals are now read-only.
        </div>
      )}

      {/* Weightage bar */}
      {goals.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <WeightageBar goals={goals.map((g) => ({ title: g.title, weightage: g.weightage }))} />
          </CardContent>
        </Card>
      )}

      {/* Personal score trend sparkline */}
      {personalTrend.some((d) => d.score !== null) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              My Score Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <ScoreSparkline data={personalTrend} />
          </CardContent>
        </Card>
      )}

      {/* Goals list */}
      {goals.length === 0 ? (
        <EmptyState
          title="No goals yet"
          description="Create your goal sheet for the current cycle. You can add up to 8 goals."
          action={
            <Link href="/employee/goals/new" className={cn(buttonVariants(), "gap-2")}>
              <Plus className="w-4 h-4" />
              Create Your Goal Sheet
            </Link>
          }
        />
      ) : (
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-base">Goal Sheet</CardTitle>
          </CardHeader>
          <CardContent className="pt-3 p-0">
            <div className="divide-y">
              {goals.map((goal) => {
                const isEditable = goal.status === "DRAFT" || goal.status === "RETURNED";
                const isDraft = goal.status === "DRAFT";
                const isApproved = goal.status === "APPROVED";
                const isSharedCopy = goal.sharedFromId !== null;
                const pusherName = goal.sharedFrom?.user?.name;

                // Quarter scores — only for approved goals
                const quarterScores = isApproved
                  ? goal.achievements.filter((a) => a.score !== null)
                  : [];

                return (
                  <div key={goal.id} className="px-6 py-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        {/* Title row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{goal.title}</span>
                          <StatusBadge status={goal.status} />
                          {isSharedCopy && (
                            <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">
                              <Share2 className="w-3 h-3" />
                              Shared
                            </span>
                          )}
                        </div>

                        {/* Meta row */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
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
                            </>
                          )}
                          {goal.uomType === "TIMELINE" && goal.deadline && (
                            <>
                              <span>·</span>
                              <span>By {format(new Date(goal.deadline), "dd MMM yyyy")}</span>
                            </>
                          )}
                          {isSharedCopy && pusherName && (
                            <>
                              <span>·</span>
                              <span className="text-blue-600">Pushed by {pusherName}</span>
                            </>
                          )}
                        </div>

                        {/* Return comment */}
                        {goal.status === "RETURNED" && goal.returnComment && (
                          <div className="mt-1 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                            Manager: {goal.returnComment}
                          </div>
                        )}

                        {/* Score badges for approved goals */}
                        {quarterScores.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {quarterScores.map((a) => (
                              <span key={a.quarter} className="flex items-center gap-1 text-xs text-muted-foreground">
                                <span>{a.quarter}:</span>
                                <ScoreBadge score={a.score} />
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Right actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-sm font-semibold tabular-nums w-12 text-right">
                          {goal.weightage}%
                        </span>
                        {isSharedCopy && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Lock className="w-3.5 h-3.5 text-muted-foreground ml-1" />
                            </TooltipTrigger>
                            <TooltipContent>
                              Title, target, and UoM are locked. Only weightage is editable.
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <Separator orientation="vertical" className="h-5 mx-1" />

                        {/* Achievement button — approved goals only */}
                        {isApproved && activeQuarter && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Link
                                href={`/employee/goals/${goal.id}/achievement`}
                                className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                              >
                                <TrendingUp className="w-4 h-4" />
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent>
                              {isSharedCopy ? "View achievement" : `Log ${activeQuarter} achievement`}
                            </TooltipContent>
                          </Tooltip>
                        )}

                        {/* Edit / view button */}
                        {!isApproved && (
                          <Link
                            href={`/employee/goals/${goal.id}`}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title={isEditable ? (isSharedCopy ? "Edit weightage" : "Edit goal") : "View goal"}
                          >
                            {isEditable ? <Pencil className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Link>
                        )}
                        {isApproved && !activeQuarter && (
                          <Link
                            href={`/employee/goals/${goal.id}`}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="View goal"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                        )}

                        {/* Delete — own DRAFT goals only */}
                        {isDraft && !isSharedCopy && (
                          <DeleteGoalButton goalId={goal.id} goalTitle={goal.title} />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
