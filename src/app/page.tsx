import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function RootPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const role = session.user.role;
  if (role === "ADMIN") redirect("/admin/dashboard");
  if (role === "MANAGER") redirect("/manager/dashboard");
  redirect("/employee/goals");
}
