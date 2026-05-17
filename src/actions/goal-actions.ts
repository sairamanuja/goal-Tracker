"use server";

import { revalidatePath, updateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { goalSchema } from "@/lib/validation";
import {
  sendEmailNotification,
  sendTeamsNotification,
  goalSubmissionEmail,
} from "@/lib/notifications";
import { createNotification } from "@/lib/create-notification";
import type { UomDirection, UomType } from "@/generated/prisma";

const MAX_GOALS = 8;
const REQUIRED_TOTAL_WEIGHT = 100;

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
  if (!session?.user?.userId) return null;
  return session;
}

function isGoalSettingWindowOpen(cycle: { goalSettingOpen: Date; goalSettingClose: Date }) {
  const now = new Date();
  return now >= cycle.goalSettingOpen && now <= cycle.goalSettingClose;
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

  const count = await prisma.goal.count({
    where: { userId, cycleId: data.cycleId },
  });
  if (count >= MAX_GOALS) {
    return { success: false, error: "Maximum 8 goals allowed per cycle" };
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

  const goal = await prisma.goal.create({
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

  updateTag("employee-goals");
  revalidatePath("/employee/goals");
  return { success: true, goalId: goal.id };
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

  await prisma.goal.update({
    where: { id: goalId },
    data: {
      thrustArea,
      title,
      description: description || null,
      uomType,
      uomDirection: uomType === "ZERO" || uomType === "TIMELINE" ? "MIN" : uomDirection,
      target,
      deadline,
      weightage,
    },
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

  const goals = await prisma.goal.findMany({
    where: {
      userId,
      cycleId,
      status: { in: ["DRAFT", "RETURNED"] },
    },
  });

  if (goals.length === 0) {
    return { success: false, error: "No goals to submit" };
  }

  if (goals.length > MAX_GOALS) {
    return { success: false, error: "Maximum 8 goals allowed per cycle" };
  }

  const belowMin = goals.find((g) => g.weightage < 10);
  if (belowMin) {
    return {
      success: false,
      error: `Goal "${belowMin.title}" has weightage below 10%. Each goal must have at least 10% weightage.`,
    };
  }

  const totalWeight = goals.reduce((sum, g) => sum + g.weightage, 0);
  if (Math.round(totalWeight) !== REQUIRED_TOTAL_WEIGHT) {
    return {
      success: false,
      error: `Total weightage is ${totalWeight.toFixed(1)}% — must equal exactly 100%`,
    };
  }

  await prisma.goal.updateMany({
    where: {
      userId,
      cycleId,
      status: { in: ["DRAFT", "RETURNED"] },
    },
    data: { status: "SUBMITTED" },
  });

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
