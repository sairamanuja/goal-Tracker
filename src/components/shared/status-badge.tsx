import { cn } from "@/lib/utils";
import type { GoalStatus } from "@/generated/prisma";

const config: Record<GoalStatus, { label: string; className: string }> = {
  DRAFT:     { label: "Draft",     className: "bg-gray-100 text-gray-700" },
  SUBMITTED: { label: "Submitted", className: "bg-amber-100 text-amber-700" },
  RETURNED:  { label: "Returned",  className: "bg-rose-100 text-rose-700" },
  APPROVED:  { label: "Approved",  className: "bg-emerald-100 text-emerald-700" },
};

export function StatusBadge({ status, className }: { status: GoalStatus; className?: string }) {
  const { label, className: colorClass } = config[status];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", colorClass, className)}>
      {label}
    </span>
  );
}
