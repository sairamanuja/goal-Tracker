"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveQuarter } from "@/lib/scoring";
import { createNotification } from "@/lib/create-notification";
import { checkInSchema } from "@/lib/validation";
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

  const parsed = checkInSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }
  const { employeeId, quarter, comment } = parsed.data;

  const employee = await prisma.user.findUnique({
    where: { id: employeeId },
    select: { managerId: true },
  });
  if (!employee || employee.managerId !== managerId) {
    return { success: false, error: "Employee is not your direct report" };
  }

  const cycle = await prisma.goalCycle.findFirst({ where: { status: "ACTIVE" } });
  if (!cycle) return { success: false, error: "No active cycle" };

  const activeQ = getActiveQuarter(cycle);
  if (activeQ !== quarter) {
    return { success: false, error: `${quarter} is not the active quarter` };
  }

  await prisma.checkIn.upsert({
    where: {
      managerId_employeeId_cycleId_quarter: {
        managerId,
        employeeId,
        cycleId: cycle.id,
        quarter,
      },
    },
    update: { comment: comment.trim() },
    create: {
      managerId,
      employeeId,
      cycleId: cycle.id,
      quarter,
      comment: comment.trim(),
    },
  });

  revalidatePath(`/manager/check-in/${employeeId}`);
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
          userId: employeeId,
          type: "CHECK_IN",
          title: `Check-in received for ${quarter}`,
          body: `${manager.name} submitted a check-in for ${quarter} (${cycle.name}).`,
          href: "/employee/check-ins",
        });
      }
    } catch { /* ignore */ }
  })();

  return { success: true };
}
