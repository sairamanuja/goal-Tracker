import { requireAuth } from "@/lib/auth-guard";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await requireAuth();
  const role = session.user.role;

  if (role === "ADMIN") redirect("/admin/dashboard");
  if (role === "MANAGER") redirect("/manager/dashboard");
  redirect("/employee/goals");
}
