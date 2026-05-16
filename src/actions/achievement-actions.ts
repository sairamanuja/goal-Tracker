"use server";

import { revalidatePath, updateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeScore, getActiveQuarter } from "@/lib/scoring";
import { syncSharedAchievement } from "@/actions/shared-goal-actions";
import type { Quarter, ProgressStatus } from "@/generated/prisma";

export async function saveAchievement(data: {
  goalId: string;
  quarter: Quarter;
  actual?: number;
  completionDate?: Date;
  status: ProgressStatus;
}): Promise<{ success: boolean; error?: string; score?: number | null }> {
  const session = await auth();
  if (!session?.user?.userId) return { success: false, error: "Unauthorized" };

  const userId = session.user.userId;

  const goal = await prisma.goal.findUnique({ where: { id: data.goalId } });
  if (!goal) return { success: false, error: "Goal not found" };
  if (goal.userId !== userId) return { success: false, error: "Unauthorized" };
  if (goal.status !== "APPROVED" || !goal.isLocked) {
    return { success: false, error: "Achievements can only be logged for approved goals" };
  }
  // Shared copies are read-only — achievements are synced from the primary owner
  if (goal.sharedFromId !== null) {
    return {
      success: false,
      error: "This shared goal's achievement is managed by the primary owner",
    };
  }

  const cycle = await prisma.goalCycle.findUnique({ where: { id: goal.cycleId } });
  if (!cycle) return { success: false, error: "Goal cycle not found" };

  const activeQ = getActiveQuarter(cycle);
  if (activeQ !== data.quarter) {
    return {
      success: false,
      error: `${data.quarter} is not currently open for updates${activeQ ? ` — ${activeQ} is active` : ""}`,
    };
  }

  if (goal.uomType === "TIMELINE" && !data.completionDate) {
    return { success: false, error: "Completion date is required for timeline goals" };
  }

  const score = computeScore(
    goal.uomType,
    goal.uomDirection,
    goal.target,
    data.actual ?? null,
    goal.deadline,
    data.completionDate ?? null
  );

  await prisma.achievement.upsert({
    where: { goalId_quarter: { goalId: data.goalId, quarter: data.quarter } },
    create: {
      goalId: data.goalId,
      userId,
      quarter: data.quarter,
      actual: data.actual ?? null,
      completionDate: data.completionDate ?? null,
      status: data.status,
      score,
    },
    update: {
      actual: data.actual ?? null,
      completionDate: data.completionDate ?? null,
      status: data.status,
      score,
    },
  });

  // If this is a PRIMARY shared goal (isShared=true, no sharedFromId), sync to all linked copies
  if (goal.isShared && goal.sharedFromId === null) {
    await syncSharedAchievement(data.goalId, data.quarter, {
      actual: data.actual ?? null,
      completionDate: data.completionDate ?? null,
      status: data.status,
      score,
    });
  }

  updateTag("employee-goals");
  updateTag("manager-dashboard");
  revalidatePath("/employee/goals");
  revalidatePath(`/employee/goals/${data.goalId}/achievement`);

  return { success: true, score };
}
