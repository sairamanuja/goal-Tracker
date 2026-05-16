"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { THRUST_AREAS } from "@/lib/constants";
import { createGoal, updateGoal, type GoalFormData } from "@/actions/goal-actions";
import type { Goal, UomDirection, UomType } from "@/generated/prisma";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface GoalFormProps {
  cycleId: string;
  currentTotalWeight: number;
  existingGoal?: Goal;
  mode: "create" | "edit";
}

const UOM_LABELS: Record<UomType, string> = {
  NUMERIC: "Numeric",
  PERCENTAGE: "Percentage (%)",
  TIMELINE: "Timeline (Date)",
  ZERO: "Zero Target",
};

const UOM_DESCRIPTIONS: Record<UomType, string> = {
  NUMERIC: "A numeric value (e.g. revenue, units)",
  PERCENTAGE: "A percentage value (0–100)",
  TIMELINE: "Measured by a completion date",
  ZERO: "Goal is to achieve zero (e.g. zero incidents)",
};

export function GoalForm({ cycleId, currentTotalWeight, existingGoal, mode }: GoalFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [thrustArea, setThrustArea] = useState(existingGoal?.thrustArea ?? "");
  const [title, setTitle] = useState(existingGoal?.title ?? "");
  const [description, setDescription] = useState(existingGoal?.description ?? "");
  const [uomType, setUomType] = useState<UomType>(existingGoal?.uomType ?? "NUMERIC");
  const [uomDirection, setUomDirection] = useState<UomDirection>(
    existingGoal?.uomDirection ?? "MIN"
  );
  const [target, setTarget] = useState<string>(
    existingGoal && existingGoal.uomType !== "ZERO" && existingGoal.uomType !== "TIMELINE"
      ? String(existingGoal.target)
      : ""
  );
  const [deadline, setDeadline] = useState<string>(
    existingGoal?.deadline ? format(new Date(existingGoal.deadline), "yyyy-MM-dd") : ""
  );
  const [weightage, setWeightage] = useState<string>(
    existingGoal ? String(existingGoal.weightage) : ""
  );

  const parsedWeightage = parseFloat(weightage) || 0;
  const weightExcludingThis =
    mode === "edit" ? currentTotalWeight - (existingGoal?.weightage ?? 0) : currentTotalWeight;
  const projectedTotal = weightExcludingThis + parsedWeightage;

  function handleUomChange(val: UomType) {
    setUomType(val);
    if (val === "ZERO") {
      setTarget("0");
      setUomDirection("MIN");
    } else if (val === "TIMELINE") {
      setTarget("");
      setUomDirection("MIN");
    }
  }

  function validate(): string | null {
    if (!thrustArea) return "Thrust area is required";
    if (!title.trim()) return "Title is required";
    const w = parseFloat(weightage);
    if (isNaN(w) || w < 10) return "Minimum weightage is 10%";
    if (w > 100) return "Maximum weightage is 100%";
    if (projectedTotal > 100.001) {
      return `Adding this goal would make total ${projectedTotal.toFixed(1)}% — exceeds 100%`;
    }
    if (uomType === "TIMELINE" && !deadline) return "Deadline is required for Timeline goals";
    if ((uomType === "NUMERIC" || uomType === "PERCENTAGE") && !target) {
      return "Target value is required";
    }
    if (uomType === "PERCENTAGE") {
      const t = parseFloat(target);
      if (isNaN(t) || t < 0 || t > 100) return "Percentage target must be between 0 and 100";
    }
    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }

    const data: GoalFormData = {
      thrustArea,
      title: title.trim(),
      description: description.trim() || undefined,
      uomType,
      uomDirection,
      target:
        uomType === "ZERO"
          ? 0
          : uomType === "TIMELINE"
          ? undefined
          : parseFloat(target),
      deadline: uomType === "TIMELINE" ? new Date(deadline) : undefined,
      weightage: parseFloat(weightage),
      cycleId,
    };

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createGoal(data)
          : await updateGoal(existingGoal!.id, data);

      if (result.success) {
        toast.success(mode === "create" ? "Goal created" : "Goal updated");
        router.push("/employee/goals");
      } else {
        toast.error(result.error ?? "Something went wrong");
      }
    });
  }

  const showTarget = uomType === "NUMERIC" || uomType === "PERCENTAGE";
  const showDirection = uomType === "NUMERIC" || uomType === "PERCENTAGE";
  const showDeadline = uomType === "TIMELINE";

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-2xl">
      {/* Projected weightage hint */}
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
        <span>Projected total weightage after this goal:</span>
        <span className="font-semibold tabular-nums">{projectedTotal.toFixed(1)}%</span>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Goal Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Thrust Area */}
          <div className="space-y-1.5">
            <Label htmlFor="thrustArea">Thrust Area *</Label>
            <Select value={thrustArea} onValueChange={(v) => setThrustArea(v ?? "")}>
              <SelectTrigger id="thrustArea">
                <SelectValue placeholder="Select thrust area" />
              </SelectTrigger>
              <SelectContent>
                {THRUST_AREAS.map((area) => (
                  <SelectItem key={area} value={area}>
                    {area}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Goal Title *</Label>
            <Input
              id="title"
              placeholder="e.g. Increase quarterly revenue by 20%"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Describe how this goal will be measured…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Measurement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* UoM Type */}
          <div className="space-y-1.5">
            <Label htmlFor="uomType">Unit of Measure *</Label>
            <Select value={uomType} onValueChange={(v) => handleUomChange(v as UomType)}>
              <SelectTrigger id="uomType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["NUMERIC", "PERCENTAGE", "TIMELINE", "ZERO"] as UomType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    <div>
                      <div className="font-medium">{UOM_LABELS[t]}</div>
                      <div className="text-xs text-muted-foreground">{UOM_DESCRIPTIONS[t]}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Direction (only for NUMERIC/PERCENTAGE) */}
          {showDirection && (
            <div className="space-y-1.5">
              <Label>Direction *</Label>
              <div className="flex gap-2">
                {(["MIN", "MAX"] as UomDirection[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setUomDirection(d)}
                    className={cn(
                      "flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                      uomDirection === d
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-muted"
                    )}
                  >
                    {d === "MIN" ? "↑ Higher is better" : "↓ Lower is better"}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {uomDirection === "MIN"
                  ? "Score = (Actual ÷ Target) × 100"
                  : "Score = (Target ÷ Actual) × 100"}
              </p>
            </div>
          )}

          {/* Target (NUMERIC / PERCENTAGE) */}
          {showTarget && (
            <div className="space-y-1.5">
              <Label htmlFor="target">
                Target {uomType === "PERCENTAGE" ? "(0–100%)" : "(numeric)"} *
              </Label>
              <Input
                id="target"
                type="number"
                placeholder={uomType === "PERCENTAGE" ? "e.g. 90" : "e.g. 1000000"}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                min={0}
                max={uomType === "PERCENTAGE" ? 100 : undefined}
                step={uomType === "PERCENTAGE" ? 0.1 : 1}
              />
            </div>
          )}

          {/* Deadline (TIMELINE) */}
          {showDeadline && (
            <div className="space-y-1.5">
              <Label htmlFor="deadline">Target Completion Date *</Label>
              <Input
                id="deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
          )}

          {/* ZERO info */}
          {uomType === "ZERO" && (
            <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
              Target is automatically set to 0. Achievement is scored as 100% when actual value is 0.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Weightage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="weightage">Weightage (10–100%) *</Label>
            <div className="relative">
              <Input
                id="weightage"
                type="number"
                placeholder="e.g. 20"
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
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : mode === "create" ? "Create Goal" : "Save Changes"}
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
