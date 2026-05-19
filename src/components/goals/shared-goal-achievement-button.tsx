"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScoreBadge } from "@/components/goals/score-badge";
import { saveSharedGoalAchievement } from "@/actions/shared-goal-actions";
import type { ProgressStatus, Quarter, UomDirection, UomType } from "@/generated/prisma";

type SharedGoalAchievement = {
  quarter: Quarter;
  planned: number | null;
  actual: number | null;
  completionDate: string | null;
  status: ProgressStatus;
  score: number | null;
};

type SharedGoalSummary = {
  id: string;
  title: string;
  uomType: UomType;
  uomDirection: UomDirection;
  target: number;
  deadline: string | null;
  achievements: SharedGoalAchievement[];
};

const STATUS_LABELS: Record<ProgressStatus, string> = {
  NOT_STARTED: "Not Started",
  ON_TRACK: "On Track",
  COMPLETED: "Completed",
};

export function SharedGoalAchievementButton({
  goal,
  activeQuarter,
}: {
  goal: SharedGoalSummary;
  activeQuarter: Quarter | null;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const currentAchievement = activeQuarter
    ? goal.achievements.find((a) => a.quarter === activeQuarter) ?? null
    : null;
  const [planned, setPlanned] = useState(
    currentAchievement?.planned !== null && currentAchievement?.planned !== undefined
      ? String(currentAchievement.planned)
      : ""
  );
  const [actual, setActual] = useState(
    currentAchievement?.actual !== null && currentAchievement?.actual !== undefined
      ? String(currentAchievement.actual)
      : ""
  );
  const [completionDate, setCompletionDate] = useState(
    currentAchievement?.completionDate ? currentAchievement.completionDate.split("T")[0] : ""
  );
  const [status, setStatus] = useState<ProgressStatus>(currentAchievement?.status ?? "NOT_STARTED");
  const [savedScore, setSavedScore] = useState<number | null | undefined>(currentAchievement?.score ?? undefined);

  const isTimeline = goal.uomType === "TIMELINE";
  const isZero = goal.uomType === "ZERO";

  function handleSave() {
    if (!activeQuarter) return;

    const payload: {
      goalId: string;
      quarter: Quarter;
      planned?: number;
      actual?: number;
      completionDate?: Date;
      status: ProgressStatus;
    } = {
      goalId: goal.id,
      quarter: activeQuarter,
      status,
    };

    if (status === "NOT_STARTED") {
      const plannedValue = parseFloat(planned);
      if (!isNaN(plannedValue)) payload.planned = plannedValue;
    } else if (isTimeline && status === "COMPLETED") {
      if (!completionDate) {
        toast.error("Completion date is required for timeline goals");
        return;
      }
      payload.completionDate = new Date(completionDate);
    } else {
      const plannedValue = parseFloat(planned);
      const actualValue = parseFloat(actual);
      if (!isNaN(plannedValue)) payload.planned = plannedValue;
      if (!isNaN(actualValue)) payload.actual = actualValue;
    }

    startTransition(async () => {
      const result = await saveSharedGoalAchievement(payload);
      if (result.success) {
        setSavedScore(result.score ?? null);
        toast.success("Shared achievement synced to recipients");
        setOpen(false);
      } else {
        toast.error(result.error ?? "Save failed");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            disabled={!activeQuarter}
            className="gap-1.5"
            title={activeQuarter ? `Update ${activeQuarter} achievement` : "No quarter is open"}
          />
        }
      >
        <TrendingUp className="w-3.5 h-3.5" />
        {activeQuarter ? `Update ${activeQuarter}` : "No quarter"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update Shared Achievement</DialogTitle>
          <DialogDescription>
            This updates the primary KPI and syncs the same achievement to every linked employee copy.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm space-y-1">
            <p className="font-medium">{goal.title}</p>
            {isTimeline ? (
              <p className="text-muted-foreground">
                Deadline: {goal.deadline ? format(new Date(goal.deadline), "dd MMM yyyy") : "-"}
              </p>
            ) : (
              <p className="text-muted-foreground">
                Target: {goal.target}
                {goal.uomType === "PERCENTAGE" ? "%" : ""}
                {isZero ? " (zero success)" : ""}
                {(goal.uomType === "NUMERIC" || goal.uomType === "PERCENTAGE") &&
                  ` - ${goal.uomDirection === "MIN" ? "higher is better" : "lower is better"}`}
              </p>
            )}
          </div>

          {!isTimeline && (
            <div className="space-y-1.5">
              <Label htmlFor={`shared-planned-${goal.id}`}>Planned Achievement</Label>
              <Input
                id={`shared-planned-${goal.id}`}
                type="number"
                min={0}
                max={goal.uomType === "PERCENTAGE" ? 100 : undefined}
                value={planned}
                onChange={(e) => setPlanned(e.target.value)}
                placeholder="Planned for this quarter"
              />
            </div>
          )}

          {isTimeline ? (
            <div className="space-y-1.5">
              <Label htmlFor={`shared-completion-${goal.id}`}>Completion Date</Label>
              <Input
                id={`shared-completion-${goal.id}`}
                type="date"
                value={completionDate}
                onChange={(e) => setCompletionDate(e.target.value)}
                disabled={status !== "COMPLETED"}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor={`shared-actual-${goal.id}`}>
                {isZero ? "Number of Incidents (actual)" : "Actual Achievement"}
              </Label>
              <Input
                id={`shared-actual-${goal.id}`}
                type="number"
                min={0}
                max={goal.uomType === "PERCENTAGE" ? 100 : undefined}
                value={actual}
                onChange={(e) => setActual(e.target.value)}
                placeholder="Actual for this quarter"
                disabled={status === "NOT_STARTED"}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus((v ?? "NOT_STARTED") as ProgressStatus)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABELS) as ProgressStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {savedScore !== undefined && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Score:</span>
              {savedScore !== null ? <ScoreBadge score={savedScore} /> : <span className="text-muted-foreground">-</span>}
            </div>
          )}
        </div>

        <DialogFooter showCloseButton>
          <Button onClick={handleSave} disabled={isPending || !activeQuarter}>
            {isPending ? "Saving..." : "Save and Sync"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
