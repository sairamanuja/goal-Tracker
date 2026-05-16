import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { ensureDefaultRules } from "@/lib/escalations";
import { EscalationClient } from "@/components/admin/escalation-client";

import type { Metadata } from "next";
export const metadata: Metadata = { title: "Escalations" };

export default async function AdminEscalationsPage() {
  await requireAdmin();
  await ensureDefaultRules();

  const [rules, escalations] = await Promise.all([
    prisma.escalationRule.findMany({ orderBy: [{ condition: "asc" }, { level: "asc" }] }),
    prisma.escalation.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        rule: { select: { name: true, condition: true, level: true } },
        target: { select: { name: true, email: true } },
      },
    }),
  ]);

  const ruleRows = rules.map((r) => ({
    id: r.id,
    name: r.name,
    condition: r.condition,
    daysAfter: r.daysAfter,
    level: r.level,
    isActive: r.isActive,
  }));

  const escalationRows = escalations.map((e) => ({
    id: e.id,
    createdAt: e.createdAt.toISOString(),
    ruleName: e.rule.name,
    condition: e.rule.condition,
    level: e.rule.level,
    targetName: e.target.name,
    targetEmail: e.target.email,
    quarter: e.quarter,
    status: e.status,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Escalations</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Rule-based escalation engine · {rules.filter((r) => r.isActive).length} active rules
        </p>
      </div>
      <EscalationClient rules={ruleRows} escalations={escalationRows} />
    </div>
  );
}
