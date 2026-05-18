"use client";

import React, { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScoreBadge } from "@/components/goals/score-badge";
import { UnlockGoalButton } from "@/components/admin/unlock-goal-button";
import { Download, CheckCircle2, XCircle } from "lucide-react";
import type { GoalStatus, Quarter } from "@/generated/prisma";

interface GoalReport {
  goalId: string;
  employeeName: string;
  department: string | null;
  goalTitle: string;
  thrustArea: string;
  uomType: string;
  target: number;
  weightage: number;
  status: GoalStatus;
  isLocked: boolean;
  q1Planned: number | null;
  q1Actual: number | null;
  q1Score: number | null;
  q2Planned: number | null;
  q2Actual: number | null;
  q2Score: number | null;
  q3Planned: number | null;
  q3Actual: number | null;
  q3Score: number | null;
  q4Planned: number | null;
  q4Actual: number | null;
  q4Score: number | null;
  overallScore: number | null;
}

interface CompletionRow {
  employeeName: string;
  department: string | null;
  hasGoals: boolean;
  submitted: boolean;
  approved: boolean;
  q1: boolean;
  q2: boolean;
  q3: boolean;
  q4: boolean;
}

interface ReportsClientProps {
  cycleId: string;
  reports: GoalReport[];
  completion: CompletionRow[];
  departments: string[];
  thrustAreas: string[];
  filters: { dept: string; thrust: string; quarter: string };
}

const QUARTERS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];

function Check({ ok }: { ok: boolean }) {
  return ok
    ? <CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" />
    : <XCircle className="w-4 h-4 text-red-400 mx-auto" />;
}

function dash(value: number | null) {
  return value ?? "-";
}

export function ReportsClient({
  cycleId,
  reports,
  completion,
  departments,
  thrustAreas,
  filters,
}: ReportsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") params.set(key, value);
    else params.delete(key);
    startTransition(() => router.push(`?${params.toString()}`));
  }

  function exportExcel() {
    window.location.href = `/api/reports/export?cycleId=${cycleId}`;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Department</p>
          <Select
            value={filters.dept || "all"}
            onValueChange={(v) => updateFilter("dept", v ?? "all")}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Thrust Area</p>
          <Select
            value={filters.thrust || "all"}
            onValueChange={(v) => updateFilter("thrust", v ?? "all")}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All areas</SelectItem>
              {thrustAreas.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={exportExcel} className="gap-2 ml-auto">
          <Download className="w-4 h-4" />
          Export Excel
        </Button>
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">Achievement Report</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs min-w-[1040px]">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Employee</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Goal</th>
                <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Target</th>
                {QUARTERS.map((q) => (
                  <th key={q} colSpan={3} className="text-center px-3 py-2.5 font-medium text-muted-foreground border-l">
                    {q}
                  </th>
                ))}
                <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Overall</th>
                <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Actions</th>
              </tr>
              <tr className="border-b bg-muted/10 text-muted-foreground">
                <th colSpan={3} />
                {QUARTERS.map((q) => (
                  <React.Fragment key={q}>
                    <th className="text-right px-2 py-1 font-normal border-l">Planned</th>
                    <th className="text-right px-2 py-1 font-normal">Actual</th>
                    <th className="text-right px-2 py-1 font-normal">Score</th>
                  </React.Fragment>
                ))}
                <th colSpan={2} />
              </tr>
            </thead>
            <tbody className="divide-y">
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={17} className="px-3 py-8 text-center text-muted-foreground">
                    No approved goals found.
                  </td>
                </tr>
              ) : reports.map((r) => (
                <tr key={r.goalId} className="hover:bg-muted/20">
                  <td className="px-3 py-2.5">
                    <p className="font-medium">{r.employeeName}</p>
                    <p className="text-muted-foreground">{r.department ?? "-"}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium">{r.goalTitle}</p>
                    <p className="text-muted-foreground">{r.thrustArea}</p>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.target}</td>
                  {QUARTERS.map((q) => {
                    const key = q.toLowerCase();
                    const planned = r[`${key}Planned` as keyof GoalReport] as number | null;
                    const actual = r[`${key}Actual` as keyof GoalReport] as number | null;
                    const score = r[`${key}Score` as keyof GoalReport] as number | null;
                    return (
                      <React.Fragment key={q}>
                        <td className="px-2 py-2.5 text-right tabular-nums border-l text-muted-foreground">
                          {dash(planned)}
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">
                          {dash(actual)}
                        </td>
                        <td className="px-2 py-2.5 text-right">
                          {score !== null ? <ScoreBadge score={score} /> : <span className="text-muted-foreground">-</span>}
                        </td>
                      </React.Fragment>
                    );
                  })}
                  <td className="px-3 py-2.5 text-right">
                    {r.overallScore !== null ? <ScoreBadge score={r.overallScore} /> : <span className="text-muted-foreground">-</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {r.status === "APPROVED" && r.isLocked ? (
                      <UnlockGoalButton goalId={r.goalId} goalTitle={r.goalTitle} />
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">Completion Dashboard</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs min-w-[500px]">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Employee</th>
                <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">Goals Set</th>
                <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">Submitted</th>
                <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">Approved</th>
                {QUARTERS.map((q) => (
                  <th key={q} className="text-center px-3 py-2.5 font-medium text-muted-foreground">{q}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {completion.map((row) => (
                <tr key={row.employeeName} className="hover:bg-muted/20">
                  <td className="px-3 py-2.5">
                    <p className="font-medium">{row.employeeName}</p>
                    <p className="text-muted-foreground">{row.department ?? "-"}</p>
                  </td>
                  <td className="px-3 py-2.5 text-center"><Check ok={row.hasGoals} /></td>
                  <td className="px-3 py-2.5 text-center"><Check ok={row.submitted} /></td>
                  <td className="px-3 py-2.5 text-center"><Check ok={row.approved} /></td>
                  <td className="px-3 py-2.5 text-center"><Check ok={row.q1} /></td>
                  <td className="px-3 py-2.5 text-center"><Check ok={row.q2} /></td>
                  <td className="px-3 py-2.5 text-center"><Check ok={row.q3} /></td>
                  <td className="px-3 py-2.5 text-center"><Check ok={row.q4} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
