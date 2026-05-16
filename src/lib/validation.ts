import { z } from "zod";
import { THRUST_AREAS } from "@/lib/constants";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const goalSchema = z
  .object({
    thrustArea: z.string().min(1, "Thrust area is required"),
    title: z.string().min(1, "Title is required").max(200, "Title too long"),
    description: z.string().max(1000, "Description too long").optional().or(z.literal("")),
    uomType: z.enum(["NUMERIC", "PERCENTAGE", "TIMELINE", "ZERO"]),
    uomDirection: z.enum(["MIN", "MAX"]),
    target: z.number().min(0, "Target must be non-negative").optional(),
    deadline: z.coerce.date().optional(),
    weightage: z
      .number()
      .min(10, "Minimum weightage is 10%")
      .max(100, "Maximum weightage is 100%"),
    cycleId: z.string().min(1),
  })
  .refine(
    (data) => {
      if (data.uomType === "TIMELINE") return !!data.deadline;
      if (data.uomType === "ZERO") return true;
      return data.target !== undefined && data.target !== null;
    },
    { message: "Target or deadline required based on UoM type" }
  );

export const achievementSchema = z.object({
  goalId: z.string().min(1),
  quarter: z.enum(["Q1", "Q2", "Q3", "Q4"]),
  planned: z.number().nonnegative().optional(),
  actual: z.number().nonnegative().optional(),
  completionDate: z.coerce.date().optional(),
  status: z.enum(["NOT_STARTED", "ON_TRACK", "COMPLETED"]),
});

export const checkInSchema = z.object({
  employeeId: z.string().min(1),
  quarter: z.enum(["Q1", "Q2", "Q3", "Q4"]),
  comment: z.string().min(10, "Comment must be at least 10 characters").max(2000),
});

export const goalCycleSchema = z.object({
  name: z.string().min(1).max(100),
  year: z.number().int().min(2020).max(2100),
  goalSettingOpen: z.string().datetime({ offset: true }),
  goalSettingClose: z.string().datetime({ offset: true }),
  q1Open: z.string().datetime({ offset: true }),
  q1Close: z.string().datetime({ offset: true }),
  q2Open: z.string().datetime({ offset: true }),
  q2Close: z.string().datetime({ offset: true }),
  q3Open: z.string().datetime({ offset: true }),
  q3Close: z.string().datetime({ offset: true }),
  q4Open: z.string().datetime({ offset: true }),
  q4Close: z.string().datetime({ offset: true }),
  status: z.enum(["DRAFT", "ACTIVE", "CLOSED"]).optional(),
});

export const userSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  role: z.enum(["EMPLOYEE", "MANAGER", "ADMIN"]),
  department: z.string().max(100).optional(),
  designation: z.string().max(100).optional(),
  managerId: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type GoalInput = z.infer<typeof goalSchema>;
export type AchievementInput = z.infer<typeof achievementSchema>;
export type CheckInInput = z.infer<typeof checkInSchema>;
export type GoalCycleInput = z.infer<typeof goalCycleSchema>;
export type UserInput = z.infer<typeof userSchema>;
