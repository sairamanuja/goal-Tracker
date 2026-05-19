"use server";

import { revalidatePath, updateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  sendEmailNotification,
  sendTeamsNotification,
  goalApprovedEmail,
  goalReturnedEmail,
} from "@/lib/notifications";
import { createNotification } from "@/lib/create-notification";
import { isTotalWeightageExact, MAX_GOALS_PER_CYCLE, MIN_GOAL_WEIGHTAGE } from "@/lib/goal-rules";
import { Prisma } from "@/generated/prisma";

async function getManagerSession() {
  const session = await auth();
  if (!session?.user?.userId || session.user.role !== "MANAGER") return null;
  return session;
}

async function verifyDirectReport(managerId: string, employeeId: string) {
  const employee = await prisma.user.findUnique({ where: { id: employeeId } });
  if (!employee) return null;
  if (employee.managerId !== managerId) return null;
  return employee;
}

export async function approveGoalSheet(
  employeeId: string,
  cycleId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getManagerSession();
  if (!session) return { success: false, error: "Unauthorized" };

  const managerId = session.user.userId;
  const employee = await verifyDirectReport(managerId, employeeId);
  if (!employee) return { success: false, error: "Employee not found or not your direct report" };

  try {
    await prisma.$transaction(
      async (tx) => {
        const sheet = await tx.goalSheet.findUnique({
          where: { userId_cycleId: { userId: employeeId, cycleId } },
          include: { goals: true },
        });
        if (!sheet || sheet.status !== "SUBMITTED") {
          throw new Error("No submitted goal sheet to approve");
        }

        const goals = sheet.goals;
        if (goals.length === 0) throw new Error("No submitted goals to approve");

        const totalWeight = goals.reduce((s, g) => s + g.weightage, 0);
        if (!isTotalWeightageExact(totalWeight)) {
          throw new Error(`Total weightage is ${totalWeight.toFixed(1)}% - must equal 100%`);
        }

        const belowMin = goals.find((g) => g.weightage < MIN_GOAL_WEIGHTAGE);
        if (belowMin) throw new Error(`Goal "${belowMin.title}" has weightage below 10%`);

        if (goals.length > MAX_GOALS_PER_CYCLE) {
          throw new Error("Maximum 8 goals allowed per cycle");
        }

        await tx.goalSheet.update({
          where: { id: sheet.id },
          data: { status: "APPROVED", isLocked: true, returnComment: null },
        });
        await tx.goal.updateMany({
          where: { sheetId: sheet.id },
          data: { status: "APPROVED", isLocked: true, returnComment: null },
        });

        await tx.auditLog.createMany({
          data: goals.map((g) => ({
            goalId: g.id,
            userId: managerId,
            action: "APPROVED",
          })),
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to approve goal sheet" };
  }

  updateTag("employee-goals");
  updateTag("manager-dashboard");
  revalidatePath(`/manager/team/${employeeId}`);
  revalidatePath("/manager/dashboard");

  void (async () => {
    try {
      const [emp, mgr, cycle] = await Promise.all([
        prisma.user.findUnique({ where: { id: employeeId }, select: { email: true } }),
        prisma.user.findUnique({ where: { id: managerId }, select: { name: true } }),
        prisma.goalCycle.findUnique({ where: { id: cycleId }, select: { name: true } }),
      ]);
      if (mgr?.name && cycle?.name) {
        if (emp?.email) {
          await sendEmailNotification(
            emp.email,
            "GoalTrack: Your goal sheet has been approved",
            goalApprovedEmail(mgr.name, cycle.name)
          );
        }
        await createNotification({
          userId: employeeId,
          type: "GOAL_APPROVED",
          title: "Goal sheet approved",
          body: `${mgr.name} approved your goal sheet for ${cycle.name}.`,
          href: "/employee/goals",
        });
      }
    } catch {
      /* ignore */
    }
  })();

  return { success: true };
}

export async function returnGoalSheet(
  employeeId: string,
  cycleId: string,
  comment: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getManagerSession();
  if (!session) return { success: false, error: "Unauthorized" };

  const managerId = session.user.userId;
  const employee = await verifyDirectReport(managerId, employeeId);
  if (!employee) return { success: false, error: "Employee not found or not your direct report" };

  const trimmedComment = comment.trim();
  if (trimmedComment.length < 10) {
    return { success: false, error: "Return comment must be at least 10 characters" };
  }

  const returned = await prisma.$transaction(async (tx) => {
    const sheet = await tx.goalSheet.findUnique({
      where: { userId_cycleId: { userId: employeeId, cycleId } },
      select: { id: true, status: true },
    });
    if (!sheet || sheet.status !== "SUBMITTED") return false;

    await tx.goalSheet.update({
      where: { id: sheet.id },
      data: { status: "RETURNED", isLocked: false, returnComment: trimmedComment },
    });
    await tx.goal.updateMany({
      where: { sheetId: sheet.id },
      data: { status: "RETURNED", isLocked: false, returnComment: trimmedComment },
    });
    return true;
  });

  if (!returned) {
    return { success: false, error: "No submitted goal sheet to return" };
  }

  updateTag("employee-goals");
  updateTag("manager-dashboard");
  revalidatePath(`/manager/team/${employeeId}`);
  revalidatePath("/manager/dashboard");

  void (async () => {
    try {
      const [emp, mgr, cycle] = await Promise.all([
        prisma.user.findUnique({ where: { id: employeeId }, select: { email: true } }),
        prisma.user.findUnique({ where: { id: managerId }, select: { name: true } }),
        prisma.goalCycle.findUnique({ where: { id: cycleId }, select: { name: true } }),
      ]);
      if (mgr?.name && cycle?.name) {
        if (emp?.email) {
          await sendEmailNotification(
            emp.email,
            "GoalTrack: Your goal sheet has been returned for revision",
            goalReturnedEmail(mgr.name, trimmedComment, cycle.name)
          );
          await sendTeamsNotification(
            emp.email,
            `Your goal sheet for ${cycle.name} was returned by ${mgr.name}. Please review and re-submit.`,
            "/employee/goals"
          );
        }
        await createNotification({
          userId: employeeId,
          type: "GOAL_RETURNED",
          title: "Goal sheet returned for revision",
          body: `${mgr.name} returned your goal sheet for ${cycle.name}. Please review and re-submit.`,
          href: "/employee/goals",
        });
      }
    } catch {
      /* ignore */
    }
  })();

  return { success: true };
}

export async function updateGoalAsManager(
  goalId: string,
  data: { target?: number; weightage?: number; deadline?: Date | string | null }
): Promise<{ success: boolean; error?: string }> {
  const session = await getManagerSession();
  if (!session) return { success: false, error: "Unauthorized" };

  const managerId = session.user.userId;

  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    include: { user: true, sheet: { select: { status: true } } },
  });
  if (!goal) return { success: false, error: "Goal not found" };
  if (goal.sheet?.status !== "SUBMITTED" || goal.status !== "SUBMITTED") {
    return { success: false, error: "Only SUBMITTED goals can be edited" };
  }
  if (goal.user.managerId !== managerId) {
    return { success: false, error: "Unauthorized: not this employee's manager" };
  }

  if (
    data.weightage !== undefined &&
    (!Number.isFinite(data.weightage) || data.weightage < MIN_GOAL_WEIGHTAGE || data.weightage > 100)
  ) {
    return { success: false, error: "Weightage must be between 10% and 100%" };
  }

  if (data.target !== undefined) {
    if (Number.isNaN(data.target) || data.target < 0) {
      return { success: false, error: "Target must be non-negative" };
    }
    if (goal.uomType === "PERCENTAGE" && data.target > 100) {
      return { success: false, error: "Percentage target must be between 0 and 100" };
    }
  }

  if (data.deadline !== undefined && data.deadline !== null) {
    const date = new Date(data.deadline);
    if (Number.isNaN(date.getTime())) return { success: false, error: "Deadline is invalid" };
  }

  if (goal.sharedFromId !== null && (data.target !== undefined || data.deadline !== undefined)) {
    return { success: false, error: "Target and deadline are locked on shared goals" };
  }

  const updateData: Record<string, unknown> = {};
  const auditEntries: Array<{
    goalId: string;
    userId: string;
    action: string;
    field: string;
    oldValue: string;
    newValue: string;
  }> = [];

  if (data.target !== undefined && data.target !== goal.target) {
    auditEntries.push({
      goalId,
      userId: managerId,
      action: "MANAGER_EDITED",
      field: "target",
      oldValue: String(goal.target),
      newValue: String(data.target),
    });
    updateData.target = data.target;
  }

  if (data.weightage !== undefined && data.weightage !== goal.weightage) {
    auditEntries.push({
      goalId,
      userId: managerId,
      action: "MANAGER_EDITED",
      field: "weightage",
      oldValue: String(goal.weightage),
      newValue: String(data.weightage),
    });
    updateData.weightage = data.weightage;
  }

  if (data.deadline !== undefined) {
    const newDeadline = data.deadline ? new Date(data.deadline) : null;
    const oldDeadline = goal.deadline;
    if (String(newDeadline) !== String(oldDeadline)) {
      auditEntries.push({
        goalId,
        userId: managerId,
        action: "MANAGER_EDITED",
        field: "deadline",
        oldValue: oldDeadline?.toISOString() ?? "null",
        newValue: newDeadline?.toISOString() ?? "null",
      });
      updateData.deadline = newDeadline;
    }
  }

  if (Object.keys(updateData).length === 0) return { success: true };

  await prisma.$transaction(async (tx) => {
    await tx.goal.update({ where: { id: goalId }, data: updateData });
    if (auditEntries.length > 0) await tx.auditLog.createMany({ data: auditEntries });
  });

  revalidatePath(`/manager/team/${goal.userId}`);
  return { success: true };
}
