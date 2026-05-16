import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CycleRow, CreateCycleButton } from "@/components/admin/cycle-actions";
import { format } from "date-fns";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  ACTIVE: "default",
  DRAFT: "secondary",
  CLOSED: "outline",
};

import type { Metadata } from "next";
export const metadata: Metadata = { title: "Goal Cycles" };

export default async function AdminCyclesPage() {
  await requireAdmin();

  const cycles = await prisma.goalCycle.findMany({ orderBy: { year: "desc" } });

  const serialized = cycles.map((c) => ({
    id: c.id,
    name: c.name,
    year: c.year,
    status: c.status,
    forceOpenQuarter: c.forceOpenQuarter,
    goalSettingOpen: c.goalSettingOpen.toISOString(),
    goalSettingClose: c.goalSettingClose.toISOString(),
    q1Open: c.q1Open.toISOString(),
    q1Close: c.q1Close.toISOString(),
    q2Open: c.q2Open.toISOString(),
    q2Close: c.q2Close.toISOString(),
    q3Open: c.q3Open.toISOString(),
    q3Close: c.q3Close.toISOString(),
    q4Open: c.q4Open.toISOString(),
    q4Close: c.q4Close.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Goal Cycles</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage performance cycles and quarter windows</p>
        </div>
        <CreateCycleButton />
      </div>

      {cycles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">No cycles created yet.</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {serialized.map((cycle) => (
            <Card key={cycle.id} className={cycle.status === "ACTIVE" ? "border-primary/40" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{cycle.name}</CardTitle>
                      <Badge variant={STATUS_VARIANT[cycle.status] ?? "outline"}>
                        {cycle.status}
                      </Badge>
                      {cycle.forceOpenQuarter && (
                        <Badge variant="secondary" className="text-amber-700 bg-amber-50 border-amber-200 border">
                          Force: {cycle.forceOpenQuarter}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">FY {cycle.year}</p>
                  </div>
                  <CycleRow cycle={cycle} />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                  {[
                    { label: "Goal Setting", open: cycle.goalSettingOpen, close: cycle.goalSettingClose },
                    { label: "Q1", open: cycle.q1Open, close: cycle.q1Close },
                    { label: "Q2", open: cycle.q2Open, close: cycle.q2Close },
                    { label: "Q3", open: cycle.q3Open, close: cycle.q3Close },
                    { label: "Q4", open: cycle.q4Open, close: cycle.q4Close },
                  ].map(({ label, open, close }) => (
                    <div key={label} className="rounded border px-2.5 py-2 bg-muted/20">
                      <p className="font-medium text-muted-foreground mb-1">{label}</p>
                      <p>{format(new Date(open), "dd MMM yy")}</p>
                      <p className="text-muted-foreground">→ {format(new Date(close), "dd MMM yy")}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
