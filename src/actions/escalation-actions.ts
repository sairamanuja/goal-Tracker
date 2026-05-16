"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdminId() {
  const session = await auth();
  if (!session?.user?.userId || session.user.role !== "ADMIN") throw new Error("Unauthorized");
  return session.user.userId;
}

export async function resolveEscalation(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminId();
    await prisma.escalation.update({
      where: { id },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });
    revalidatePath("/admin/escalations");
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function dismissEscalation(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminId();
    await prisma.escalation.update({
      where: { id },
      data: { status: "DISMISSED", resolvedAt: new Date() },
    });
    revalidatePath("/admin/escalations");
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function toggleEscalationRule(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminId();
    await prisma.escalationRule.update({ where: { id }, data: { isActive } });
    revalidatePath("/admin/escalations");
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function updateEscalationRule(
  id: string,
  data: { name?: string; daysAfter?: number }
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminId();
    await prisma.escalationRule.update({ where: { id }, data });
    revalidatePath("/admin/escalations");
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Failed" };
  }
}
