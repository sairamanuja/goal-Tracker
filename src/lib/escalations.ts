import { prisma } from "@/lib/prisma";
import { getActiveQuarter } from "@/lib/scoring";
import { sendEmailNotification, sendTeamsNotification } from "@/lib/notifications";
import type { Quarter } from "@/generated/prisma";

// ─── Default rules ────────────────────────────────────────────────────────────

const DEFAULT_RULES = [
  { name: "Not Submitted — Employee Reminder", condition: "NOT_SUBMITTED", daysAfter: 7, level: 1 },
  { name: "Not Submitted — Manager Alert", condition: "NOT_SUBMITTED", daysAfter: 14, level: 2 },
  { name: "Not Submitted — HR Escalation", condition: "NOT_SUBMITTED", daysAfter: 21, level: 3 },
  { name: "Not Approved — Manager Reminder", condition: "NOT_APPROVED", daysAfter: 5, level: 1 },
  { name: "Not Approved — Skip-level Alert", condition: "NOT_APPROVED", daysAfter: 10, level: 2 },
  { name: "Not Approved — HR Escalation", condition: "NOT_APPROVED", daysAfter: 15, level: 3 },
  { name: "Check-in Missed — Employee+Manager", condition: "CHECKIN_MISSED", daysAfter: 10, level: 1 },
  { name: "Check-in Missed — Skip-level Alert", condition: "CHECKIN_MISSED", daysAfter: 20, level: 2 },
  { name: "Check-in Missed — HR Escalation", condition: "CHECKIN_MISSED", daysAfter: 30, level: 3 },
];

export async function ensureDefaultRules() {
  const count = await prisma.escalationRule.count();
  if (count > 0) return;
  await prisma.escalationRule.createMany({ data: DEFAULT_RULES });
}

// ─── Core check ──────────────────────────────────────────────────────────────

export async function checkEscalations(): Promise<{ triggered: number }> {
  const cycle = await prisma.goalCycle.findFirst({ where: { status: "ACTIVE" } });
  if (!cycle) return { triggered: 0 };

  const activeQ = getActiveQuarter(cycle);
  const now = new Date();

  const rules = await prisma.escalationRule.findMany({ where: { isActive: true } });

  // Preload HR emails (ADMIN users)
  const hrEmails = await prisma.user
    .findMany({ where: { role: "ADMIN" }, select: { email: true } })
    .then((users) => users.map((u) => u.email));

  let triggered = 0;

  for (const rule of rules) {
    // ── NOT_SUBMITTED ─────────────────────────────────────────────────────────
    if (rule.condition === "NOT_SUBMITTED") {
      const triggerDate = addDays(cycle.goalSettingOpen, rule.daysAfter);
      if (now < triggerDate) continue;

      const employees = await prisma.user.findMany({
        where: {
          role: "EMPLOYEE",
          goals: {
            none: {
              cycleId: cycle.id,
              status: { in: ["SUBMITTED", "APPROVED"] },
            },
          },
        },
        include: { manager: { select: { email: true } } },
      });

      const existing = await getOpenEscalationTargets(rule.id, cycle.id, employees.map((emp) => emp.id));
      const toCreate = employees.filter((emp) => !existing.has(emp.id));

      if (toCreate.length > 0) {
        await prisma.escalation.createMany({
          data: toCreate.map((emp) => ({ ruleId: rule.id, targetId: emp.id, cycleId: cycle.id })),
          skipDuplicates: true,
        });
      }

      for (const emp of toCreate) {
        await notifyLevel(rule.level, emp.email, emp.manager?.email ?? null, null, hrEmails, {
          subject: `GoalTrack Escalation: ${emp.name} has not submitted goals`,
          message: `Escalation (Level ${rule.level}): ${emp.name} has not submitted goal sheet for ${cycle.name}.`,
          deepLink: rule.level === 1 ? "/employee/goals" : `/manager/team/${emp.id}`,
        });
        triggered++;
      }
    }

    // ── NOT_APPROVED ──────────────────────────────────────────────────────────
    if (rule.condition === "NOT_APPROVED") {
      const cutoffDate = addDays(now, -rule.daysAfter);

      const submittedGoalUsers = await prisma.goal.findMany({
        where: { cycleId: cycle.id, status: "SUBMITTED", updatedAt: { lt: cutoffDate } },
        select: { userId: true },
        distinct: ["userId"],
      });
      const userIds = submittedGoalUsers.map((g) => g.userId);

      const employees = await prisma.user.findMany({
        where: { id: { in: userIds } },
        include: { manager: { select: { email: true, manager: { select: { email: true } } } } },
      });

      const existing = await getOpenEscalationTargets(rule.id, cycle.id, employees.map((emp) => emp.id));
      const toCreate = employees.filter((emp) => !existing.has(emp.id));

      if (toCreate.length > 0) {
        await prisma.escalation.createMany({
          data: toCreate.map((emp) => ({ ruleId: rule.id, targetId: emp.id, cycleId: cycle.id })),
          skipDuplicates: true,
        });
      }

      for (const emp of toCreate) {
        const skipLevelEmail = emp.manager?.manager?.email ?? null;
        await notifyLevel(rule.level, emp.email, emp.manager?.email ?? null, skipLevelEmail, hrEmails, {
          subject: `GoalTrack Escalation: goals pending approval for ${emp.name}`,
          message: `Escalation (Level ${rule.level}): ${emp.name}'s goal sheet has been pending approval for over ${rule.daysAfter} days in ${cycle.name}.`,
          deepLink: rule.level === 1 ? `/manager/team/${emp.id}` : "/admin/reports",
        });
        triggered++;
      }
    }

    // ── CHECKIN_MISSED ────────────────────────────────────────────────────────
    if (rule.condition === "CHECKIN_MISSED" && activeQ) {
      const qOpenDate = getQOpenDate(cycle, activeQ);
      if (!qOpenDate) continue;
      const triggerDate = addDays(qOpenDate, rule.daysAfter);
      if (now < triggerDate) continue;

      const employees = await prisma.user.findMany({
        where: {
          role: "EMPLOYEE",
          goals: { some: { cycleId: cycle.id, status: "APPROVED" } },
        },
        include: {
          manager: { select: { email: true, manager: { select: { email: true } } } },
        },
      });

      const completedCheckIns = await prisma.checkIn.findMany({
        where: {
          cycleId: cycle.id,
          quarter: activeQ,
          employeeId: { in: employees.map((e) => e.id) },
        },
        select: { employeeId: true },
      });
      const completedEmployeeIds = new Set(completedCheckIns.map((c) => c.employeeId));
      const violators = employees.filter((e) => !completedEmployeeIds.has(e.id));

      const existing = await getOpenEscalationTargets(rule.id, cycle.id, violators.map((emp) => emp.id), activeQ);
      const toCreate = violators.filter((emp) => !existing.has(emp.id));

      if (toCreate.length > 0) {
        await prisma.escalation.createMany({
          data: toCreate.map((emp) => ({
            ruleId: rule.id,
            targetId: emp.id,
            cycleId: cycle.id,
            quarter: activeQ,
          })),
          skipDuplicates: true,
        });
      }

      for (const emp of toCreate) {
        const skipLevelEmail = emp.manager?.manager?.email ?? null;
        await notifyLevel(rule.level, emp.email, emp.manager?.email ?? null, skipLevelEmail, hrEmails, {
          subject: `GoalTrack Escalation: ${emp.name} has not logged ${activeQ} achievement`,
          message: `Escalation (Level ${rule.level}): ${emp.name} has not logged ${activeQ} achievement in ${cycle.name}.`,
          deepLink: "/employee/goals",
        });
        triggered++;
      }
    }
  }

  return { triggered };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getQOpenDate(cycle: { q1Open: Date; q2Open: Date; q3Open: Date; q4Open: Date }, q: Quarter): Date | null {
  if (q === "Q1") return cycle.q1Open;
  if (q === "Q2") return cycle.q2Open;
  if (q === "Q3") return cycle.q3Open;
  if (q === "Q4") return cycle.q4Open;
  return null;
}

async function getOpenEscalationTargets(
  ruleId: string,
  cycleId: string,
  targetIds: string[],
  quarter?: Quarter
) {
  if (targetIds.length === 0) return new Set<string>();

  const existing = await prisma.escalation.findMany({
    where: {
      ruleId,
      cycleId,
      targetId: { in: targetIds },
      quarter: quarter ?? null,
      status: "OPEN",
    },
    select: { targetId: true },
  });

  return new Set(existing.map((e) => e.targetId));
}

async function notifyLevel(
  level: number,
  employeeEmail: string,
  managerEmail: string | null,
  skipLevelEmail: string | null,
  hrEmails: string[],
  msg: { subject: string; message: string; deepLink: string }
) {
  try {
    const body = `<p>${escapeHtml(msg.message)}</p>`;
    if (level === 1) {
      void sendEmailNotification(employeeEmail, msg.subject, body);
    } else if (level === 2) {
      // Use skip-level manager if available; fall back to direct manager
      const target = skipLevelEmail ?? managerEmail;
      if (target) {
        void sendEmailNotification(target, msg.subject, body);
        void sendTeamsNotification(target, msg.message, msg.deepLink);
      }
    } else if (level === 3) {
      for (const email of hrEmails) {
        void sendEmailNotification(email, msg.subject, body);
      }
    }
  } catch { /* ignore */ }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
