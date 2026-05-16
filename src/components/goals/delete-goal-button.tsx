"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { deleteGoal } from "@/actions/goal-actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface DeleteGoalButtonProps {
  goalId: string;
  goalTitle: string;
}

export function DeleteGoalButton({ goalId, goalTitle }: DeleteGoalButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteGoal(goalId);
      if (result.success) {
        toast.success("Goal deleted");
        setOpen(false);
      } else {
        toast.error(result.error ?? "Failed to delete goal");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        title="Delete goal"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete Goal"
        description={`Delete "${goalTitle}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        isPending={isPending}
        onConfirm={handleConfirm}
      />
    </>
  );
}
