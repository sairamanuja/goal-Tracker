"use server";

import { revalidatePath, updateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { goalSchema } from "@/lib/validation";
import {
  isTotalWeightageExact,
  MAX_GOALS_PER_CYCLE,
  MIN_GOAL_WEIGHTAGE,
} from "@/lib/goal-rules";
import {
  sendEmailNotification,
  sendTeamsNotification,
  goalSubmissionEmail,
} from "@/lib/notifications";
import { createNotification } from "@/lib/create-notification";
import { Prisma, type UomDirection, type UomType } from "@/generated/prisma";

export type GoalFormData = {
  thrustArea: string;
  title: string;
  description?: string;
  uomType: UomType;
  uomDirection: UomDirection;
  target?: number;
  deadline?: Date | string;
  weightage: number;
  cycleId: string;
};

async function getSession() {
  const session = await auth();
  if (!session?.user?.userId || session.user.role !== "EMPLOYEE") return null;
  return session;
}

function isGoalSettingWindowOpen(cycle: { goalSettingOpen: Date; goalSettingClose: Date }) {
  const now = new Date();
  return now >= cycle.goalSettingOpen && now <= cycle.goalSettingClose;
}

async function wasPreviouslyLocked(goalId: string) {
  const count = await prisma.auditLog.count({
    where: { goalId, action: { in: ["APPROVED", "UNLOCKED"] } },
  });
  return count > 0;
}

function isoOrNull(value: Date | null | undefined) {
  return value ? value.toISOString() : "null";
}

export async function createGoal(
  data: GoalFormData
): Promise<{ success: boolean; error?: string; goalId?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Unauthorized" };

  const userId = session.user.userId;

  const cycle = await prisma.goalCycle.findUnique({ where: { id: data.cycleId } });
  if (!cycle || cycle.status !== "ACTIVE") {
    return { success: false, error: "No active goal cycle found" };
  }

  if (!isGoalSettingWindowOpen(cycle)) {
    return { success: false, error: "Goal setting window is not currently open" };
  }

  const parsed = goalSchema.safeParse({
    ...data,
    deadline: data.deadline ? new Date(data.deadline) : undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { thrustArea, title, description, uomType, uomDirection, weightage } = parsed.data;

  const target =
    uomType === "ZERO"
      ? 0
      : uomType === "TIMELINE"
      ? 0
      : parsed.data.target ?? 0;

  const deadline =
    uomType === "TIMELINE" && parsed.data.deadline
      ? new Date(parsed.data.deadline)
      : undefined;

  try {
    const goal = await prisma.$transaction(
      async (tx) => {
        const count = await tx.goal.count({
          where: { userId, cycleId: data.cycleId },
        });
        if (count >= MAX_GOALS_PER_CYCLE) {
          throw new Error("Maximum 8 goals allowed per cycle");
        }

        return tx.goal.create({
          data: {
            userId,
            cycleId: data.cycleId,
            thrustArea,
            title,
            description: description || null,
            uomType,
            uomDirection: uomType === "ZERO" || uomType === "TIMELINE" ? "MIN" : uomDirection,
            target,
            deadline,
            weightage,
            status: "DRAFT",
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    updateTag("employee-goals");
    revalidatePath("/employee/goals");
    return { success: true, goalId: goal.id };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to create goal" };
  }
}

export async function updateGoal(
  goalId: string,
  data: GoalFormData
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Unauthorized" };

  const userId = session.user.userId;

  const existing = await prisma.goal.findUnique({ where: { id: goalId } });
  if (!existing) return { success: false, error: "Goal not found" };
  if (existing.userId !== userId) return { success: false, error: "Unauthorized" };
  if (existing.status !== "DRAFT" && existing.status !== "RETURNED") {
    return { success: false, error: "Goal cannot be edited in its current status" };
  }
  if (existing.status === "DRAFT") {
    const cycle = await prisma.goalCycle.findUnique({ where: { id: existing.cycleId } });
    if (!cycle || cycle.status !== "ACTIVE" || !isGoalSettingWindowOpen(cycle)) {
      return { success: false, error: "Goal setting window is not currently open" };
    }
  }
  if (existing.sharedFromId !== null) {
    return { success: false, error: "Shared goals can only have their weightage edited" };
  }

  const parsed = goalSchema.safeParse({
    ...data,
    deadline: data.deadline ? new Date(data.deadline) : undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { thrustArea, title, description, uomType, uomDirection, weightage } = parsed.data;

  const target =
    uomType === "ZERO"
      ? 0
      : uomType === "TIMELINE"
      ? 0
      : parsed.data.target ?? 0;

  const deadline =
    uomType === "TIMELINE" && parsed.data.deadline
      ? new Date(parsed.data.deadline)
      : null;

  const nextDescription = description || null;
  const nextUomDirection = uomType === "ZERO" || uomType === "TIMELINE" ? "MIN" : uomDirection;
  const updateData = {
    thrustArea,
    title,
    description: nextDescription,
    uomType,
    uomDirection: nextUomDirection,
    target,
    deadline,
    weightage,
  };

  const shouldAudit = existing.isLocked || await wasPreviouslyLocked(goalId);
  const auditEntries: Array<{
    goalId: string;
    userId: string;
    action: string;
    field: string;
    oldValue: string;
    newValue: string;
  }> = [];

  if (shouldAudit) {
    const addAudit = (field: string, oldValue: string, newValue: string) => {
      if (oldValue !== newValue) {
        auditEntries.push({
          goalId,
          userId,
          action: "EMPLOYEE_EDITED_POST_LOCK",
          field,
          oldValue,
          newValue,
        });
      }
    };

    addAudit("thrustArea", existing.thrustArea, thrustArea);
    addAudit("title", existing.title, title);
    addAudit("description", existing.description ?? "null", nextDescription ?? "null");
    addAudit("uomType", existing.uomType, uomType);
    addAudit("uomDirection", existing.uomDirection, nextUomDirection);
    addAudit("target", String(existing.target), String(target));
    addAudit("deadline", isoOrNull(existing.deadline), isoOrNull(deadline));
    addAudit("weightage", String(existing.weightage), String(weightage));
  }

  await prisma.$transaction(async (tx) => {
    await tx.goal.update({
      where: { id: goalId },
      data: updateData,
    });
    if (auditEntries.length > 0) {
      await tx.auditLog.createMany({ data: auditEntries });
    }
  });

  updateTag("employee-goals");
  revalidatePath("/employee/goals");
  revalidatePath(`/employee/goals/${goalId}`);
  return { success: true };
}

export async function deleteGoal(
  goalId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Unauthorized" };

  const userId = session.user.userId;

  const existing = await prisma.goal.findUnique({ where: { id: goalId } });
  if (!existing) return { success: false, error: "Goal not found" };
  if (existing.userId !== userId) return { success: false, error: "Unauthorized" };
  if (existing.status !== "DRAFT") {
    return { success: false, error: "Only DRAFT goals can be deleted" };
  }
  if (existing.sharedFromId !== null) {
    return { success: false, error: "Shared goals cannot be deleted" };
  }
  const cycle = await prisma.goalCycle.findUnique({ where: { id: existing.cycleId } });
  if (!cycle || cycle.status !== "ACTIVE" || !isGoalSettingWindowOpen(cycle)) {
    return { success: false, error: "Goal setting window is not currently open" };
  }

  await prisma.goal.delete({ where: { id: goalId } });
  updateTag("employee-goals");
  revalidatePath("/employee/goals");
  return { success: true };
}

export async function submitGoalSheet(
  cycleId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Unauthorized" };

  const userId = session.user.userId;

  try {
    await prisma.$transaction(
      async (tx) => {
        const goals = await tx.goal.findMany({
          where: { userId, cycleId },
        });

  if (goals.length === 0) {
    throw new Error("No goals to submit");
  }

  if (goals.length > MAX_GOALS_PER_CYCLE) {
    throw new Error("Maximum 8 goals allowed per cycle");
  }

  const editableGoals = goals.filter((g) => g.status === "DRAFT" || g.status === "RETURNED");
  if (editableGoals.length === 0) {
    throw new Error("No draft or returned goals to submit");
  }

  if (goals.some((g) => g.status === "SUBMITTED")) {
    throw new Error("Goal sheet is already submitted and awaiting approval");
  }

  const belowMin = goals.find((g) => g.weightage < MIN_GOAL_WEIGHTAGE);
  if (belowMin) {
    throw new Error(`Goal "${belowMin.title}" has weightage below 10%. Each goal must have at least 10% weightage.`);
  }

  const totalWeight = goals.reduce((sum, g) => sum + g.weightage, 0);
  if (!isTotalWeightageExact(totalWeight)) {
    throw new Error(`Total weightage is ${totalWeight.toFixed(1)}% - must equal exactly 100%`);
  }

  await tx.goal.updateMany({
    where: {
      userId,
      cycleId,
      status: { in: ["DRAFT", "RETURNED"] },
    },
    data: { status: "SUBMITTED" },
  });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to submit goal sheet" };
  }

  updateTag("employee-goals");
  revalidatePath("/employee/goals");

  // Notify manager — fire-and-forget (don't block the response)
  void (async () => {
    try {
      const [employee, cycle] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, manager: { select: { id: true, email: true } } },
        }),
        prisma.goalCycle.findFirst({ where: { id: cycleId } }),
      ]);
      if (employee?.manager && cycle) {
        if (employee.manager.email) {
          await sendEmailNotification(
            employee.manager.email,
            `GoalTrack: ${employee.name} submitted goal sheet`,
            goalSubmissionEmail(employee.name, cycle.name)
          );
          await sendTeamsNotification(
            employee.manager.email,
            `${employee.name} submitted their goal sheet for ${cycle.name}.`,
            `/manager/team/${userId}`
          );
        }
        await createNotification({
          userId: employee.manager.id,
          type: "GOAL_SUBMITTED",
          title: `${employee.name} submitted goal sheet`,
          body: `${employee.name} submitted their goal sheet for ${cycle.name}. Please review and approve.`,
          href: `/manager/team/${userId}`,
        });
      }
    } catch { /* ignore */ }
  })();

  return { success: true };
}
