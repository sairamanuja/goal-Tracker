"use server";

import { revalidatePath, updateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createUserSchema } from "@/lib/validation";
import {
  getAppToken,
  getAllGraphUsers,
  getGraphUserManagerEmail,
  getGraphUserGroups,
} from "@/lib/graph";
import { sendEmailNotification, quarterOpenEmail } from "@/lib/notifications";
import { createNotification } from "@/lib/create-notification";
import type { Quarter, Role } from "@/generated/prisma";

async function requireAdminSession() {
  const session = await auth();
  if (!session?.user?.userId || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
  return session.user.userId;
}

// ─── Cycle actions ────────────────────────────────────────────────────────────

export interface CycleFormData {
  name: string;
  year: number;
  goalSettingOpen: string;
  goalSettingClose: string;
  q1Open: string;
  q1Close: string;
  q2Open: string;
  q2Close: string;
  q3Open: string;
  q3Close: string;
  q4Open: string;
  q4Close: string;
}

function parseCycleDates(data: CycleFormData) {
  const parsed = {
    goalSettingOpen: new Date(data.goalSettingOpen),
    goalSettingClose: new Date(data.goalSettingClose),
    q1Open: new Date(data.q1Open),
    q1Close: new Date(data.q1Close),
    q2Open: new Date(data.q2Open),
    q2Close: new Date(data.q2Close),
    q3Open: new Date(data.q3Open),
    q3Close: new Date(data.q3Close),
    q4Open: new Date(data.q4Open),
    q4Close: new Date(data.q4Close),
  };

  const allValues = Object.values(parsed);
  if (allValues.some((d) => Number.isNaN(d.getTime()))) {
    return { ok: false as const, error: "One or more cycle dates are invalid" };
  }

  if (parsed.goalSettingOpen > parsed.goalSettingClose) {
    return { ok: false as const, error: "Goal-setting open date must be before close date" };
  }
  if (parsed.q1Open > parsed.q1Close) {
    return { ok: false as const, error: "Q1 open date must be before Q1 close date" };
  }
  if (parsed.q2Open > parsed.q2Close) {
    return { ok: false as const, error: "Q2 open date must be before Q2 close date" };
  }
  if (parsed.q3Open > parsed.q3Close) {
    return { ok: false as const, error: "Q3 open date must be before Q3 close date" };
  }
  if (parsed.q4Open > parsed.q4Close) {
    return { ok: false as const, error: "Q4 open date must be before Q4 close date" };
  }

  if (parsed.goalSettingClose > parsed.q1Open) {
    return { ok: false as const, error: "Goal-setting close must be on/before Q1 open" };
  }
  if (parsed.q1Close > parsed.q2Open) {
    return { ok: false as const, error: "Q1 close must be on/before Q2 open" };
  }
  if (parsed.q2Close > parsed.q3Open) {
    return { ok: false as const, error: "Q2 close must be on/before Q3 open" };
  }
  if (parsed.q3Close > parsed.q4Open) {
    return { ok: false as const, error: "Q3 close must be on/before Q4 open" };
  }

  return { ok: true as const, dates: parsed };
}

export async function createCycle(
  data: CycleFormData
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminSession();

    const validated = parseCycleDates(data);
    if (!validated.ok) {
      return { success: false, error: validated.error };
    }

    await prisma.goalCycle.create({
      data: {
        name: data.name,
        year: data.year,
        goalSettingOpen: validated.dates.goalSettingOpen,
        goalSettingClose: validated.dates.goalSettingClose,
        q1Open: validated.dates.q1Open,
        q1Close: validated.dates.q1Close,
        q2Open: validated.dates.q2Open,
        q2Close: validated.dates.q2Close,
        q3Open: validated.dates.q3Open,
        q3Close: validated.dates.q3Close,
        q4Open: validated.dates.q4Open,
        q4Close: validated.dates.q4Close,
        status: "DRAFT",
      },
    });
    updateTag("active-cycle");
    revalidatePath("/admin/cycles");
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function updateCycle(
  cycleId: string,
  data: CycleFormData
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminSession();

    const validated = parseCycleDates(data);
    if (!validated.ok) {
      return { success: false, error: validated.error };
    }

    await prisma.goalCycle.update({
      where: { id: cycleId },
      data: {
        name: data.name,
        year: data.year,
        goalSettingOpen: validated.dates.goalSettingOpen,
        goalSettingClose: validated.dates.goalSettingClose,
        q1Open: validated.dates.q1Open,
        q1Close: validated.dates.q1Close,
        q2Open: validated.dates.q2Open,
        q2Close: validated.dates.q2Close,
        q3Open: validated.dates.q3Open,
        q3Close: validated.dates.q3Close,
        q4Open: validated.dates.q4Open,
        q4Close: validated.dates.q4Close,
      },
    });
    updateTag("active-cycle");
    revalidatePath("/admin/cycles");
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function activateCycle(
  cycleId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminSession();
    await prisma.$transaction(async (tx) => {
      await tx.goalCycle.updateMany({
        where: { status: "ACTIVE" },
        data: { status: "DRAFT" },
      });
      await tx.goalCycle.update({
        where: { id: cycleId },
        data: { status: "ACTIVE" },
      });
    });
    updateTag("active-cycle");
    revalidatePath("/admin/cycles");
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function closeCycle(
  cycleId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminSession();
    await prisma.goalCycle.update({
      where: { id: cycleId },
      data: { status: "CLOSED" },
    });
    updateTag("active-cycle");
    revalidatePath("/admin/cycles");
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function forceOpenQuarter(
  cycleId: string,
  quarter: Quarter | null
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminSession();
    const cycle = await prisma.goalCycle.update({
      where: { id: cycleId },
      data: { forceOpenQuarter: quarter ?? null },
    });
    updateTag("active-cycle");
    updateTag("employee-goals");
    revalidatePath("/admin/cycles");
    revalidatePath("/employee/goals");

    // Notify all employees when a quarter is opened — best-effort
    if (quarter) {
      try {
        const employees = await prisma.user.findMany({
          where: { role: "EMPLOYEE" },
          select: { email: true },
        });
        for (const emp of employees) {
          void sendEmailNotification(
            emp.email,
            `GoalTrack: ${quarter} is now open`,
            quarterOpenEmail(quarter, cycle.name)
          );
        }
      } catch { /* ignore */ }
    }

    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

// ─── Goal unlock ──────────────────────────────────────────────────────────────

export async function unlockGoal(
  goalId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminId = await requireAdminSession();
    if (reason.trim().length < 5) {
      return { success: false, error: "Reason must be at least 5 characters" };
    }
    const goal = await prisma.goal.findUnique({ where: { id: goalId } });
    if (!goal) return { success: false, error: "Goal not found" };
    if (goal.status !== "APPROVED" || !goal.isLocked) {
      return { success: false, error: "Only locked approved goals can be unlocked" };
    }

    const trimmedReason = reason.trim();
    const returnComment = `Unlocked by Admin: ${trimmedReason}`;

    await prisma.$transaction(async (tx) => {
      await tx.goal.update({
        where: { id: goalId },
        data: {
          isLocked: false,
          status: "RETURNED",
          returnComment,
        },
      });
      await tx.auditLog.createMany({
        data: [
          {
            goalId,
            userId: adminId,
            action: "UNLOCKED",
            field: "isLocked",
            oldValue: "true",
            newValue: "false",
          },
          {
            goalId,
            userId: adminId,
            action: "UNLOCKED",
            field: "status",
            oldValue: goal.status,
            newValue: "RETURNED",
          },
          {
            goalId,
            userId: adminId,
            action: "UNLOCKED",
            field: "returnComment",
            oldValue: goal.returnComment ?? "null",
            newValue: returnComment,
          },
        ],
      });
    });
    updateTag("employee-goals");
    updateTag("manager-dashboard");
    updateTag("admin-dashboard");
    updateTag("reports");
    revalidatePath("/admin/audit-log");
    revalidatePath("/admin/reports");
    revalidatePath(`/employee/goals/${goalId}`);
    revalidatePath("/employee/goals");

    // Notify employee — fire-and-forget
    void (async () => {
      try {
        await createNotification({
          userId: goal.userId,
          type: "GOAL_UNLOCKED",
          title: "Goal unlocked for editing",
          body: `Your goal "${goal.title}" has been unlocked and can now be edited.`,
          href: "/employee/goals",
        });
      } catch { /* ignore */ }
    })();

    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

// ─── User actions ─────────────────────────────────────────────────────────────

export async function updateUser(
  userId: string,
  data: { role?: Role; department?: string; managerId?: string | null }
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminSession();
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.role !== undefined && { role: data.role }),
        ...(data.department !== undefined && { department: data.department }),
        ...(data.managerId !== undefined && { managerId: data.managerId }),
      },
    });
    revalidatePath("/admin/users");
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  role: Role;
  department?: string;
  managerId?: string;
}

// ─── Entra ID Org Sync ────────────────────────────────────────────────────────

export async function syncOrgFromEntraId(): Promise<{
  success: boolean;
  synced?: number;
  error?: string;
}> {
  try {
    await requireAdminSession();
    const token = await getAppToken();
    if (!token) {
      return { success: false, error: "Graph API not configured (check AZURE_AD_* env vars)" };
    }

    const graphUsers = await getAllGraphUsers(token);
    let synced = 0;

    for (const gu of graphUsers) {
      const email = gu.mail;
      if (!email) continue;

      // Map group memberships to role
      const groups = await getGraphUserGroups(gu.id, token);
      const role: Role = groups.includes("GoalTrack-Admins")
        ? "ADMIN"
        : groups.includes("GoalTrack-Managers")
        ? "MANAGER"
        : "EMPLOYEE";

      await prisma.user.upsert({
        where: { email },
        update: {
          name: gu.displayName,
          department: gu.department ?? undefined,
          role,
        },
        create: {
          email,
          name: gu.displayName,
          department: gu.department ?? null,
          role,
        },
      });
      synced++;
    }

    // Second pass — set managerId relationships
    for (const gu of graphUsers) {
      const email = gu.mail;
      if (!email) continue;
      const managerEmail = await getGraphUserManagerEmail(gu.id, token);
      if (!managerEmail) continue;
      const [dbUser, dbManager] = await Promise.all([
        prisma.user.findUnique({ where: { email }, select: { id: true } }),
        prisma.user.findUnique({ where: { email: managerEmail }, select: { id: true } }),
      ]);
      if (dbUser && dbManager) {
        await prisma.user.update({
          where: { id: dbUser.id },
          data: { managerId: dbManager.id },
        });
      }
    }

    revalidatePath("/admin/users");
    return { success: true, synced };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Sync failed" };
  }
}

export async function createUser(
  data: CreateUserData
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminSession();

    const parsed = createUserSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }
    const input = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) return { success: false, error: "Email already in use" };

    const hash = await bcrypt.hash(input.password, 10);
    await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        password: hash,
        role: input.role,
        department: input.department ?? null,
        managerId: input.managerId ?? null,
      },
    });
    revalidatePath("/admin/users");
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Failed" };
  }
}
