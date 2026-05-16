"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserEditDialog } from "@/components/admin/user-edit-dialog";
import { CreateUserDialog } from "@/components/admin/create-user-dialog";
import { Pencil, UserPlus } from "lucide-react";
import type { Role } from "@/generated/prisma";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string | null;
  managerId: string | null;
  managerName: string | null;
}

interface UsersTableProps {
  users: UserRow[];
  managers: { id: string; name: string }[];
}

const ROLE_VARIANT: Record<Role, "default" | "secondary" | "outline"> = {
  ADMIN: "default",
  MANAGER: "secondary",
  EMPLOYEE: "outline",
};

export function UsersTable({ users, managers }: UsersTableProps) {
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <UserPlus className="w-4 h-4" />
          Add User
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Department</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Manager</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-muted/20">
                <td className="px-4 py-3 font-medium whitespace-nowrap">{user.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                <td className="px-4 py-3">
                  <Badge variant={ROLE_VARIANT[user.role]}>{user.role}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{user.department ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{user.managerName ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingUser(user)}
                    className="gap-1.5"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingUser && (
        <UserEditDialog
          open={!!editingUser}
          onOpenChange={(o) => !o && setEditingUser(null)}
          user={editingUser}
          managers={managers}
        />
      )}

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        managers={managers}
      />
    </>
  );
}
