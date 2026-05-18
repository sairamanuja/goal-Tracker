"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScoreBadge } from "@/components/goals/score-badge";
import { saveAchievement } from "@/actions/achievement-actions";
import type { Quarter, UomType, UomDirection, ProgressStatus } from "@/generated/prisma";
import { cn } from "@/lib/utils";
import { Lock, Info } from "lucide-react";
import { format } from "date-fns";

type QuarterState = "active" | "past" | "future";

interface SerializedAchievement {
  planned: number | null;
  actual: number | null;
  completionDate: string | null;
  status: ProgressStatus;
  score: number | null;
}

interface GoalData {
  id: string;
  uomType: UomType;
  uomDirection: UomDirection;
  target: number;
  deadline: string | null;
  isShared: boolean;
  sharedFromId: string | null;
}

interface AchievementTabsProps {
  goal: GoalData;
  quarterStates: Record<Quarter, QuarterState>;
  quarterOpenDates: Record<Quarter, string>;
  achievements: Record<Quarter, SerializedAchievement | null>;
  defaultTab: Quarter;
  isSharedCopy: boolean;
  pusherName: string | null;
}

type SavePayload = {
  planned?: number;
  actual?: number;
  completionDate?: Date;
  status: ProgressStatus;
};

const QUARTERS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];

const STATUS_LABELS: Record<ProgressStatus, string> = {
  NOT_STARTED: "Not Started",
  ON_TRACK: "On Track",
  COMPLETED: "Completed",
};

export function AchievementTabs({
  goal,
  quarterStates,
  quarterOpenDates,
  achievements,
  defaultTab,
  isSharedCopy,
  pusherName,
}: AchievementTabsProps) {
  const [activeTab, setActiveTab] = useState<Quarter>(defaultTab);
  const [isPending, startTransition] = useTransition();
  const [savedScores, setSavedScores] = useState<Partial<Record<Quarter, number | null>>>({});

  const currentState = quarterStates[activeTab];
  const currentAchievement = achievements[activeTab];
  const canEdit = !isSharedCopy && currentState === "active";

  function getDisplayScore(q: Quarter): number | null {
    return savedScores[q] !== undefined ? savedScores[q] ?? null : achievements[q]?.score ?? null;
  }

  function handleSave(payload: SavePayload) {
    startTransition(async () => {
      const result = await saveAchievement({
        goalId: goal.id,
        quarter: activeTab,
        ...payload,
      });
      if (result.success) {
        toast.success("Achievement saved");
        setSavedScores((prev) => ({ ...prev, [activeTab]: result.score ?? null }));
      } else {
        toast.error(result.error ?? "Save failed");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-0 border-b">
        {QUARTERS.map((q) => {
          const qState = quarterStates[q];
          const score = getDisplayScore(q);
          const isDisabled = qState === "future";

          return (
            <button
              key={q}
              type="button"
              disabled={isDisabled}
              onClick={() => !isDisabled && setActiveTab(q)}
              title={isDisabled ? `Opens ${format(new Date(quarterOpenDates[q]), "dd MMM yyyy")}` : undefined}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeTab === q ? "border-primary text-primary" : "border-transparent text-muted-foreground",
                isDisabled ? "opacity-40 cursor-not-allowed" : "hover:text-foreground hover:border-muted-foreground"
              )}
            >
              {q}
              {score !== null && <ScoreBadge score={score} />}
              {qState === "active" && score === null && !isSharedCopy && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">{activeTab} Achievement</CardTitle>
            <div className="flex items-center gap-2 text-xs">
              {isSharedCopy && (
                <span className="text-blue-600 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  {pusherName ? `Managed by ${pusherName}` : "Updated by primary owner"}
                </span>
              )}
              {!isSharedCopy && currentState === "active" && (
                <span className="text-primary font-medium">Quarter open - editable</span>
              )}
              {!isSharedCopy && currentState === "past" && (
                <span className="text-muted-foreground">Quarter closed - read only</span>
              )}
              {!isSharedCopy && currentState === "future" && (
                <span className="text-muted-foreground flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Opens {format(new Date(quarterOpenDates[activeTab]), "dd MMM yyyy")}
                </span>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {currentState === "future" && !isSharedCopy ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              This quarter opens on {format(new Date(quarterOpenDates[activeTab]), "dd MMM yyyy")}.
            </p>
          ) : isSharedCopy ? (
            <ReadOnlyContent
              achievement={currentAchievement}
              goal={goal}
              sharedNote={
                currentAchievement
                  ? `Synced from primary goal owned by${pusherName ? ` ${pusherName}` : " your manager/admin"}.`
                  : `Pending primary owner's update${pusherName ? ` (${pusherName})` : ""}.`
              }
              pendingPrimary={!currentAchievement}
            />
          ) : canEdit ? (
            <EditableForm
              key={activeTab}
              goal={goal}
              achievement={currentAchievement}
              savedScore={savedScores[activeTab]}
              onSave={handleSave}
              isPending={isPending}
            />
          ) : (
            <ReadOnlyContent achievement={currentAchievement} goal={goal} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EditableForm({
  goal,
  achievement,
  savedScore,
  onSave,
  isPending,
}: {
  goal: GoalData;
  achievement: SerializedAchievement | null;
  savedScore: number | null | undefined;
  onSave: (payload: SavePayload) => void;
  isPending: boolean;
}) {
  const [planned, setPlanned] = useState(
    achievement?.planned !== null && achievement?.planned !== undefined ? String(achievement.planned) : ""
  );
  const [actual, setActual] = useState(
    achievement?.actual !== null && achievement?.actual !== undefined ? String(achievement.actual) : ""
  );
  const [completionDate, setCompletionDate] = useState(
    achievement?.completionDate ? achievement.completionDate.split("T")[0] : ""
  );
  const [status, setStatus] = useState<ProgressStatus>(achievement?.status ?? "NOT_STARTED");

  const isTimeline = goal.uomType === "TIMELINE";
  const isZero = goal.uomType === "ZERO";

  function handleSave() {
    const payload: SavePayload = { status };

    if (!isTimeline) {
      const plannedValue = parseFloat(planned);
      if (!isNaN(plannedValue)) payload.planned = plannedValue;
      const actualValue = parseFloat(actual);
      if (!isNaN(actualValue)) payload.actual = actualValue;
    } else if (completionDate) {
      payload.completionDate = new Date(completionDate);
    }

    onSave(payload);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm space-y-1">
        {isTimeline ? (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Target Deadline</span>
            <span className="font-medium">
              {goal.deadline ? format(new Date(goal.deadline), "dd MMM yyyy") : "-"}
            </span>
          </div>
        ) : (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Target</span>
            <span className="font-medium">
              {goal.target}
              {goal.uomType === "PERCENTAGE" ? "%" : ""}
              {isZero ? " (zero incidents)" : ""}
            </span>
          </div>
        )}
        {(goal.uomType === "NUMERIC" || goal.uomType === "PERCENTAGE") && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Direction</span>
            <span className="font-medium">
              {goal.uomDirection === "MIN" ? "Higher is better" : "Lower is better"}
            </span>
          </div>
        )}
      </div>

      {!isTimeline && (
        <div className="space-y-1.5">
          <Label htmlFor="planned">Planned Achievement</Label>
          <Input
            id="planned"
            type="number"
            placeholder={isZero ? "0" : "Planned for this quarter"}
            value={planned}
            onChange={(e) => setPlanned(e.target.value)}
            min={0}
            max={goal.uomType === "PERCENTAGE" ? 100 : undefined}
          />
        </div>
      )}

      {isTimeline ? (
        <div className="space-y-1.5">
          <Label htmlFor="completionDate">Completion Date</Label>
          <Input
            id="completionDate"
            type="date"
            value={completionDate}
            onChange={(e) => setCompletionDate(e.target.value)}
          />
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="actual">
            {isZero ? "Number of Incidents (actual)" : "Actual Achievement"}
            {goal.uomType === "PERCENTAGE" ? " (0-100%)" : ""}
          </Label>
          <Input
            id="actual"
            type="number"
            placeholder={isZero ? "0" : "Actual for this quarter"}
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            min={0}
            max={
              goal.uomType === "PERCENTAGE"
                ? 100
                : goal.uomType === "ZERO"
                  ? 9999
                  : goal.target > 0
                    ? goal.target * 10
                    : undefined
            }
            step={isZero ? 1 : undefined}
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

      <div className="flex items-center gap-4 pt-1">
        <Button onClick={handleSave} disabled={isPending} className="gap-2">
          {isPending ? "Saving..." : "Save Achievement"}
        </Button>
        {savedScore !== undefined && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Score:</span>
            {savedScore !== null ? (
              <ScoreBadge score={savedScore} />
            ) : (
              <span className="text-xs text-muted-foreground">Not computed yet</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ReadOnlyContent({
  achievement,
  goal,
  sharedNote,
  pendingPrimary,
}: {
  achievement: SerializedAchievement | null;
  goal: GoalData;
  sharedNote?: string;
  pendingPrimary?: boolean;
}) {
  if (!achievement) {
    return (
      <p className={cn("text-sm py-4 text-center", pendingPrimary ? "text-amber-600" : "text-muted-foreground")}>
        {sharedNote ?? "No achievement data for this quarter."}
      </p>
    );
  }

  const isTimeline = goal.uomType === "TIMELINE";

  const rows: { label: string; value: string }[] = [
    ...(!isTimeline
      ? [
          {
            label: "Planned Achievement",
            value:
              achievement.planned !== null
                ? `${achievement.planned}${goal.uomType === "PERCENTAGE" ? "%" : ""}`
                : "-",
          },
        ]
      : []),
    !isTimeline
      ? {
          label: goal.uomType === "ZERO" ? "Incidents (actual)" : "Actual Achievement",
          value:
            achievement.actual !== null
              ? `${achievement.actual}${goal.uomType === "PERCENTAGE" ? "%" : ""}`
              : "-",
        }
      : {
          label: "Completion Date",
          value: achievement.completionDate ? format(new Date(achievement.completionDate), "dd MMM yyyy") : "-",
        },
    { label: "Status", value: STATUS_LABELS[achievement.status] ?? achievement.status },
    { label: "Score", value: achievement.score !== null ? `${achievement.score.toFixed(0)}%` : "-" },
  ];

  return (
    <div className="space-y-3">
      {sharedNote && (
        <p className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded px-3 py-2">
          {sharedNote}
        </p>
      )}
      <dl className="divide-y">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex justify-between py-2.5 text-sm">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium">
              {label === "Score" && achievement.score !== null ? <ScoreBadge score={achievement.score} /> : value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
