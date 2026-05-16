"use server";

import { prisma } from "@/lib/prisma";

export type NotifType =
  | "GOAL_SUBMITTED"
  | "GOAL_APPROVED"
  | "GOAL_RETURNED"
  | "GOAL_UNLOCKED"
  | "CHECK_IN";

export async function createNotification(params: {
  userId: string;
  type: NotifType;
  title: string;
  body: string;
  href?: string;
}) {
  await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      href: params.href ?? null,
    },
  });
}
