import { requireEmployee } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { MessageSquare } from "lucide-react";

import type { Metadata } from "next";
export const metadata: Metadata = { title: "Check-ins" };

export default async function EmployeeCheckInsPage() {
  const session = await requireEmployee();
  const userId = session.user.userId;

  const checkIns = await prisma.checkIn.findMany({
    where: { employeeId: userId },
    orderBy: [{ cycle: { year: "desc" } }, { quarter: "asc" }, { createdAt: "desc" }],
    include: {
      manager: { select: { name: true } },
      cycle: { select: { name: true } },
    },
  });

  const grouped = checkIns.reduce<Record<string, typeof checkIns>>((acc, c) => {
    if (!acc[c.quarter]) acc[c.quarter] = [];
    acc[c.quarter].push(c);
    return acc;
  }, {});

  const quarters = Object.keys(grouped).sort();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Check-ins</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Feedback from your manager across quarters
        </p>
      </div>

      {checkIns.length === 0 ? (
        <div className="rounded-lg border px-4 py-12 text-center text-muted-foreground text-sm">
          <MessageSquare className="mx-auto mb-3 w-8 h-8 opacity-30" />
          No check-ins yet. Your manager&apos;s feedback will appear here.
        </div>
      ) : (
        <div className="space-y-6">
          {quarters.map((q) => (
            <div key={q}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">{q}</h2>
              <div className="space-y-3">
                {grouped[q].map((c) => (
                  <Card key={c.id}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{c.manager.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(c.updatedAt), "dd MMM yyyy")}
                        </span>
                      </div>
                      <p className="text-xs text-primary mb-2">{c.cycle.name}</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{c.comment}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
