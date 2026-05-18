"use server";

import { revalidatePath, updateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeScore, getActiveQuarter } from "@/lib/scoring";
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

  if (!data.recipientIds || data.recipientIds.length === 0) {
    return { success: false, error: "Select at least one recipient" };
  }

  const cycle = await prisma.goalCycle.findUnique({ where: { id: data.cycleId } });
  if (!cycle || cycle.status !== "ACTIVE") {
    return { success: false, error: "No active goal cycle" };
  }

  if (data.defaultWeightage < 10 || data.defaultWeightage > 100) {
    return { success: false, error: "Default weightage must be between 10% and 100%" };
  }

  // Managers can only push to direct reports
  if (pusherRole === "MANAGER") {
    const directReports = await prisma.user.findMany({
      where: { managerId: pusherId },
      select: { id: true },
    });
    const directReportIds = new Set(directReports.map((r) => r.id));
    const unauthorized = data.recipientIds.filter((id) => !directReportIds.has(id));
    if (unauthorized.length > 0) {
      return { success: false, error: "Some recipients are not your direct reports" };
    }
  }

  // Create the primary goal owned by pusher
  const primary = await prisma.goal.create({
    data: {
      userId: pusherId,
      cycleId: data.cycleId,
      thrustArea: data.thrustArea,
      title: data.title,
      description: data.description || null,
      uomType: data.uomType,
      uomDirection: data.uomType === "ZERO" || data.uomType === "TIMELINE" ? "MIN" : data.uomDirection,
      target: data.uomType === "ZERO" || data.uomType === "TIMELINE" ? 0 : data.target,
      deadline: data.uomType === "TIMELINE" ? data.deadline : null,
      weightage: data.defaultWeightage,
      isShared: true,
      status: "APPROVED",
      isLocked: true,
    },
  });

  // Check how many goals each recipient already has in this cycle
  const goalCounts = await prisma.goal.groupBy({
    by: ["userId"],
    where: { userId: { in: data.recipientIds }, cycleId: data.cycleId },
    _count: { id: true },
  });
  const countMap = new Map(goalCounts.map((r) => [r.userId, r._count.id]));

  const recipients = await prisma.user.findMany({
    where: { id: { in: data.recipientIds } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(recipients.map((r) => [r.id, r.name]));

  const toCreate: string[] = [];
  const skipped: string[] = [];

  for (const recipientId of data.recipientIds) {
    if ((countMap.get(recipientId) ?? 0) >= 8) {
      skipped.push(nameMap.get(recipientId) ?? recipientId);
    } else {
      toCreate.push(recipientId);
    }
  }

  if (toCreate.length > 0) {
    await prisma.goal.createMany({
      data: toCreate.map((recipientId) => ({
        userId: recipientId,
        cycleId: data.cycleId,
        thrustArea: data.thrustArea,
        title: data.title,
        description: data.description || null,
        uomType: data.uomType,
        uomDirection: data.uomType === "ZERO" || data.uomType === "TIMELINE" ? "MIN" : data.uomDirection,
        target: data.uomType === "ZERO" || data.uomType === "TIMELINE" ? 0 : data.target,
        deadline: data.uomType === "TIMELINE" ? data.deadline : null,
        weightage: data.defaultWeightage,
        isShared: false,
        sharedFromId: primary.id,
        status: "DRAFT",
        isLocked: false,
      })),
    });
  }

  revalidatePath("/admin/shared-goals");
  revalidatePath("/manager/shared-goals");

  return { success: true, pushed: toCreate.length, skipped };
}

export async function updateSharedGoalWeightage(
  goalId: string,
  weightage: number
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.userId) return { success: false, error: "Unauthorized" };

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
  if (weightage < 10 || weightage > 100) {
    return { success: false, error: "Weightage must be between 10% and 100%" };
  }

  await prisma.goal.update({
    where: { id: goalId },
    data: { weightage },
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

  const ownerId = session.user.userId;
  const goal = await prisma.goal.findUnique({ where: { id: data.goalId } });
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
  if (activeQ !== data.quarter) {
    return {
      success: false,
      error: `${data.quarter} is not currently open for updates${activeQ ? ` - ${activeQ} is active` : ""}`,
    };
  }

  if (goal.uomType === "TIMELINE" && !data.completionDate) {
    return { success: false, error: "Completion date is required for timeline goals" };
  }

  const planned = data.planned ?? null;
  const actual = data.actual ?? null;
  const completionDate = data.completionDate ?? null;
  const score = computeScore(
    goal.uomType,
    goal.uomDirection,
    goal.target,
    actual,
    goal.deadline,
    completionDate
  );

  await prisma.achievement.upsert({
    where: { goalId_quarter: { goalId: goal.id, quarter: data.quarter } },
    create: {
      goalId: goal.id,
      userId: ownerId,
      quarter: data.quarter,
      planned,
      actual,
      completionDate,
      status: data.status,
      score,
    },
    update: {
      planned,
      actual,
      completionDate,
      status: data.status,
      score,
    },
  });

  await syncSharedAchievement(goal.id, data.quarter, {
    planned,
    actual,
    completionDate,
    status: data.status,
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
