"use server";

import { revalidatePath, updateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function markNotificationRead(id: string) {
  const session = await auth();
  if (!session?.user?.userId) return;
  await prisma.notification.updateMany({
    where: { id, userId: session.user.userId },
    data: { read: true },
  });
  updateTag("user-notifications");
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead() {
  const session = await auth();
  if (!session?.user?.userId) return;
  await prisma.notification.updateMany({
    where: { userId: session.user.userId, read: false },
    data: { read: true },
  });
  updateTag("user-notifications");
  revalidatePath("/", "layout");
}
