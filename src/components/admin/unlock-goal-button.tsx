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
import { unlockGoal } from "@/actions/admin-actions";
import { Unlock } from "lucide-react";

interface UnlockGoalButtonProps {
  goalId: string;
  goalTitle: string;
}

export function UnlockGoalButton({ goalId, goalTitle }: UnlockGoalButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleUnlock() {
    startTransition(async () => {
      const result = await unlockGoal(goalId, reason);
      if (result.success) {
        toast.success("Goal unlocked");
        setOpen(false);
        setReason("");
      } else {
        toast.error(result.error ?? "Failed");
      }
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Unlock className="w-3.5 h-3.5" />
        Unlock
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Unlock Goal</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Unlocking will allow the employee to edit and re-submit this goal. Manager re-approval will be required.
            </p>
            <p className="text-sm font-medium">{goalTitle}</p>
            <div className="space-y-1.5">
              <Label htmlFor="unlock-reason">Reason</Label>
              <Input
                id="unlock-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Brief reason for unlocking…"
              />
            </div>
          </div>
          <DialogFooter showCloseButton>
            <Button
              onClick={handleUnlock}
              disabled={isPending || reason.trim().length < 5}
              variant="destructive"
            >
              {isPending ? "Unlocking…" : "Confirm Unlock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
