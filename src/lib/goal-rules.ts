export const MAX_GOALS_PER_CYCLE = 8;
export const MIN_GOAL_WEIGHTAGE = 10;
export const REQUIRED_TOTAL_WEIGHTAGE = 100;
export const WEIGHTAGE_TOLERANCE = 0.001;

export function isTotalWeightageExact(totalWeightage: number) {
  return Math.abs(totalWeightage - REQUIRED_TOTAL_WEIGHTAGE) <= WEIGHTAGE_TOLERANCE;
}
