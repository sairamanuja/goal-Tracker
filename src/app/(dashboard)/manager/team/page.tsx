import { requireManager } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Users, ChevronRight, ClipboardCheck, Clock, CheckCircle2, Target } from "lucide-react";

type SheetStatus = "NOT_STARTED" | "IN_PROGRESS" | "PENDING_REVIEW" | "APPROVED";

function getSheetStatus(goals: { status: string }[]): SheetStatus {
  if (goals.length === 0) return "NOT_STARTED";
  if (goals.every((g) => g.status === "APPROVED")) return "APPROVED";
  if (goals.some((g) => g.status === "SUBMITTED")) return "PENDING_REVIEW";
  return "IN_PROGRESS";
}

const statusConfig: Record<SheetStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  NOT_STARTED: { label: "Not Started", variant: "secondary", icon: Clock },
  IN_PROGRESS: { label: "In Progress", variant: "outline", icon: Target },
  PENDING_REVIEW: { label: "Pending Review", variant: "destructive", icon: ClipboardCheck },
  APPROVED: { label: "Approved", variant: "default", icon: CheckCircle2 },
};

import type { Metadata } from "next";
export const metadata: Metadata = { title: "My Team" };

export default async function ManagerTeamPage() {
  const session = await requireManager();
  const managerId = session.user.userId;

  const [reports, cycle] = await Promise.all([
    prisma.user.findMany({
      where: { managerId },
      orderBy: { name: "asc" },
    }),
    prisma.goalCycle.findFirst({ where: { status: "ACTIVE" } }),
  ]);

  const goalsMap = cycle && reports.length > 0
    ? await prisma.goal.findMany({
        where: { userId: { in: reports.map((r) => r.id) }, cycleId: cycle.id },
        select: { userId: true, status: true },
      })
    : [];

  const goalsByUser = goalsMap.reduce<Record<string, { status: string }[]>>((acc, g) => {
    if (!acc[g.userId]) acc[g.userId] = [];
    acc[g.userId].push({ status: g.status });
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My Team</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {reports.length} direct report{reports.length !== 1 ? "s" : ""}
          {cycle ? ` · ${cycle.name}` : ""}
        </p>
      </div>

      {!cycle && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No active goal cycle found.
        </div>
      )}

      {reports.length === 0 ? (
        <div className="rounded-lg border px-4 py-12 text-center text-muted-foreground text-sm">
          <Users className="mx-auto mb-3 w-8 h-8 opacity-30" />
          No direct reports assigned to you yet.
        </div>
      ) : (
        <div className="rounded-lg border divide-y">
          {reports.map((emp) => {
            const goals = goalsByUser[emp.id] ?? [];
            const status = getSheetStatus(goals);
            const cfg = statusConfig[status];
            const Icon = cfg.icon;

            return (
              <div key={emp.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 py-3 hover:bg-muted/30 transition-colors gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{emp.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {emp.department ?? "—"}
                    {goals.length > 0 && (
                      <span className="ml-2">{goals.length} goal{goals.length !== 1 ? "s" : ""}</span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap sm:ml-4 shrink-0">
                  <Badge variant={cfg.variant} className="gap-1 text-xs">
                    <Icon className="w-3 h-3" />
                    {cfg.label}
                  </Badge>

                  <div className="flex gap-2">
                    <Link
                      href={`/manager/team/${emp.id}`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1 text-xs")}
                    >
                      Goals
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                    <Link
                      href={`/manager/check-in/${emp.id}`}
                      className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1 text-xs")}
                    >
                      Check-in
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
