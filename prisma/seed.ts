import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const password = await bcrypt.hash("Password@123", 12);

  // Create admin
  const admin = await prisma.user.upsert({
    where: { email: "admin@goaltrack.com" },
    update: {},
    create: {
      email: "admin@goaltrack.com",
      name: "Priya Sharma",
      password,
      role: "ADMIN",
      department: "HR",
    },
  });

  // Create managers
  const manager1 = await prisma.user.upsert({
    where: { email: "manager@goaltrack.com" },
    update: {},
    create: {
      email: "manager@goaltrack.com",
      name: "Rahul Mehta",
      password,
      role: "MANAGER",
      department: "Engineering",
    },
  });

  const manager2 = await prisma.user.upsert({
    where: { email: "manager2@goaltrack.com" },
    update: {},
    create: {
      email: "manager2@goaltrack.com",
      name: "Neha Gupta",
      password,
      role: "MANAGER",
      department: "Sales",
    },
  });

  // Create employees
  await prisma.user.upsert({
    where: { email: "emp1@goaltrack.com" },
    update: {},
    create: {
      email: "emp1@goaltrack.com",
      name: "Ananya Reddy",
      password,
      role: "EMPLOYEE",
      department: "Engineering",
      managerId: manager1.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "emp2@goaltrack.com" },
    update: {},
    create: {
      email: "emp2@goaltrack.com",
      name: "Vikram Singh",
      password,
      role: "EMPLOYEE",
      department: "Engineering",
      managerId: manager1.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "emp3@goaltrack.com" },
    update: {},
    create: {
      email: "emp3@goaltrack.com",
      name: "Arjun Patel",
      password,
      role: "EMPLOYEE",
      department: "Sales",
      managerId: manager2.id,
    },
  });

  // Create goal cycle
  await prisma.goalCycle.upsert({
    where: { id: "fy2025-26-seed" },
    update: {},
    create: {
      id: "fy2025-26-seed",
      name: "FY 2025-26",
      year: 2025,
      status: "ACTIVE",
      goalSettingOpen: new Date("2025-05-01T00:00:00.000Z"),
      goalSettingClose: new Date("2025-06-30T23:59:59.000Z"),
      q1Open: new Date("2025-07-01T00:00:00.000Z"),
      q1Close: new Date("2025-07-31T23:59:59.000Z"),
      q2Open: new Date("2025-10-01T00:00:00.000Z"),
      q2Close: new Date("2025-10-31T23:59:59.000Z"),
      q3Open: new Date("2026-01-01T00:00:00.000Z"),
      q3Close: new Date("2026-01-31T23:59:59.000Z"),
      q4Open: new Date("2026-03-01T00:00:00.000Z"),
      q4Close: new Date("2026-04-30T23:59:59.000Z"),
    },
  });

  console.log("Seed completed successfully.");
  console.log(`Admin: ${admin.email}`);
  console.log(`Manager 1: ${manager1.email}`);
  console.log(`Manager 2: ${manager2.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
