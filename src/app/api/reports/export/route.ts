import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import type { Quarter } from "@/generated/prisma";

const QUARTERS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.userId || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const cycleId = searchParams.get("cycleId");

  const cycle = cycleId
    ? await prisma.goalCycle.findUnique({ where: { id: cycleId } })
    : await prisma.goalCycle.findFirst({ where: { status: "ACTIVE" } });

  if (!cycle) {
    return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
  }

  const goals = await prisma.goal.findMany({
    where: { cycleId: cycle.id, user: { role: "EMPLOYEE" } },
    orderBy: [{ user: { name: "asc" } }, { createdAt: "asc" }],
    include: {
      user: { select: { name: true, department: true } },
      achievements: {
        select: { quarter: true, planned: true, actual: true, completionDate: true, score: true, status: true },
      },
    },
  });

  // Sheet 1: Goals
  const goalsSheet = goals.map((g) => ({
    Employee: g.user.name,
    Department: g.user.department ?? "",
    Title: g.title,
    "Thrust Area": g.thrustArea,
    UoM: g.uomType,
    Target: g.target,
    Weightage: g.weightage,
    Status: g.status,
  }));

  // Sheet 2: Achievements
  const achSheet = goals.map((g) => {
    const achByQ = Object.fromEntries(
      QUARTERS.map((q) => {
        const a = g.achievements.find((a) => a.quarter === q);
        return [q, { planned: a?.planned ?? null, actual: a?.actual ?? null, score: a?.score ?? null }];
      })
    ) as Record<Quarter, { planned: number | null; actual: number | null; score: number | null }>;
    const validScores = QUARTERS.map((q) => ({ score: achByQ[q].score, weightage: g.weightage })).filter(
      (s) => s.score !== null
    );
    const overall =
      validScores.length > 0
        ? Math.round(validScores.reduce((sum, s) => sum + (s.score! * s.weightage) / 100, 0) * 100) / 100
        : null;

    return {
      Employee: g.user.name,
      Goal: g.title,
      "Q1 Planned": achByQ["Q1"].planned ?? "",
      "Q1 Actual": achByQ["Q1"].actual ?? "",
      "Q1 Score": achByQ["Q1"].score ?? "",
      "Q2 Planned": achByQ["Q2"].planned ?? "",
      "Q2 Actual": achByQ["Q2"].actual ?? "",
      "Q2 Score": achByQ["Q2"].score ?? "",
      "Q3 Planned": achByQ["Q3"].planned ?? "",
      "Q3 Actual": achByQ["Q3"].actual ?? "",
      "Q3 Score": achByQ["Q3"].score ?? "",
      "Q4 Planned": achByQ["Q4"].planned ?? "",
      "Q4 Actual": achByQ["Q4"].actual ?? "",
      "Q4 Score": achByQ["Q4"].score ?? "",
      "Overall Score": overall ?? "",
    };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(goalsSheet), "Goals");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(achSheet), "Achievements");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const filename = `${cycle.name.replace(/\s+/g, "_")}_report.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
