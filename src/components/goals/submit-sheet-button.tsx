"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { submitGoalSheet } from "@/actions/goal-actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Send } from "lucide-react";

interface SubmitSheetButtonProps {
  cycleId: string;
  canSubmit: boolean;
  totalWeight: number;
  goalCount: number;
}

export function SubmitSheetButton({ cycleId, canSubmit, totalWeight, goalCount }: SubmitSheetButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await submitGoalSheet(cycleId);
      if (result.success) {
        toast.success("Goal sheet submitted for manager approval");
        setOpen(false);
      } else {
        toast.error(result.error ?? "Submission failed");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={() => setOpen(true)} disabled={!canSubmit} className="gap-2">
        <Send className="w-4 h-4" />
        Submit Goal Sheet
      </Button>
      {!canSubmit && (
        <p className="text-xs text-muted-foreground">
          {totalWeight === 0
            ? "Add goals before submitting"
            : `Total weightage: ${totalWeight.toFixed(0)}% — must equal 100%`}
        </p>
      )}

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Submit Goal Sheet"
        description={`Send ${goalCount} goal${goalCount !== 1 ? "s" : ""} (${totalWeight.toFixed(0)}% total weightage) to your manager for approval? You won't be able to edit goals after submission.`}
        confirmLabel="Submit"
        isPending={isPending}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
