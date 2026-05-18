"use server";

import { revalidatePath, updateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeScore, getActiveQuarter } from "@/lib/scoring";
import { achievementSchema } from "@/lib/validation";
import { syncSharedAchievement } from "@/actions/shared-goal-actions";
import type { Quarter, ProgressStatus } from "@/generated/prisma";

export async function saveAchievement(data: {
  goalId: string;
  quarter: Quarter;
  planned?: number;
  actual?: number;
  completionDate?: Date;
  status: ProgressStatus;
}): Promise<{ success: boolean; error?: string; score?: number | null }> {
  const session = await auth();
  if (!session?.user?.userId || session.user.role !== "EMPLOYEE") {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = achievementSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const userId = session.user.userId;
  const input = parsed.data;

  const goal = await prisma.goal.findUnique({ where: { id: input.goalId } });
  if (!goal) return { success: false, error: "Goal not found" };
  if (goal.userId !== userId) return { success: false, error: "Unauthorized" };
  if (goal.status !== "APPROVED" || !goal.isLocked) {
    return { success: false, error: "Achievements can only be logged for approved goals" };
  }
  if (goal.sharedFromId !== null) {
    return {
      success: false,
      error: "This shared goal's achievement is managed by the primary owner",
    };
  }

  const cycle = await prisma.goalCycle.findUnique({ where: { id: goal.cycleId } });
  if (!cycle) return { success: false, error: "Goal cycle not found" };

  const activeQ = getActiveQuarter(cycle);
  if (activeQ !== input.quarter) {
    return {
      success: false,
      error: `${input.quarter} is not currently open for updates${activeQ ? ` - ${activeQ} is active` : ""}`,
    };
  }

  if (goal.uomType === "TIMELINE" && !input.completionDate) {
    return { success: false, error: "Completion date is required for timeline goals" };
  }

  if (
    goal.uomType === "PERCENTAGE" &&
    ((input.planned !== undefined && input.planned > 100) ||
      (input.actual !== undefined && input.actual > 100))
  ) {
    return { success: false, error: "Percentage planned and actual values must be between 0 and 100" };
  }

  const score = computeScore(
    goal.uomType,
    goal.uomDirection,
    goal.target,
    input.actual ?? null,
    goal.deadline,
    input.completionDate ?? null
  );

  await prisma.achievement.upsert({
    where: { goalId_quarter: { goalId: input.goalId, quarter: input.quarter } },
    create: {
      goalId: input.goalId,
      userId,
      quarter: input.quarter,
      planned: input.planned ?? null,
      actual: input.actual ?? null,
      completionDate: input.completionDate ?? null,
      status: input.status,
      score,
    },
    update: {
      planned: input.planned ?? null,
      actual: input.actual ?? null,
      completionDate: input.completionDate ?? null,
      status: input.status,
      score,
    },
  });

  if (goal.isShared && goal.sharedFromId === null) {
    await syncSharedAchievement(input.goalId, input.quarter, {
      planned: input.planned ?? null,
      actual: input.actual ?? null,
      completionDate: input.completionDate ?? null,
      status: input.status,
      score,
    });
  }

  updateTag("employee-goals");
  updateTag("manager-dashboard");
  revalidatePath("/employee/goals");
  revalidatePath(`/employee/goals/${input.goalId}/achievement`);

  return { success: true, score };
}
