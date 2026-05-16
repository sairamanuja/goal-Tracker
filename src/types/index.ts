import type {
  User,
  Goal,
  GoalCycle,
  Achievement,
  CheckIn,
  AuditLog,
  EscalationRule,
  Escalation,
  Role,
  GoalStatus,
  CycleStatus,
  UomType,
  UomDirection,
  Quarter,
  ProgressStatus,
} from "@/generated/prisma";

export type {
  User,
  Goal,
  GoalCycle,
  Achievement,
  CheckIn,
  AuditLog,
  EscalationRule,
  Escalation,
  Role,
  GoalStatus,
  CycleStatus,
  UomType,
  UomDirection,
  Quarter,
  ProgressStatus,
};

export type ActionResult<T = void> =
  | { success: true; data?: T; error?: never }
  | { success: false; error: string; data?: never };

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  userId: string;
  department?: string | null;
};
