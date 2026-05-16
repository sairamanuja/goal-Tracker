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

  const goals = await prisma.goal.findMany({
    where: { userId: employeeId, cycleId, status: "SUBMITTED" },
  });

  if (goals.length === 0) {
    return { success: false, error: "No submitted goals to approve" };
  }

  const totalWeight = goals.reduce((s, g) => s + g.weightage, 0);
  if (Math.round(totalWeight) !== 100) {
    return {
      success: false,
      error: `Total weightage is ${totalWeight.toFixed(1)}% — must equal 100%`,
    };
  }

  const belowMin = goals.find((g) => g.weightage < 10);
  if (belowMin) {
    return {
      success: false,
      error: `Goal "${belowMin.title}" has weightage below 10%`,
    };
  }

  if (goals.length > 8) {
    return { success: false, error: "Maximum 8 goals allowed per cycle" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.goal.updateMany({
      where: { userId: employeeId, cycleId, status: "SUBMITTED" },
      data: { status: "APPROVED", isLocked: true },
    });

    await tx.auditLog.createMany({
      data: goals.map((g) => ({
        goalId: g.id,
        userId: managerId,
        action: "APPROVED",
      })),
    });
  });

  updateTag("employee-goals");
  updateTag("manager-dashboard");
  revalidatePath(`/manager/team/${employeeId}`);
  revalidatePath("/manager/dashboard");

  // Notify employee — fire-and-forget (don't block the response)
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
    } catch { /* ignore */ }
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

  if (!comment || comment.trim().length < 10) {
    return { success: false, error: "Return comment must be at least 10 characters" };
  }

  const goals = await prisma.goal.findMany({
    where: { userId: employeeId, cycleId, status: "SUBMITTED" },
  });

  if (goals.length === 0) {
    return { success: false, error: "No submitted goals to return" };
  }

  await prisma.goal.updateMany({
    where: { userId: employeeId, cycleId, status: "SUBMITTED" },
    data: { status: "RETURNED", returnComment: comment.trim() },
  });

  updateTag("employee-goals");
  updateTag("manager-dashboard");
  revalidatePath(`/manager/team/${employeeId}`);
  revalidatePath("/manager/dashboard");

  // Notify employee — fire-and-forget (don't block the response)
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
            goalReturnedEmail(mgr.name, comment.trim(), cycle.name)
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
    } catch { /* ignore */ }
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
    include: { user: true },
  });
  if (!goal) return { success: false, error: "Goal not found" };
  if (goal.status !== "SUBMITTED") {
    return { success: false, error: "Only SUBMITTED goals can be edited" };
  }
  if (goal.user.managerId !== managerId) {
    return { success: false, error: "Unauthorized: not this employee's manager" };
  }

  if (data.weightage !== undefined && (data.weightage < 10 || data.weightage > 100)) {
    return { success: false, error: "Weightage must be between 10% and 100%" };
  }

  // Shared goal copies: only weightage may be edited by manager; target/deadline are locked
  if (goal.sharedFromId !== null) {
    if (data.target !== undefined || data.deadline !== undefined) {
      return { success: false, error: "Target and deadline are locked on shared goals" };
    }
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
    if (auditEntries.length > 0) {
      await tx.auditLog.createMany({ data: auditEntries });
    }
  });

  revalidatePath(`/manager/team/${goal.userId}`);
  return { success: true };
}
