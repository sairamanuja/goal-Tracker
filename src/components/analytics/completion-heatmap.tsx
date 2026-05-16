import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type DeptHeatmapRow = {
  department: string;
  total: number;
  goalsSet: number;
  submitted: number;
  approved: number;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
};

const COLUMNS = [
  { key: "goalsSet" as const, label: "Goals Set" },
  { key: "submitted" as const, label: "Submitted" },
  { key: "approved" as const, label: "Approved" },
  { key: "q1" as const, label: "Q1" },
  { key: "q2" as const, label: "Q2" },
  { key: "q3" as const, label: "Q3" },
  { key: "q4" as const, label: "Q4" },
];

function cellClass(pct: number) {
  if (pct >= 80) return "bg-green-100 text-green-800";
  if (pct >= 50) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-700";
}

export function CompletionHeatmap({ data }: { data: DeptHeatmapRow[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground text-sm">
          No department data available.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Completion Heatmap by Department</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Green ≥80% · Amber 50–79% · Red &lt;50%
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left py-2 pr-6 font-medium text-muted-foreground">
                Department
              </th>
              <th className="text-center py-2 px-2 font-medium text-muted-foreground text-xs">
                Employees
              </th>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className="text-center py-2 px-2 font-medium text-muted-foreground whitespace-nowrap text-xs"
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.department} className="border-t">
                <td className="py-2.5 pr-6 font-medium">{row.department}</td>
                <td className="text-center py-2.5 px-2 text-muted-foreground text-sm">
                  {row.total}
                </td>
                {COLUMNS.map((c) => {
                  const count = row[c.key];
                  const pct =
                    row.total > 0
                      ? Math.round((count / row.total) * 100)
                      : 0;
                  return (
                    <td key={c.key} className="py-2.5 px-2 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cellClass(pct)}`}
                      >
                        {count}/{row.total} ({pct}%)
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
