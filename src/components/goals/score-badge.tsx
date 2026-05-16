import { cn } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number | null;
  className?: string;
}

export function ScoreBadge({ score, className }: ScoreBadgeProps) {
  if (score == null) {
    return <span className={cn("text-xs text-muted-foreground", className)}>—</span>;
  }

  const color =
    score >= 80
      ? "text-green-700 bg-green-50 border-green-200"
      : score >= 50
      ? "text-amber-700 bg-amber-50 border-amber-200"
      : "text-red-700 bg-red-50 border-red-200";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-semibold tabular-nums",
        color,
        className
      )}
    >
      {score.toFixed(0)}%
    </span>
  );
}
