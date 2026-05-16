import { requireManager } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { PushSharedGoalForm } from "@/components/goals/push-shared-goal-form";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Share2 } from "lucide-react";

const UOM_LABEL: Record<string, string> = {
  NUMERIC: "Numeric",
  PERCENTAGE: "%",
  TIMELINE: "Date",
  ZERO: "Zero",
};

import type { Metadata } from "next";
export const metadata: Metadata = { title: "Shared Goals" };

export default async function ManagerSharedGoalsPage() {
  const session = await requireManager();
  const managerId = session.user.userId;

  const cycle = await prisma.goalCycle.findFirst({ where: { status: "ACTIVE" } });

  const directReports = cycle
    ? await prisma.user.findMany({
        where: { managerId },
        select: { id: true, name: true, department: true },
        orderBy: { name: "asc" },
      })
    : [];

  const history = cycle
    ? await prisma.goal.findMany({
        where: { userId: managerId, isShared: true, cycleId: cycle.id },
        include: { _count: { select: { sharedTo: true } } },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Push Shared Goals</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {cycle ? cycle.name : "No active cycle"} · Push a team KPI to your direct reports
        </p>
      </div>

      {!cycle ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No active goal cycle.
          </CardContent>
        </Card>
      ) : directReports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No direct reports found. Shared goals can only be pushed to your direct reports.
          </CardContent>
        </Card>
      ) : (
        <PushSharedGoalForm
          employees={directReports}
          cycleId={cycle.id}
          cycleName={cycle.name}
        />
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Previously Pushed Goals</h2>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {history.map((goal) => (
                  <div key={goal.id} className="px-6 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Share2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate">{goal.title}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          <span>{goal.thrustArea}</span>
                          <span>·</span>
                          <span>{UOM_LABEL[goal.uomType]}</span>
                          {(goal.uomType === "NUMERIC" || goal.uomType === "PERCENTAGE") && (
                            <>
                              <span>·</span>
                              <span>Target: {goal.target}{goal.uomType === "PERCENTAGE" ? "%" : ""}</span>
                            </>
                          )}
                          {goal.uomType === "TIMELINE" && goal.deadline && (
                            <>
                              <span>·</span>
                              <span>By {format(new Date(goal.deadline), "dd MMM yyyy")}</span>
                            </>
                          )}
                          <span>·</span>
                          <span>Default {goal.weightage}%</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge variant="secondary">
                          {goal._count.sharedTo} recipient{goal._count.sharedTo !== 1 ? "s" : ""}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(goal.createdAt), "dd MMM yyyy")}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
