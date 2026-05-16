"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveQuarter } from "@/lib/scoring";
import { createNotification } from "@/lib/create-notification";
import type { Quarter } from "@/generated/prisma";

export async function submitCheckIn(data: {
  employeeId: string;
  quarter: Quarter;
  comment: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.userId || session.user.role !== "MANAGER") {
    return { success: false, error: "Unauthorized" };
  }
  const managerId = session.user.userId;

  if (data.comment.trim().length < 20) {
    return { success: false, error: "Comment must be at least 20 characters" };
  }

  const employee = await prisma.user.findUnique({
    where: { id: data.employeeId },
    select: { managerId: true },
  });
  if (!employee || employee.managerId !== managerId) {
    return { success: false, error: "Employee is not your direct report" };
  }

  const cycle = await prisma.goalCycle.findFirst({ where: { status: "ACTIVE" } });
  if (!cycle) return { success: false, error: "No active cycle" };

  const activeQ = getActiveQuarter(cycle);
  if (activeQ !== data.quarter) {
    return { success: false, error: `${data.quarter} is not the active quarter` };
  }

  await prisma.checkIn.upsert({
    where: {
      managerId_employeeId_quarter: {
        managerId,
        employeeId: data.employeeId,
        quarter: data.quarter,
      },
    },
    update: { comment: data.comment.trim() },
    create: {
      managerId,
      employeeId: data.employeeId,
      quarter: data.quarter,
      comment: data.comment.trim(),
    },
  });

  revalidatePath(`/manager/check-in/${data.employeeId}`);
  revalidatePath("/manager/dashboard");

  // Notify employee — fire-and-forget
  void (async () => {
    try {
      const manager = await prisma.user.findUnique({
        where: { id: managerId },
        select: { name: true },
      });
      if (manager?.name) {
        await createNotification({
          userId: data.employeeId,
          type: "CHECK_IN",
          title: `Check-in received for ${data.quarter}`,
          body: `${manager.name} submitted a check-in for ${data.quarter} (${cycle.name}).`,
          href: "/employee/check-ins",
        });
      }
    } catch { /* ignore */ }
  })();

  return { success: true };
}
