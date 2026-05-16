import type { GoalCycle, Quarter, UomDirection, UomType } from "@/generated/prisma";

// Legacy — kept for backward compat
export function calculateScore(
  uomType: UomType,
  uomDirection: UomDirection,
  target: number,
  actual: number | null | undefined
): number | null {
  return computeScore(uomType, uomDirection, target, actual ?? null, null, null);
}

export function computeScore(
  uomType: UomType,
  uomDirection: UomDirection,
  target: number,
  actual: number | null,
  deadline: Date | null,
  completionDate: Date | null
): number | null {
  if (actual === null && completionDate === null) return null;

  switch (uomType) {
    case "NUMERIC":
    case "PERCENTAGE":
      if (actual === null) return null;
      if (uomDirection === "MIN") {
        // Higher is better: (Achievement ÷ Target) × 100, cap 100
        if (target === 0) return actual === 0 ? 100 : 0;
        return Math.min(Math.round((actual / target) * 100 * 100) / 100, 100);
      }
      // Lower is better: (Target ÷ Achievement) × 100, cap 100
      if (actual === 0) return 100;
      return Math.min(Math.round((target / actual) * 100 * 100) / 100, 100);

    case "TIMELINE":
      if (!completionDate || !deadline) return null;
      return completionDate <= deadline ? 100 : 0;

    case "ZERO":
      if (actual === null) return null;
      return actual === 0 ? 100 : 0;
  }
  return null;
}

export function getActiveQuarter(cycle: GoalCycle): Quarter | null {
  if (cycle.forceOpenQuarter) return cycle.forceOpenQuarter as Quarter;
  const now = new Date();
  if (now >= cycle.q1Open && now <= cycle.q1Close) return "Q1";
  if (now >= cycle.q2Open && now <= cycle.q2Close) return "Q2";
  if (now >= cycle.q3Open && now <= cycle.q3Close) return "Q3";
  if (now >= cycle.q4Open && now <= cycle.q4Close) return "Q4";
  return null;
}

export function calculateWeightedScore(
  scores: { score: number | null; weightage: number }[]
): number | null {
  const valid = scores.filter((s) => s.score != null);
  if (valid.length === 0) return null;

  const totalWeight = valid.reduce((sum, s) => sum + s.weightage, 0);
  if (totalWeight === 0) return null;

  const weighted = valid.reduce(
    (sum, s) => sum + (s.score! * s.weightage) / totalWeight,
    0
  );
  return Math.round(weighted * 100) / 100;
}
