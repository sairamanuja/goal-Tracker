"use client";

import { cn } from "@/lib/utils";

interface WeightageBarProps {
  goals: { title: string; weightage: number }[];
  showLabels?: boolean;
}

const COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-fuchsia-500",
  "bg-lime-500",
];

export function WeightageBar({ goals, showLabels = true }: WeightageBarProps) {
  const total = goals.reduce((s, g) => s + g.weightage, 0);
  const remaining = 100 - total;
  const isComplete = Math.round(total) === 100;
  const isOver = total > 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Weightage Distribution</span>
        <span
          className={cn(
            "font-semibold tabular-nums",
            isComplete ? "text-green-600" : isOver ? "text-destructive" : "text-amber-600"
          )}
        >
          Total: {total.toFixed(0)}%
          {!isComplete && !isOver && (
            <span className="font-normal text-muted-foreground ml-1">
              ({remaining.toFixed(0)}% remaining)
            </span>
          )}
          {isOver && (
            <span className="font-normal text-destructive ml-1">
              ({Math.abs(remaining).toFixed(0)}% over)
            </span>
          )}
        </span>
      </div>

      <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex">
        {goals.map((g, i) => (
          <div
            key={i}
            className={cn("h-full transition-all", COLORS[i % COLORS.length])}
            style={{ width: `${Math.min((g.weightage / 100) * 100, 100)}%` }}
            title={`${g.title}: ${g.weightage}%`}
          />
        ))}
      </div>

      {showLabels && goals.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {goals.map((g, i) => (
            <div key={i} className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className={cn("inline-block w-2 h-2 rounded-full", COLORS[i % COLORS.length])} />
              <span className="truncate max-w-[120px]">{g.title}</span>
              <span className="font-medium">{g.weightage}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
