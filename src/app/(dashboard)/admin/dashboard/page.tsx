import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import { getActiveQuarter } from "@/lib/scoring";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompletionFunnelChart, DeptCompletionChart } from "@/components/admin/admin-charts";
import { Users, Target, ClipboardCheck, MessageSquare, TrendingUp, CalendarDays, FileDown, ScrollText } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

const getAdminDashboardData = unstable_cache(
  async (cycleId: string, activeQ: string | null) => {
    return Promise.all([
      prisma.user.count({ where: { role: "EMPLOYEE" } }),
      prisma.goal.findMany({
        where: { cycleId, user: { role: "EMPLOYEE" } },
        include: {
          user: { select: { department: true } },
          achievements: { select: { quarter: true, score: true } },
        },
      }),
      activeQ
        ? prisma.checkIn.count({ where: { cycleId, quarter: activeQ as "Q1" | "Q2" | "Q3" | "Q4" } })
        : Promise.resolve(0),
    ]);
  },
  ["admin-dashboard-data"],
  { revalidate: 60, tags: ["admin-dashboard"] }
);

function getGreeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

import type { Metadata } from "next";
export const metadata: Metadata = { title: "Admin Dashboard" };

export default async function AdminDashboardPage() {
  const session = await requireAdmin();
  const firstName = (session.user.name ?? "Admin").split(" ")[0];
  const hour = new Date().getUTCHours();
  const greeting = getGreeting(hour);

  const cycle = await prisma.goalCycle.findFirst({ where: { status: "ACTIVE" } });
  const activeQ = cycle ? getActiveQuarter(cycle) : null;

  const [totalUsers, goals, checkIns] = cycle
    ? await getAdminDashboardData(cycle.id, activeQ)
    : [0, [], 0];

  const submitted = goals.filter((g) => g.status === "SUBMITTED").length;
  const approved = goals.filter((g) => g.status === "APPROVED").length;

  const employeeIds = [...new Set(goals.map((g) => g.userId))];
  const employeeGoals = employeeIds.map((uid) => goals.filter((g) => g.userId === uid));

  const funnelCounts = {
    draft: employeeGoals.filter((gs) => gs.some((g) => g.status === "DRAFT")).length,
    submitted: employeeGoals.filter((gs) => gs.some((g) => g.status === "SUBMITTED")).length,
    approved: employeeGoals.filter((gs) => gs.every((g) => g.status === "APPROVED") && gs.length > 0).length,
    q1: 0, q2: 0, q3: 0, q4: 0,
  };

  if (cycle) {
    for (const uid of employeeIds) {
      const uGoals = goals.filter((g) => g.userId === uid);
      if (!uGoals.every((g) => g.status === "APPROVED")) continue;
      for (const q of ["Q1", "Q2", "Q3", "Q4"] as const) {
        const hasQ = uGoals.some((g) => g.achievements.some((a) => a.quarter === q && a.score !== null));
        if (hasQ) funnelCounts[q.toLowerCase() as "q1" | "q2" | "q3" | "q4"]++;
      }
    }
  }

  const funnelData = [
    { stage: "Draft", count: funnelCounts.draft },
    { stage: "Submitted", count: funnelCounts.submitted },
    { stage: "Approved", count: funnelCounts.approved },
    { stage: "Q1 Done", count: funnelCounts.q1 },
    { stage: "Q2 Done", count: funnelCounts.q2 },
    { stage: "Q3 Done", count: funnelCounts.q3 },
    { stage: "Q4 Done", count: funnelCounts.q4 },
  ];

  const deptMap = new Map<string, { total: number; approved: number }>();
  for (const g of goals) {
    const dept = g.user.department ?? "Unknown";
    const curr = deptMap.get(dept) ?? { total: 0, approved: 0 };
    curr.total++;
    if (g.status === "APPROVED") curr.approved++;
    deptMap.set(dept, curr);
  }
  const deptData = Array.from(deptMap.entries())
    .map(([department, { total, approved: a }]) => ({
      department,
      rate: total > 0 ? Math.round((a / total) * 100) : 0,
    }))
    .sort((a, b) => b.rate - a.rate);

  return (
    <div className="space-y-6">
      {/* Header with greeting */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{greeting}, {firstName}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Admin Dashboard · {cycle ? cycle.name : "No active cycle"}
            {activeQ && <span className="ml-2 text-primary font-medium">· {activeQ} open</span>}
          </p>
        </div>
        {/* Quick Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/admin/cycles" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5 text-xs")}>
            <CalendarDays className="w-3.5 h-3.5" />
            Open Quarter
          </Link>
          <Link href="/admin/reports" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5 text-xs")}>
            <FileDown className="w-3.5 h-3.5" />
            Export Report
          </Link>
          <Link href="/admin/audit-log" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5 text-xs")}>
            <ScrollText className="w-3.5 h-3.5" />
            Audit Log
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Employees */}
        <Card className="shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-indigo-500">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <Users className="w-3.5 h-3.5" />
              </div>
              Total Employees
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-end gap-2">
              <p className="text-3xl font-bold">{totalUsers}</p>
              <TrendingUp className="w-4 h-4 text-muted-foreground/40 mb-1.5" />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">registered in system</p>
          </CardContent>
        </Card>

        {/* Goals Submitted */}
        <Card className="shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-amber-500">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <Target className="w-3.5 h-3.5" />
              </div>
              Goals Submitted
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-end gap-2">
              <p className={cn("text-3xl font-bold", submitted > 0 ? "text-amber-600" : "text-muted-foreground")}>
                {submitted}
              </p>
              {submitted > 0 && <TrendingUp className="w-4 h-4 text-amber-400 mb-1.5" />}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {submitted === 0 ? "No pending submissions" : `${submitted} awaiting your review`}
            </p>
          </CardContent>
        </Card>

        {/* Goals Approved */}
        <Card className="shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-emerald-500">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <ClipboardCheck className="w-3.5 h-3.5" />
              </div>
              Goals Approved
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-end gap-2">
              <p className={cn("text-3xl font-bold", approved > 0 ? "text-emerald-600" : "text-muted-foreground")}>
                {approved}
              </p>
              {approved > 0 && <TrendingUp className="w-4 h-4 text-emerald-400 mb-1.5" />}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {goals.length > 0 ? `${approved} of ${goals.length} goal sheets` : "No goals this cycle"}
            </p>
          </CardContent>
        </Card>

        {/* Check-ins Done */}
        <Card className="shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-sky-500">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-100 flex items-center justify-center text-sky-600 shrink-0">
                <MessageSquare className="w-3.5 h-3.5" />
              </div>
              Check-ins Done
              {activeQ && <span className="font-normal">({activeQ})</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-end gap-2">
              <p className={cn("text-3xl font-bold", checkIns > 0 ? "text-sky-600" : "text-muted-foreground")}>
                {checkIns}
              </p>
              {checkIns > 0 && <TrendingUp className="w-4 h-4 text-sky-400 mb-1.5" />}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {checkIns === 0
                ? activeQ ? `No check-ins yet this ${activeQ}` : "No active quarter"
                : `completed this ${activeQ}`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {cycle && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Completion Funnel</CardTitle>
            </CardHeader>
            <CardContent>
              <CompletionFunnelChart data={funnelData} />
            </CardContent>
          </Card>

          {deptData.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Department Approval Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <DeptCompletionChart data={deptData} />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
