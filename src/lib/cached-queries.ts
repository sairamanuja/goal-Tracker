import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

// Active cycle is identical for every user — cache globally, revalidate on cycle changes
export const getActiveCycle = unstable_cache(
  () => prisma.goalCycle.findFirst({ where: { status: "ACTIVE" } }),
  ["active-cycle"],
  { revalidate: 30, tags: ["active-cycle"] }
);

// Per-user goals for the current cycle
export const getEmployeeGoals = unstable_cache(
  (userId: string, cycleId: string) =>
    prisma.goal.findMany({
      where: { userId, cycleId },
      orderBy: { createdAt: "asc" },
      include: {
        sharedFrom: { select: { user: { select: { name: true } } } },
        achievements: { select: { quarter: true, score: true } },
      },
    }),
  ["employee-goals"],
  { revalidate: 30, tags: ["employee-goals"] }
);

// Per-manager team + achievement data
export const getManagerDashboardData = unstable_cache(
  async (managerId: string, cycleId: string) => {
    const reports = await prisma.user.findMany({
      where: { managerId },
      orderBy: { name: "asc" },
      include: {
        goals: {
          where: { cycleId },
          select: { status: true, weightage: true },
        },
      },
    });

    const reportIds = reports.map((r) => r.id);
    if (reportIds.length === 0) {
      return { reports, teamAchs: [], approvedGoals: [] };
    }

    const [teamAchs, approvedGoals] = await Promise.all([
      prisma.achievement.findMany({
        where: { userId: { in: reportIds }, score: { not: null } },
        select: { userId: true, quarter: true, score: true, goalId: true },
      }),
      prisma.goal.findMany({
        where: { userId: { in: reportIds }, cycleId, status: "APPROVED" },
        select: { id: true, weightage: true, userId: true },
      }),
    ]);

    return { reports, teamAchs, approvedGoals };
  },
  ["manager-dashboard"],
  { revalidate: 30, tags: ["manager-dashboard"] }
);

// Per-user notifications for the bell
export const getUserNotifications = unstable_cache(
  (userId: string) =>
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ["user-notifications"],
  { revalidate: 30, tags: ["user-notifications"] }
);
