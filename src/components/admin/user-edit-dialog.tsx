"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateUser } from "@/actions/admin-actions";
import type { Role } from "@/generated/prisma";

interface UserEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
    department: string | null;
    managerId: string | null;
  };
  managers: { id: string; name: string }[];
}

const ROLES: Role[] = ["EMPLOYEE", "MANAGER", "ADMIN"];

export function UserEditDialog({ open, onOpenChange, user, managers }: UserEditDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [role, setRole] = useState<Role>(user.role);
  const [department, setDepartment] = useState(user.department ?? "");
  const [managerId, setManagerId] = useState(user.managerId ?? "");

  function handleSave() {
    startTransition(async () => {
      const result = await updateUser(user.id, {
        role,
        department: department.trim() || undefined,
        managerId: managerId || null,
      });
      if (result.success) {
        toast.success("User updated");
        onOpenChange(false);
      } else {
        toast.error(result.error ?? "Failed");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>

          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole((v ?? role) as Role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="user-dept">Department</Label>
            <Input
              id="user-dept"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="Engineering"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Manager</Label>
            <Select
              value={managerId || "none"}
              onValueChange={(v) => setManagerId(v === "none" ? "" : (v ?? ""))}
            >
              <SelectTrigger>
                <SelectValue placeholder="No manager" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No manager</SelectItem>
                {managers
                  .filter((m) => m.id !== user.id)
                  .map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter showCloseButton>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
