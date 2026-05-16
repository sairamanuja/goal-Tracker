import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Role } from "@/generated/prisma";

export async function requireAuth(allowedRoles?: Role[]) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (allowedRoles && !allowedRoles.includes(session.user.role)) {
    redirect("/unauthorized");
  }

  return session;
}

export async function requireAdmin() {
  return requireAuth(["ADMIN"]);
}

export async function requireManager() {
  return requireAuth(["MANAGER"]);
}

export async function requireEmployee() {
  return requireAuth(["EMPLOYEE"]);
}
