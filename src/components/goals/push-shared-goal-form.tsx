"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { THRUST_AREAS } from "@/lib/constants";
import { pushSharedGoal } from "@/actions/shared-goal-actions";
import type { UomType, UomDirection } from "@/generated/prisma";
import { cn } from "@/lib/utils";
import { Search, Users, CheckSquare, Square, Share2, AlertCircle } from "lucide-react";

interface Employee {
  id: string;
  name: string;
  department: string | null;
}

interface PushSharedGoalFormProps {
  employees: Employee[];
  cycleId: string;
  cycleName: string;
}

const UOM_LABELS: Record<UomType, string> = {
  NUMERIC: "Numeric",
  PERCENTAGE: "Percentage (%)",
  TIMELINE: "Timeline (Date)",
  ZERO: "Zero Target",
};

export function PushSharedGoalForm({ employees, cycleId, cycleName }: PushSharedGoalFormProps) {
  const [isPending, startTransition] = useTransition();

  // Employee selection state
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Goal form state
  const [thrustArea, setThrustArea] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uomType, setUomType] = useState<UomType>("NUMERIC");
  const [uomDirection, setUomDirection] = useState<UomDirection>("MIN");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [defaultWeightage, setDefaultWeightage] = useState("");

  // Result state
  const [lastResult, setLastResult] = useState<{ pushed: number; skipped: string[] } | null>(null);

  const departments = ["ALL", ...Array.from(new Set(employees.map((e) => e.department).filter(Boolean))) as string[]];

  const filtered = employees.filter((e) => {
    const matchesDept = deptFilter === "ALL" || e.department === deptFilter;
    const matchesSearch = !search || e.name.toLowerCase().includes(search.toLowerCase());
    return matchesDept && matchesSearch;
  });

  function toggleEmployee(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(filtered.map((e) => e.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function handleUomChange(val: UomType) {
    setUomType(val);
    if (val === "ZERO") { setTarget("0"); setUomDirection("MIN"); }
    else if (val === "TIMELINE") { setTarget(""); setUomDirection("MIN"); }
  }

  function validate(): string | null {
    if (!thrustArea) return "Thrust area is required";
    if (!title.trim()) return "Title is required";
    const w = parseFloat(defaultWeightage);
    if (isNaN(w) || w < 10 || w > 100) return "Default weightage must be between 10% and 100%";
    if (uomType === "TIMELINE" && !deadline) return "Deadline is required for Timeline goals";
    if ((uomType === "NUMERIC" || uomType === "PERCENTAGE") && !target) return "Target value is required";
    if (uomType === "PERCENTAGE") {
      const t = parseFloat(target);
      if (isNaN(t) || t < 0 || t > 100) return "Percentage target must be between 0 and 100";
    }
    if (selectedIds.size === 0) return "Select at least one recipient";
    return null;
  }

  function handlePush() {
    const err = validate();
    if (err) { toast.error(err); return; }

    startTransition(async () => {
      const result = await pushSharedGoal({
        thrustArea,
        title: title.trim(),
        description: description.trim() || undefined,
        uomType,
        uomDirection,
        target:
          uomType === "ZERO" ? 0
          : uomType === "TIMELINE" ? 0
          : parseFloat(target),
        deadline: uomType === "TIMELINE" && deadline ? new Date(deadline) : null,
        defaultWeightage: parseFloat(defaultWeightage),
        cycleId,
        recipientIds: [...selectedIds],
      });

      if (result.success) {
        setLastResult({ pushed: result.pushed ?? 0, skipped: result.skipped ?? [] });
        toast.success(`Pushed to ${result.pushed ?? 0} employee${(result.pushed ?? 0) !== 1 ? "s" : ""}`);
        if ((result.skipped?.length ?? 0) > 0) {
          toast.warning(`${result.skipped!.length} skipped (at 8 goals): ${result.skipped!.join(", ")}`);
        }
        // Reset
        setSelectedIds(new Set());
        setTitle("");
        setDescription("");
        setTarget("");
        setDeadline("");
        setDefaultWeightage("");
        setThrustArea("");
        setUomType("NUMERIC");
        setUomDirection("MIN");
      } else {
        toast.error(result.error ?? "Push failed");
      }
    });
  }

  const showTarget = uomType === "NUMERIC" || uomType === "PERCENTAGE";
  const showDirection = uomType === "NUMERIC" || uomType === "PERCENTAGE";
  const showDeadline = uomType === "TIMELINE";

  return (
    <div className="space-y-6">
      {/* Last push result banner */}
      {lastResult && (
        <div className="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm space-y-1">
          <p className="font-medium text-green-800">
            Goal pushed to {lastResult.pushed} employee{lastResult.pushed !== 1 ? "s" : ""} in {cycleName}.
          </p>
          {lastResult.skipped.length > 0 && (
            <p className="text-amber-700 flex items-start gap-1.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              Skipped (already at 8 goals): {lastResult.skipped.join(", ")}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Goal definition */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Goal Definition</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Thrust Area */}
              <div className="space-y-1.5">
                <Label>Thrust Area *</Label>
                <Select value={thrustArea} onValueChange={(v) => setThrustArea(v ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select thrust area" />
                  </SelectTrigger>
                  <SelectContent>
                    {THRUST_AREAS.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <Label>Goal Title *</Label>
                <Input
                  placeholder="e.g. Increase revenue by 20%"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label>Description (optional)</Label>
                <Textarea
                  placeholder="How will this goal be measured…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={1000}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Measurement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* UoM */}
              <div className="space-y-1.5">
                <Label>Unit of Measure *</Label>
                <Select value={uomType} onValueChange={(v) => handleUomChange(v as UomType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["NUMERIC", "PERCENTAGE", "TIMELINE", "ZERO"] as UomType[]).map((t) => (
                      <SelectItem key={t} value={t}>{UOM_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Direction */}
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
                          "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                          uomDirection === d
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:bg-muted"
                        )}
                      >
                        {d === "MIN" ? "↑ Higher is better" : "↓ Lower is better"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Target */}
              {showTarget && (
                <div className="space-y-1.5">
                  <Label>Target {uomType === "PERCENTAGE" ? "(0–100%)" : "(numeric)"} *</Label>
                  <Input
                    type="number"
                    placeholder={uomType === "PERCENTAGE" ? "e.g. 90" : "e.g. 1000000"}
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    min={0}
                    max={uomType === "PERCENTAGE" ? 100 : undefined}
                  />
                </div>
              )}

              {/* Deadline */}
              {showDeadline && (
                <div className="space-y-1.5">
                  <Label>Target Completion Date *</Label>
                  <Input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </div>
              )}

              {/* Zero info */}
              {uomType === "ZERO" && (
                <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                  Target is automatically 0. Achievement is 100% when actual value is 0.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Default Weightage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                <Label>Weightage (10–100%) *</Label>
                <div className="relative max-w-xs">
                  <Input
                    type="number"
                    placeholder="e.g. 20"
                    value={defaultWeightage}
                    onChange={(e) => setDefaultWeightage(e.target.value)}
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
                  Recipients can adjust their own weightage after receiving the goal.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Employee selector */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4" />
                Select Recipients
              </CardTitle>
              {selectedIds.size > 0 && (
                <Badge variant="secondary">{selectedIds.size} selected</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Filters */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search employees…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
              {departments.length > 1 && (
                <Select value={deptFilter} onValueChange={(v) => setDeptFilter(v ?? "ALL")}>
                  <SelectTrigger className="w-36 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d} value={d}>{d === "ALL" ? "All Depts" : d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Select all / clear */}
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={selectAll}
                className="text-primary hover:underline"
              >
                Select all visible
              </button>
              {selectedIds.size > 0 && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="text-muted-foreground hover:underline"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>

            {/* Employee list */}
            <div className="divide-y rounded-lg border max-h-80 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No employees match your filter.
                </div>
              ) : (
                filtered.map((emp) => {
                  const checked = selectedIds.has(emp.id);
                  return (
                    <label
                      key={emp.id}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleEmployee(emp.id)}
                        className="sr-only"
                      />
                      {checked
                        ? <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                        : <Square className="w-4 h-4 text-muted-foreground shrink-0" />
                      }
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{emp.name}</p>
                        {emp.department && (
                          <p className="text-xs text-muted-foreground">{emp.department}</p>
                        )}
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Push button */}
      <div className="flex items-center gap-4">
        <Button
          onClick={handlePush}
          disabled={isPending || selectedIds.size === 0}
          className="gap-2"
        >
          <Share2 className="w-4 h-4" />
          {isPending ? "Pushing…" : `Push to ${selectedIds.size || "0"} Employee${selectedIds.size !== 1 ? "s" : ""}`}
        </Button>
        {selectedIds.size === 0 && (
          <p className="text-sm text-muted-foreground">Select at least one recipient to push.</p>
        )}
      </div>
    </div>
  );
}
