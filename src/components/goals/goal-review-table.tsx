"use client";

import { useState, useTransition, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { WeightageBar } from "@/components/goals/weightage-bar";
import { StatusBadge } from "@/components/shared/status-badge";
import { approveGoalSheet, returnGoalSheet, updateGoalAsManager } from "@/actions/approval-actions";
import { cn } from "@/lib/utils";
import { isTotalWeightageExact } from "@/lib/goal-rules";
import { CheckCircle2, RotateCcw, Loader2, Share2, Lock } from "lucide-react";
import { format } from "date-fns";
import type { Goal } from "@/generated/prisma";

interface GoalReviewTableProps {
  goals: Goal[];
  employeeId: string;
  employeeName: string;
  cycleId: string;
  canEdit: boolean;
}

type EditState = {
  target: string;
  weightage: string;
  deadline: string;
};

export function GoalReviewTable({
  goals: initialGoals,
  employeeId,
  employeeName,
  cycleId,
  canEdit,
}: GoalReviewTableProps) {
  const [goals, setGoals] = useState(initialGoals);
  const [editStates, setEditStates] = useState<Record<string, EditState>>(() =>
    Object.fromEntries(
      initialGoals.map((g) => [
        g.id,
        {
          target: g.uomType !== "ZERO" && g.uomType !== "TIMELINE" ? String(g.target) : "",
          weightage: String(g.weightage),
          deadline: g.deadline ? format(new Date(g.deadline), "yyyy-MM-dd") : "",
        },
      ])
    )
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [returnComment, setReturnComment] = useState("");
  const [returnOpen, setReturnOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [isActioning, startAction] = useTransition();
  const prevValues = useRef<Record<string, EditState>>({ ...editStates });

  const currentTotalWeight = goals.reduce((s, g) => s + g.weightage, 0);
  const isWeightageValid = isTotalWeightageExact(currentTotalWeight);
  const hasSubmitted = goals.some((g) => g.status === "SUBMITTED");
  const canApprove = canEdit && hasSubmitted && isWeightageValid && savingId === null;

  function updateLocal(goalId: string, field: keyof EditState, value: string) {
    setEditStates((prev) => ({ ...prev, [goalId]: { ...prev[goalId], [field]: value } }));
  }

  async function saveField(goal: Goal, field: keyof EditState) {
    const current = editStates[goal.id][field];
    const prev = prevValues.current[goal.id]?.[field] ?? current;
    if (current === prev) return;

    setSavingId(goal.id);
    try {
      const updateData: { target?: number; weightage?: number; deadline?: Date | null } = {};

      if (field === "target") {
        const val = parseFloat(current);
        if (isNaN(val) || val < 0) {
          toast.error("Invalid target value");
          setEditStates((s) => ({ ...s, [goal.id]: { ...s[goal.id], target: prev } }));
          return;
        }
        if (goal.uomType === "PERCENTAGE" && (val < 0 || val > 100)) {
          toast.error("Percentage target must be between 0 and 100");
          setEditStates((s) => ({ ...s, [goal.id]: { ...s[goal.id], target: prev } }));
          return;
        }
        updateData.target = val;
      } else if (field === "weightage") {
        const val = parseFloat(current);
        if (isNaN(val) || val < 10 || val > 100) {
          toast.error("Weightage must be between 10% and 100%");
          setEditStates((s) => ({ ...s, [goal.id]: { ...s[goal.id], weightage: prev } }));
          return;
        }
        updateData.weightage = val;
      } else if (field === "deadline") {
        updateData.deadline = current ? new Date(current) : null;
      }

      const result = await updateGoalAsManager(goal.id, updateData);
      if (result.success) {
        prevValues.current[goal.id] = { ...editStates[goal.id], [field]: current };
        // Update local goals for weightage bar
        setGoals((gs) =>
          gs.map((g) =>
            g.id === goal.id
              ? {
                  ...g,
                  weightage: field === "weightage" ? parseFloat(current) : g.weightage,
                  target:
                    field === "target"
                      ? parseFloat(current)
                      : g.target,
                  deadline:
                    field === "deadline"
                      ? current
                        ? new Date(current)
                        : null
                      : g.deadline,
                }
              : g
          )
        );
        toast.success("Saved");
      } else {
        toast.error(result.error ?? "Save failed");
        setEditStates((s) => ({ ...s, [goal.id]: { ...s[goal.id], [field]: prev } }));
      }
    } finally {
      setSavingId(null);
    }
  }

  function handleApprove() {
    startAction(async () => {
      const result = await approveGoalSheet(employeeId, cycleId);
      if (result.success) {
        toast.success(`${employeeName}'s goal sheet approved`);
        setApproveOpen(false);
      } else {
        toast.error(result.error ?? "Approval failed");
        setApproveOpen(false);
      }
    });
  }

  function handleReturn() {
    if (returnComment.trim().length < 10) {
      toast.error("Comment must be at least 10 characters");
      return;
    }
    startAction(async () => {
      const result = await returnGoalSheet(employeeId, cycleId, returnComment);
      if (result.success) {
        toast.success("Goal sheet returned for rework");
        setReturnOpen(false);
        setReturnComment("");
      } else {
        toast.error(result.error ?? "Return failed");
      }
    });
  }

  const UOM_LABEL: Record<string, string> = {
    NUMERIC: "Numeric",
    PERCENTAGE: "%",
    TIMELINE: "Date",
    ZERO: "Zero",
  };

  return (
    <div className="space-y-4">
      {/* Weightage bar */}
      {goals.length > 0 && (
        <WeightageBar
          goals={goals.map((g) => ({ title: g.title, weightage: g.weightage }))}
          showLabels={false}
        />
      )}

      {/* Action bar */}
      {canEdit && hasSubmitted && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <div className="text-sm">
            <span className="font-medium">Goal sheet submitted</span>
            <span className="text-muted-foreground ml-2">
              — review and edit below, then approve or return
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Return dialog */}
            <Dialog open={returnOpen} onOpenChange={(o) => setReturnOpen(o)}>
              <DialogTrigger
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors",
                  isActioning && "opacity-50 pointer-events-none"
                )}
              >
                <RotateCcw className="w-4 h-4" />
                Return for Rework
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Return Goal Sheet</DialogTitle>
                  <DialogDescription>
                    Provide feedback for {employeeName} explaining what needs to be changed.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="returnComment">
                    Comment <span className="text-muted-foreground">(min 10 characters)</span>
                  </Label>
                  <Textarea
                    id="returnComment"
                    placeholder="e.g. Please adjust the weightage distribution and clarify target for Revenue Growth goal…"
                    value={returnComment}
                    onChange={(e) => setReturnComment(e.target.value)}
                    rows={4}
                    maxLength={1000}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {returnComment.length}/1000
                  </p>
                </div>
                <DialogFooter>
                  <Button
                    variant="destructive"
                    onClick={handleReturn}
                    disabled={isActioning || returnComment.trim().length < 10}
                    className="gap-2"
                  >
                    {isActioning && <Loader2 className="w-4 h-4 animate-spin" />}
                    Return for Rework
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Approve dialog */}
            <Dialog open={approveOpen} onOpenChange={(o) => setApproveOpen(o)}>
              <DialogTrigger
                disabled={!canApprove}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  canApprove
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                <CheckCircle2 className="w-4 h-4" />
                Approve Goal Sheet
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Approve Goal Sheet</DialogTitle>
                  <DialogDescription>
                    You are about to approve {employeeName}&apos;s goal sheet. This will lock all
                    goals and they will not be editable by the employee.
                  </DialogDescription>
                </DialogHeader>
                <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Goals</span>
                    <span className="font-medium">{goals.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Weightage</span>
                    <span
                      className={cn(
                        "font-medium tabular-nums",
                        isWeightageValid ? "text-green-600" : "text-destructive"
                      )}
                    >
                      {currentTotalWeight.toFixed(0)}%
                    </span>
                  </div>
                </div>
                {!isWeightageValid && (
                  <p className="text-sm text-destructive">
                    Total weightage must equal 100% before approving.
                  </p>
                )}
                <DialogFooter>
                  <Button
                    onClick={handleApprove}
                    disabled={isActioning || !canApprove}
                    className="gap-2"
                  >
                    {isActioning && <Loader2 className="w-4 h-4 animate-spin" />}
                    Confirm Approval
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      )}

      {/* Goals table */}
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Thrust Area</TableHead>
              <TableHead>UoM</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Weightage</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {goals.map((goal, idx) => {
              const isSaving = savingId === goal.id;
              const isSubmitted = goal.status === "SUBMITTED";
              const isEditableRow = canEdit && isSubmitted;
              const isSharedCopy = goal.sharedFromId !== null;
              const es = editStates[goal.id];

              return (
                <TableRow key={goal.id} className={isSaving ? "opacity-60" : undefined}>
                  <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell className="max-w-[200px]">
                    <p className="font-medium truncate">{goal.title}</p>
                    {goal.description && (
                      <p className="text-xs text-muted-foreground truncate">{goal.description}</p>
                    )}
                    {isSharedCopy && (
                      <p className="text-xs text-blue-600 flex items-center gap-0.5 mt-0.5">
                        <Lock className="w-2.5 h-2.5" />
                        Shared goal
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{goal.thrustArea}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {UOM_LABEL[goal.uomType]}
                    {(goal.uomType === "NUMERIC" || goal.uomType === "PERCENTAGE") && (
                      <span className="block text-xs">
                        {goal.uomDirection === "MIN" ? "↑ Higher" : "↓ Lower"}
                      </span>
                    )}
                  </TableCell>

                  {/* Target cell */}
                  <TableCell>
                    {goal.uomType === "ZERO" ? (
                      <span className="text-muted-foreground text-sm">0</span>
                    ) : goal.uomType === "TIMELINE" ? (
                      isEditableRow && !isSharedCopy ? (
                        <Input
                          type="date"
                          value={es.deadline}
                          onChange={(e) => updateLocal(goal.id, "deadline", e.target.value)}
                          onBlur={() => saveField(goal, "deadline")}
                          className="h-7 text-xs w-36"
                        />
                      ) : (
                        <span className="text-sm">
                          {goal.deadline ? format(new Date(goal.deadline), "dd MMM yyyy") : "—"}
                        </span>
                      )
                    ) : isEditableRow && !isSharedCopy ? (
                      <Input
                        type="number"
                        value={es.target}
                        onChange={(e) => updateLocal(goal.id, "target", e.target.value)}
                        onBlur={() => saveField(goal, "target")}
                        className="h-7 text-xs w-24"
                        min={0}
                        max={goal.uomType === "PERCENTAGE" ? 100 : undefined}
                      />
                    ) : (
                      <span className="text-sm">
                        {goal.target}
                        {goal.uomType === "PERCENTAGE" ? "%" : ""}
                      </span>
                    )}
                    {isSaving && (
                      <Loader2 className="inline ml-1 w-3 h-3 animate-spin text-muted-foreground" />
                    )}
                  </TableCell>

                  {/* Weightage cell */}
                  <TableCell>
                    {isEditableRow ? (
                      <div className="relative w-20">
                        <Input
                          type="number"
                          value={es.weightage}
                          onChange={(e) => updateLocal(goal.id, "weightage", e.target.value)}
                          onBlur={() => saveField(goal, "weightage")}
                          className="h-7 text-xs pr-5"
                          min={10}
                          max={100}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                          %
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm font-medium tabular-nums">{goal.weightage}%</span>
                    )}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={goal.status} />
                      {isSharedCopy && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">
                          <Share2 className="w-3 h-3" />
                          Shared
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}

            {/* Total row */}
            {goals.length > 0 && (
              <TableRow className="bg-muted/30 font-medium">
                <TableCell colSpan={5} className="text-right text-sm">
                  Total Weightage
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      isWeightageValid ? "text-green-600" : "text-destructive"
                    )}
                  >
                    {currentTotalWeight.toFixed(0)}%
                  </span>
                </TableCell>
                <TableCell />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
