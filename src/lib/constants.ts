export const THRUST_AREAS = [
  "Revenue Growth",
  "Operational Excellence",
  "Customer Satisfaction",
  "People Development",
  "Innovation & Technology",
  "Cost Optimization",
] as const;

export type ThrustArea = (typeof THRUST_AREAS)[number];

export const QUARTERS = ["Q1", "Q2", "Q3", "Q4"] as const;

export const GOAL_WEIGHT_MIN = 5;
export const GOAL_WEIGHT_MAX = 100;
export const GOAL_WEIGHT_TOTAL = 100;
