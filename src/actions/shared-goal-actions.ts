"use server";

import { revalidatePath, updateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeAchievementScore, getActiveQuarter, validateAchievementStatus } from "@/lib/scoring";
import { achievementSchema, goalSchema } from "@/lib/validation";
import { MAX_GOALS_PER_CYCLE, MIN_GOAL_WEIGHTAGE } from "@/lib/goal-rules";
import type { UomType, UomDirection, Quarter, ProgressStatus } from "@/generated/prisma";

export interface SharedGoalInput {
  thrustArea: string;
  title: string;
  description?: string;
  uomType: UomType;
  uomDirection: UomDirection;
  target: number;
  deadline?: Date | null;
  defaultWeightage: number;
  cycleId: string;
  recipientIds: string[];
}

async function getPusherSession() {
  const session = await auth();
  if (!session?.user?.userId) return null;
  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") return null;
  return session;
}

async function wasGoalPreviouslyLocked(goalId: string) {
  const count = await prisma.auditLog.count({
    where: { goalId, action: { in: ["APPROVED", "UNLOCKED"] } },
  });
  return count > 0;
}

export async function pushSharedGoal(data: SharedGoalInput): Promise<{
  success: boolean;
  error?: string;
  pushed?: number;
  skipped?: string[];
}> {
  const session = await getPusherSession();
  if (!session) return { success: false, error: "Unauthorized" };

  const pusherId = session.user.userId;
  const pusherRole = session.user.role;
  const recipientIds = [...new Set(data.recipientIds ?? [])];

  if (recipientIds.length === 0) {
    return { success: false, error: "Select at least one recipient" };
  }

  const cycle = await prisma.goalCycle.findUnique({ where: { id: data.cycleId } });
  if (!cycle || cycle.status !== "ACTIVE") {
    return { success: false, error: "No active goal cycle" };
  }

  const parsedGoal = goalSchema.safeParse({
    thrustArea: data.thrustArea,
    title: data.title,
    description: data.description,
    uomType: data.uomType,
    uomDirection: data.uomDirection,
    target: data.uomType === "ZERO" || data.uomType === "TIMELINE" ? undefined : data.target,
    deadline: data.uomType === "TIMELINE" && data.deadline ? data.deadline : undefined,
    weightage: data.defaultWeightage,
    cycleId: data.cycleId,
  });
  if (!parsedGoal.success) {
    return { success: false, error: parsedGoal.error.issues[0]?.message ?? "Validation failed" };
  }

  if (data.defaultWeightage < MIN_GOAL_WEIGHTAGE || data.defaultWeightage > 100) {
    return { success: false, error: "Default weightage must be between 10% and 100%" };
  }

  const recipients = await prisma.user.findMany({
    where: {
      id: { in: recipientIds },
      role: "EMPLOYEE",
      ...(pusherRole === "MANAGER" ? { managerId: pusherId } : {}),
    },
    select: { id: true, name: true },
  });
  const authorizedRecipientIds = new Set(recipients.map((r) => r.id));

  if (recipientIds.some((id) => !authorizedRecipientIds.has(id))) {
    return {
      success: false,
      error:
        pusherRole === "MANAGER"
          ? "Some recipients are not your direct reports"
          : "Some recipients are not valid employees",
    };
  }

  // Check how many goals each recipient already has in this cycle
  const goalCounts = await prisma.goal.groupBy({
    by: ["userId"],
    where: { userId: { in: recipientIds }, cycleId: data.cycleId },
    _count: { id: true },
  });
  const countMap = new Map(goalCounts.map((r) => [r.userId, r._count.id]));

  const nameMap = new Map(recipients.map((r) => [r.id, r.name]));

  const toCreate: string[] = [];
  const skipped: string[] = [];

  for (const recipientId of recipientIds) {
    if ((countMap.get(recipientId) ?? 0) >= MAX_GOALS_PER_CYCLE) {
      skipped.push(nameMap.get(recipientId) ?? recipientId);
    } else {
      toCreate.push(recipientId);
    }
  }

  if (toCreate.length === 0) {
    return {
      success: false,
      error: "No selected recipients can receive this goal because they are already at the 8-goal limit",
      skipped,
    };
  }

  const parsed = parsedGoal.data;
  const target = parsed.uomType === "ZERO" || parsed.uomType === "TIMELINE" ? 0 : parsed.target ?? 0;
  const deadline = parsed.uomType === "TIMELINE" ? parsed.deadline ?? null : null;
  const uomDirection =
    parsed.uomType === "ZERO" || parsed.uomType === "TIMELINE" ? "MIN" : parsed.uomDirection;

  await prisma.$transaction(async (tx) => {
    const primary = await tx.goal.create({
      data: {
        userId: pusherId,
        cycleId: data.cycleId,
        thrustArea: parsed.thrustArea,
        title: parsed.title,
        description: parsed.description || null,
        uomType: parsed.uomType,
        uomDirection,
        target,
        deadline,
        weightage: parsed.weightage,
        isShared: true,
        status: "APPROVED",
        isLocked: true,
      },
    });

    await tx.goal.createMany({
      data: toCreate.map((recipientId) => ({
        userId: recipientId,
        cycleId: data.cycleId,
        thrustArea: parsed.thrustArea,
        title: parsed.title,
        description: parsed.description || null,
        uomType: parsed.uomType,
        uomDirection,
        target,
        deadline,
        weightage: parsed.weightage,
        isShared: false,
        sharedFromId: primary.id,
        status: "DRAFT",
        isLocked: false,
      })),
    });
  });

  revalidatePath("/admin/shared-goals");
  revalidatePath("/manager/shared-goals");

  return { success: true, pushed: toCreate.length, skipped };
}

export async function updateSharedGoalWeightage(
  goalId: string,
  weightage: number
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.userId || session.user.role !== "EMPLOYEE") {
    return { success: false, error: "Unauthorized" };
  }

  const userId = session.user.userId;

  const goal = await prisma.goal.findUnique({ where: { id: goalId } });
  if (!goal) return { success: false, error: "Goal not found" };
  if (goal.userId !== userId) return { success: false, error: "Unauthorized" };
  if (goal.sharedFromId === null) {
    return { success: false, error: "Not a shared goal" };
  }
  if (goal.status !== "DRAFT" && goal.status !== "RETURNED") {
    return { success: false, error: "Goal cannot be edited in its current status" };
  }
  if (!Number.isFinite(weightage) || weightage < MIN_GOAL_WEIGHTAGE || weightage > 100) {
    return { success: false, error: "Weightage must be between 10% and 100%" };
  }

  const shouldAudit = goal.isLocked || await wasGoalPreviouslyLocked(goalId);
  await prisma.$transaction(async (tx) => {
    await tx.goal.update({
      where: { id: goalId },
      data: { weightage },
    });

    if (shouldAudit && goal.weightage !== weightage) {
      await tx.auditLog.create({
        data: {
          goalId,
          userId,
          action: "EMPLOYEE_EDITED_POST_LOCK",
          field: "weightage",
          oldValue: String(goal.weightage),
          newValue: String(weightage),
        },
      });
    }
  });

  revalidatePath("/employee/goals");
  revalidatePath(`/employee/goals/${goalId}`);
  return { success: true };
}

export async function saveSharedGoalAchievement(data: {
  goalId: string;
  quarter: Quarter;
  planned?: number;
  actual?: number;
  completionDate?: Date;
  status: ProgressStatus;
}): Promise<{ success: boolean; error?: string; score?: number | null }> {
  const session = await getPusherSession();
  if (!session) return { success: false, error: "Unauthorized" };

  const parsedAchievement = achievementSchema.safeParse(data);
  if (!parsedAchievement.success) {
    return { success: false, error: parsedAchievement.error.issues[0]?.message ?? "Validation failed" };
  }
  const input = parsedAchievement.data;

  const ownerId = session.user.userId;
  const goal = await prisma.goal.findUnique({ where: { id: input.goalId } });
  if (!goal) return { success: false, error: "Shared goal not found" };
  if (goal.userId !== ownerId) return { success: false, error: "Unauthorized" };
  if (!goal.isShared || goal.sharedFromId !== null) {
    return { success: false, error: "Only primary shared goals can be updated here" };
  }
  if (goal.status !== "APPROVED" || !goal.isLocked) {
    return { success: false, error: "Shared goal must be approved before achievements can be logged" };
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

  const planned = input.planned ?? null;
  const actual = input.status === "NOT_STARTED" ? null : input.actual ?? null;
  const completionDate = input.status === "NOT_STARTED" ? null : input.completionDate ?? null;

  if (input.status !== "NOT_STARTED" && goal.uomType !== "TIMELINE" && actual === null) {
    return { success: false, error: "Actual achievement is required once work has started" };
  }

  if (input.status === "COMPLETED" && goal.uomType === "TIMELINE" && !completionDate) {
    return { success: false, error: "Completion date is required for timeline goals" };
  }

  if (
    goal.uomType === "PERCENTAGE" &&
    ((input.planned !== undefined && input.planned > 100) ||
      (actual !== null && actual > 100))
  ) {
    return { success: false, error: "Percentage planned and actual values must be between 0 and 100" };
  }

  const score = computeAchievementScore(
    input.status,
    goal.uomType,
    goal.uomDirection,
    goal.target,
    actual,
    goal.deadline,
    completionDate
  );
  const statusError = validateAchievementStatus(input.status, goal.uomType, score, completionDate);
  if (statusError) return { success: false, error: statusError };

  await prisma.achievement.upsert({
    where: { goalId_quarter: { goalId: goal.id, quarter: input.quarter } },
    create: {
      goalId: goal.id,
      userId: ownerId,
      quarter: input.quarter,
      planned,
      actual,
      completionDate,
      status: input.status,
      score,
    },
    update: {
      planned,
      actual,
      completionDate,
      status: input.status,
      score,
    },
  });

  await syncSharedAchievement(goal.id, input.quarter, {
    planned,
    actual,
    completionDate,
    status: input.status,
    score,
  });

  updateTag("employee-goals");
  updateTag("manager-dashboard");
  updateTag("admin-dashboard");
  updateTag("reports");
  updateTag("analytics");
  revalidatePath("/admin/shared-goals");
  revalidatePath("/manager/shared-goals");
  revalidatePath("/admin/reports");

  return { success: true, score };
}

export async function syncSharedAchievement(
  primaryGoalId: string,
  quarter: Quarter,
  data: {
    planned?: number | null;
    actual?: number | null;
    completionDate?: Date | null;
    status: ProgressStatus;
    score?: number | null;
  }
): Promise<void> {
  const linked = await prisma.goal.findMany({
    where: { sharedFromId: primaryGoalId },
    select: { id: true, userId: true },
  });

  await Promise.all(
    linked.map((goal) =>
      prisma.achievement.upsert({
        where: { goalId_quarter: { goalId: goal.id, quarter } },
        create: {
          goalId: goal.id,
          userId: goal.userId,
          quarter,
          planned: data.planned ?? null,
          actual: data.actual ?? null,
          completionDate: data.completionDate ?? null,
          status: data.status,
          score: data.score ?? null,
        },
        update: {
          planned: data.planned ?? null,
          actual: data.actual ?? null,
          completionDate: data.completionDate ?? null,
          status: data.status,
          score: data.score ?? null,
        },
      })
    )
  );
}

export async function getSharedGoalHistory(cycleId: string) {
  const session = await getPusherSession();
  if (!session) return [];

  return prisma.goal.findMany({
    where: { userId: session.user.userId, isShared: true, cycleId },
    include: { _count: { select: { sharedTo: true } } },
    orderBy: { createdAt: "desc" },
  });
}
