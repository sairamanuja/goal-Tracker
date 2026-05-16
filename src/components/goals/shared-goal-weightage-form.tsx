"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateSharedGoalWeightage } from "@/actions/shared-goal-actions";
import { cn } from "@/lib/utils";

interface SharedGoalWeightageFormProps {
  goalId: string;
  currentWeightage: number;
  otherGoalsTotal: number;
}

export function SharedGoalWeightageForm({
  goalId,
  currentWeightage,
  otherGoalsTotal,
}: SharedGoalWeightageFormProps) {
  const router = useRouter();
  const [weightage, setWeightage] = useState(String(currentWeightage));
  const [isPending, startTransition] = useTransition();

  const parsed = parseFloat(weightage) || 0;
  const projectedTotal = otherGoalsTotal + parsed;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const w = parseFloat(weightage);
    if (isNaN(w) || w < 10 || w > 100) {
      toast.error("Weightage must be between 10% and 100%");
      return;
    }
    if (projectedTotal > 100.001) {
      toast.error(`Total would be ${projectedTotal.toFixed(1)}% — exceeds 100%`);
      return;
    }
    startTransition(async () => {
      const result = await updateSharedGoalWeightage(goalId, w);
      if (result.success) {
        toast.success("Weightage saved");
        router.push("/employee/goals");
      } else {
        toast.error(result.error ?? "Failed to save");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div
        className={cn(
          "rounded-lg border px-4 py-2.5 text-sm flex items-center justify-between",
          projectedTotal > 100
            ? "border-destructive/50 bg-destructive/5 text-destructive"
            : projectedTotal === 100
            ? "border-green-500/50 bg-green-50 text-green-700"
            : "border-border bg-muted/30"
        )}
      >
        <span>Projected total weightage:</span>
        <span className="font-semibold tabular-nums">{projectedTotal.toFixed(1)}%</span>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="weightage">Weightage (10–100%) *</Label>
        <div className="relative max-w-xs">
          <Input
            id="weightage"
            type="number"
            value={weightage}
            onChange={(e) => setWeightage(e.target.value)}
            min={10}
            max={100}
            step={1}
            className="pr-8"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
            %
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          All goals combined must total exactly 100%.
        </p>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save Weightage"}
        </Button>
        <button
          type="button"
          onClick={() => router.push("/employee/goals")}
          className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
