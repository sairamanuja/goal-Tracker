"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download } from "lucide-react";
import { format } from "date-fns";

interface AuditEntry {
  id: string;
  createdAt: string;
  employeeName: string;
  goalTitle: string;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  changedBy: string;
}

interface AuditLogClientProps {
  entries: AuditEntry[];
  filters: { search: string; dateFrom: string; dateTo: string; action: string };
  actions: string[];
}

export function AuditLogClient({ entries, filters, actions }: AuditLogClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => router.push(`?${params.toString()}`));
  }

  function exportCSV() {
    const header = ["Timestamp", "Employee", "Goal", "Action", "Field", "Old Value", "New Value", "Changed By"];
    const rows = entries.map((e) => [
      e.createdAt,
      e.employeeName,
      e.goalTitle,
      e.action,
      e.field ?? "",
      e.oldValue ?? "",
      e.newValue ?? "",
      e.changedBy,
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audit-log.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1 flex-1 min-w-[160px]">
          <p className="text-xs text-muted-foreground">Search employee / goal</p>
          <Input
            className="w-full"
            placeholder="Search…"
            defaultValue={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">From</p>
          <Input
            type="date"
            className="w-36"
            defaultValue={filters.dateFrom}
            onChange={(e) => updateFilter("dateFrom", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">To</p>
          <Input
            type="date"
            className="w-36"
            defaultValue={filters.dateTo}
            onChange={(e) => updateFilter("dateTo", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Action type</p>
          <Select
            value={filters.action || "all"}
            onValueChange={(v) => updateFilter("action", v === "all" ? "" : (v ?? ""))}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {actions.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={exportCSV} className="gap-2 sm:ml-auto">
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs min-w-[700px]">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Timestamp</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Employee</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Goal</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Action</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Field</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Old</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">New</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">By</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  No audit entries found.
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                    {format(new Date(entry.createdAt), "dd MMM yy HH:mm")}
                  </td>
                  <td className="px-3 py-2.5">{entry.employeeName}</td>
                  <td className="px-3 py-2.5 max-w-[160px] truncate">{entry.goalTitle}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center rounded border px-1.5 py-0.5 font-mono">
                      {entry.action}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{entry.field ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground max-w-[100px] truncate">{entry.oldValue ?? "—"}</td>
                  <td className="px-3 py-2.5 max-w-[100px] truncate">{entry.newValue ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{entry.changedBy}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
