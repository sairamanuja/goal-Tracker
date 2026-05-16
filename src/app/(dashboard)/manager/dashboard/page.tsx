import { requireManager } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { getActiveCycle, getManagerDashboardData } from "@/lib/cached-queries";
import { getActiveQuarter } from "@/lib/scoring";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TeamTrendSparkline } from "@/components/analytics/team-trend-sparkline";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Users, ClipboardCheck, Clock, CheckCircle2, MessageSquare } from "lucide-react";
import { format } from "date-fns";

type SheetStatus = "NOT_STARTED" | "IN_PROGRESS" | "PENDING_REVIEW" | "APPROVED";

function getSheetStatus(goals: { status: string }[]): SheetStatus {
  if (goals.length === 0) return "NOT_STARTED";
  if (goals.every((g) => g.status === "APPROVED")) return "APPROVED";
  if (goals.some((g) => g.status === "SUBMITTED")) return "PENDING_REVIEW";
  return "IN_PROGRESS";
}

const statusConfig: Record<
  SheetStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }
> = {
  NOT_STARTED: { label: "Not Started", variant: "secondary", icon: Clock },
  IN_PROGRESS: { label: "In Progress", variant: "outline", icon: Clock },
  PENDING_REVIEW: { label: "Pending Your Review", variant: "destructive", icon: ClipboardCheck },
  APPROVED: { label: "Approved", variant: "default", icon: CheckCircle2 },
};

import type { Metadata } from "next";
export const metadata: Metadata = { title: "Manager Dashboard" };

export default async function ManagerDashboardPage() {
  const session = await requireManager();
  const managerId = session.user.userId;

  const cycle = await getActiveCycle();
  const activeQ = cycle ? getActiveQuarter(cycle) : null;

  // Fetch cached team data + live check-ins in parallel
  const [dashData, checkIns] = await Promise.all([
    cycle
      ? getManagerDashboardData(managerId, cycle.id)
      : Promise.resolve({ reports: [], teamAchs: [], approvedGoals: [] }),
    activeQ && cycle
      ? prisma.checkIn.findMany({
          where: { managerId, quarter: activeQ },
          select: { employeeId: true, updatedAt: true },
        })
      : Promise.resolve([]),
  ]);

  const { reports, teamAchs, approvedGoals } = dashData;

  const goalWeightMap = Object.fromEntries(
    approvedGoals.map((g) => [g.id, g.weightage])
  );
  const approvedGoalIds = new Set(approvedGoals.map((g) => g.id));
  const validAchs = teamAchs.filter((a) => approvedGoalIds.has(a.goalId));
  const reportIds = reports.map((r) => r.id);

  const teamTrend = (["Q1", "Q2", "Q3", "Q4"] as const).map((q) => {
    const qAchs = validAchs.filter((a) => a.quarter === q);
    const userScores = reportIds
      .map((uid) => {
        const uAchs = qAchs.filter((a) => a.userId === uid);
        if (uAchs.length === 0) return null;
        return uAchs.reduce(
          (sum, a) => sum + a.score! * (goalWeightMap[a.goalId] ?? 0) / 100,
          0
        );
      })
      .filter((s): s is number => s !== null);
    return {
      quarter: q,
      avg:
        userScores.length > 0
          ? Math.round(
              (userScores.reduce((a, b) => a + b, 0) / userScores.length) * 10
            ) / 10
          : null,
    };
  });
  const checkInMap = Object.fromEntries(checkIns.map((c) => [c.employeeId, c]));

  const pending = reports.filter((r) =>
    (r.goals as { status: string }[]).some((g) => g.status === "SUBMITTED")
  ).length;

  const approved = reports.filter((r) =>
    (r.goals as { status: string }[]).length > 0 &&
    (r.goals as { status: string }[]).every((g) => g.status === "APPROVED")
  ).length;

  const checkInsCompleted = checkIns.length;

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold">Manager Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {cycle ? cycle.name : "No active cycle"} · Your team&apos;s goal progress
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Users className="w-3.5 h-3.5" />
              </div>
              Team Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{reports.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <ClipboardCheck className="w-3.5 h-3.5" />
              </div>
              Pending Approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-600">{pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center text-green-600 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              Approved Sheets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{approved}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                <MessageSquare className="w-3.5 h-3.5" />
              </div>
              Check-ins Done{activeQ && <span className="font-normal ml-1">({activeQ})</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">{checkInsCompleted}</p>
          </CardContent>
        </Card>
      </div>

      {/* Check-in status */}
      {activeQ && reports.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Check-in Status — {activeQ}</h2>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {reports.map((report) => {
                  const goals = report.goals as { status: string }[];
                  const hasApproved = goals.some((g) => g.status === "APPROVED");
                  const checkIn = checkInMap[report.id];
                  return (
                    <div key={report.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-5 py-3 gap-2">
                      <div>
                        <p className="font-medium text-sm">{report.name}</p>
                        <p className="text-xs text-muted-foreground">{report.department ?? "—"}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        {checkIn ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Done · {format(new Date(checkIn.updatedAt), "dd MMM")}
                          </span>
                        ) : hasApproved ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                            <Clock className="w-3.5 h-3.5" />
                            Pending
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Goals not approved</span>
                        )}
                        {hasApproved && (
                          <Link
                            href={`/manager/check-in/${report.id}`}
                            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                          >
                            {checkIn ? "View" : "Conduct Check-in"}
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Team QoQ trend sparkline */}
      {reports.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Team QoQ Score Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <TeamTrendSparkline data={teamTrend} />
          </CardContent>
        </Card>
      )}

      {/* Team list */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Direct Reports</h2>
        {reports.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No direct reports found.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {reports.map((report) => {
              const goals = report.goals as { status: string; weightage: number }[];
              const sheetStatus = getSheetStatus(goals);
              const { label, variant, icon: Icon } = statusConfig[sheetStatus];
              const isPendingReview = sheetStatus === "PENDING_REVIEW";
              const isApproved = sheetStatus === "APPROVED";
              const totalWeight = goals.reduce((s, g) => s + g.weightage, 0);

              return (
                <Card key={report.id} className={cn("transition-colors", isPendingReview && "border-amber-300")}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold">{report.name}</h3>
                        <p className="text-xs text-muted-foreground">{report.department ?? "—"}</p>
                      </div>
                      <Badge variant={variant} className="shrink-0">
                        <Icon className="w-3 h-3 mr-1" />
                        {label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Goals</span>
                      <span className="font-medium">{goals.length} / 8</span>
                    </div>
                    {goals.length > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Total Weightage</span>
                        <span
                          className={cn(
                            "font-medium tabular-nums",
                            Math.round(totalWeight) === 100 ? "text-green-600" : "text-amber-600"
                          )}
                        >
                          {totalWeight.toFixed(0)}%
                        </span>
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <Link
                        href={`/manager/team/${report.id}`}
                        className={cn(
                          buttonVariants({ variant: isPendingReview ? "default" : "outline", size: "sm" }),
                          "flex-1 justify-center"
                        )}
                      >
                        {isPendingReview ? "Review Goals" : "View Goals"}
                      </Link>
                      {isApproved && (
                        <Link
                          href={`/manager/check-in/${report.id}`}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "flex-1 justify-center"
                          )}
                        >
                          Check-In
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
