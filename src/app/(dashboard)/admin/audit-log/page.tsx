import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { AuditLogClient } from "@/components/admin/audit-log-client";
import { Suspense } from "react";

import type { Metadata } from "next";
export const metadata: Metadata = { title: "Audit Log" };

export default async function AuditLogPage(props: {
  searchParams: Promise<{ search?: string; dateFrom?: string; dateTo?: string; action?: string }>;
}) {
  await requireAdmin();
  const { search, dateFrom, dateTo, action } = await props.searchParams;

  const logs = await prisma.auditLog.findMany({
    where: {
      ...(search
        ? {
            OR: [
              { user: { name: { contains: search, mode: "insensitive" } } },
              { goal: { title: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo + "T23:59:59Z") } : {}),
            },
          }
        : {}),
      ...(action ? { action } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      goal: { select: { title: true, user: { select: { name: true } } } },
      user: { select: { name: true } },
    },
  });

  // Distinct action types for filter dropdown
  const allActions = await prisma.auditLog.findMany({
    select: { action: true },
    distinct: ["action"],
  });

  const entries = logs.map((l) => ({
    id: l.id,
    createdAt: l.createdAt.toISOString(),
    employeeName: l.goal.user.name,
    goalTitle: l.goal.title,
    action: l.action,
    field: l.field,
    oldValue: l.oldValue,
    newValue: l.newValue,
    changedBy: l.user.name,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Field-level change history · showing up to 200 most recent entries
        </p>
      </div>
      <Suspense>
        <AuditLogClient
          entries={entries}
          filters={{
            search: search ?? "",
            dateFrom: dateFrom ?? "",
            dateTo: dateTo ?? "",
            action: action ?? "",
          }}
          actions={allActions.map((a) => a.action)}
        />
      </Suspense>
    </div>
  );
}
