import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { UsersTable } from "@/components/admin/users-table";
import { SyncEntraButton } from "@/components/admin/sync-entra-button";

import type { Metadata } from "next";
export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersPage() {
  await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    include: { manager: { select: { name: true } } },
  });

  const rows = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    department: u.department,
    managerId: u.managerId,
    managerName: u.manager?.name ?? null,
  }));

  const managers = users
    .filter((u) => u.role === "MANAGER" || u.role === "ADMIN")
    .map((u) => ({ id: u.id, name: u.name }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">User Management</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {users.length} users · manage roles, departments, and manager assignments
          </p>
        </div>
        <SyncEntraButton />
      </div>
      <UsersTable users={rows} managers={managers} />
    </div>
  );
}
