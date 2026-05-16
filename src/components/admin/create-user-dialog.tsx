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
import { createUser } from "@/actions/admin-actions";
import type { Role } from "@/generated/prisma";

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  managers: { id: string; name: string }[];
}

const ROLES: Role[] = ["EMPLOYEE", "MANAGER", "ADMIN"];

export function CreateUserDialog({ open, onOpenChange, managers }: CreateUserDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("EMPLOYEE");
  const [department, setDepartment] = useState("");
  const [managerId, setManagerId] = useState("");

  function handleCreate() {
    startTransition(async () => {
      const result = await createUser({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        department: department.trim() || undefined,
        managerId: managerId || undefined,
      });
      if (result.success) {
        toast.success("User created");
        setName(""); setEmail(""); setPassword(""); setRole("EMPLOYEE");
        setDepartment(""); setManagerId("");
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
          <DialogTitle>Add New User</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-name">Full Name</Label>
            <Input id="new-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-email">Email</Label>
            <Input id="new-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@company.com" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-password">Password</Label>
            <Input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole((v ?? role) as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-dept">Department</Label>
              <Input id="new-dept" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Engineering" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Manager</Label>
            <Select
              value={managerId || "none"}
              onValueChange={(v) => setManagerId(v === "none" ? "" : (v ?? ""))}
            >
              <SelectTrigger><SelectValue placeholder="No manager" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No manager</SelectItem>
                {managers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter showCloseButton>
          <Button
            onClick={handleCreate}
            disabled={isPending || !name.trim() || !email.trim() || !password}
          >
            {isPending ? "Creating…" : "Create User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
