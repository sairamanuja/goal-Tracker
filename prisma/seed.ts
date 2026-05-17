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

  const now = new Date();
  const fiscalStartYear =
    now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const fiscalEndYear = fiscalStartYear + 1;
  const cycleId = `fy${fiscalStartYear}-${String(fiscalEndYear).slice(-2)}-seed`;
  const cycleName = `FY ${fiscalStartYear}-${String(fiscalEndYear).slice(-2)}`;

  // Keep a single ACTIVE cycle after seeding.
  await prisma.goalCycle.updateMany({
    where: { status: "ACTIVE" },
    data: { status: "DRAFT" },
  });

  // Create or update the current fiscal cycle with goal window open in Apr-Jun.
  await prisma.goalCycle.upsert({
    where: { id: cycleId },
    update: {
      name: cycleName,
      year: fiscalStartYear,
      status: "ACTIVE",
      goalSettingOpen: new Date(Date.UTC(fiscalStartYear, 3, 1, 0, 0, 0)),
      goalSettingClose: new Date(Date.UTC(fiscalStartYear, 5, 30, 23, 59, 59)),
      q1Open: new Date(Date.UTC(fiscalStartYear, 6, 1, 0, 0, 0)),
      q1Close: new Date(Date.UTC(fiscalStartYear, 6, 31, 23, 59, 59)),
      q2Open: new Date(Date.UTC(fiscalStartYear, 9, 1, 0, 0, 0)),
      q2Close: new Date(Date.UTC(fiscalStartYear, 9, 31, 23, 59, 59)),
      q3Open: new Date(Date.UTC(fiscalEndYear, 0, 1, 0, 0, 0)),
      q3Close: new Date(Date.UTC(fiscalEndYear, 0, 31, 23, 59, 59)),
      q4Open: new Date(Date.UTC(fiscalEndYear, 2, 1, 0, 0, 0)),
      q4Close: new Date(Date.UTC(fiscalEndYear, 3, 30, 23, 59, 59)),
    },
    create: {
      id: cycleId,
      name: cycleName,
      year: fiscalStartYear,
      status: "ACTIVE",
      goalSettingOpen: new Date(Date.UTC(fiscalStartYear, 3, 1, 0, 0, 0)),
      goalSettingClose: new Date(Date.UTC(fiscalStartYear, 5, 30, 23, 59, 59)),
      q1Open: new Date(Date.UTC(fiscalStartYear, 6, 1, 0, 0, 0)),
      q1Close: new Date(Date.UTC(fiscalStartYear, 6, 31, 23, 59, 59)),
      q2Open: new Date(Date.UTC(fiscalStartYear, 9, 1, 0, 0, 0)),
      q2Close: new Date(Date.UTC(fiscalStartYear, 9, 31, 23, 59, 59)),
      q3Open: new Date(Date.UTC(fiscalEndYear, 0, 1, 0, 0, 0)),
      q3Close: new Date(Date.UTC(fiscalEndYear, 0, 31, 23, 59, 59)),
      q4Open: new Date(Date.UTC(fiscalEndYear, 2, 1, 0, 0, 0)),
      q4Close: new Date(Date.UTC(fiscalEndYear, 3, 30, 23, 59, 59)),
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
