"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  resolveEscalation,
  dismissEscalation,
  toggleEscalationRule,
  updateEscalationRule,
} from "@/actions/escalation-actions";
import { CheckCircle2, XCircle, Pencil, Play } from "lucide-react";
import { format } from "date-fns";

interface RuleRow {
  id: string;
  name: string;
  condition: string;
  daysAfter: number;
  level: number;
  isActive: boolean;
}

interface EscalationRow {
  id: string;
  createdAt: string;
  ruleName: string;
  condition: string;
  level: number;
  targetName: string;
  targetEmail: string;
  quarter: string | null;
  status: string;
}

interface EscalationClientProps {
  rules: RuleRow[];
  escalations: EscalationRow[];
}

const CONDITION_LABELS: Record<string, string> = {
  NOT_SUBMITTED: "Not Submitted",
  NOT_APPROVED: "Not Approved",
  CHECKIN_MISSED: "Check-in Missed",
};

const LEVEL_LABELS: Record<number, string> = {
  1: "L1 — Employee",
  2: "L2 — Manager",
  3: "L3 — HR",
};

export function EscalationClient({ rules, escalations }: EscalationClientProps) {
  const [isPending, startTransition] = useTransition();
  const [runResult, setRunResult] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDays, setEditDays] = useState("");
  const [editName, setEditName] = useState("");

  function handleRunCheck() {
    startTransition(async () => {
      const res = await fetch("/api/admin/run-escalations", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setRunResult(`${data.triggered} escalation(s) triggered`);
        toast.success(`Check complete — ${data.triggered} triggered`);
      } else {
        toast.error(data.error ?? "Check failed");
      }
    });
  }

  function handleToggle(id: string, current: boolean) {
    startTransition(async () => {
      const r = await toggleEscalationRule(id, !current);
      if (!r.success) toast.error(r.error ?? "Failed");
    });
  }

  function startEdit(rule: RuleRow) {
    setEditingId(rule.id);
    setEditDays(String(rule.daysAfter));
    setEditName(rule.name);
  }

  function handleSaveEdit(id: string) {
    startTransition(async () => {
      const r = await updateEscalationRule(id, {
        name: editName,
        daysAfter: parseInt(editDays),
      });
      if (r.success) { toast.success("Rule updated"); setEditingId(null); }
      else toast.error(r.error ?? "Failed");
    });
  }

  function handleResolve(id: string) {
    startTransition(async () => {
      const r = await resolveEscalation(id);
      if (!r.success) toast.error(r.error ?? "Failed");
      else toast.success("Resolved");
    });
  }

  function handleDismiss(id: string) {
    startTransition(async () => {
      const r = await dismissEscalation(id);
      if (!r.success) toast.error(r.error ?? "Failed");
      else toast.success("Dismissed");
    });
  }

  return (
    <div className="space-y-4">
      {/* Run button */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleRunCheck} disabled={isPending} className="gap-2">
          <Play className="w-4 h-4" />
          {isPending ? "Running…" : "Run Escalation Check Now"}
        </Button>
        {runResult && <span className="text-sm text-muted-foreground">{runResult}</span>}
      </div>

      <Tabs defaultValue="rules">
        <div className="overflow-x-auto">
          <TabsList variant="line" className="min-w-max">
            <TabsTrigger value="rules">Rules ({rules.length})</TabsTrigger>
            <TabsTrigger value="log">
              Log ({escalations.filter((e) => e.status === "OPEN").length} open)
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Rules tab */}
        <TabsContent value="rules">
          <Card className="mt-4">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Rule</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Condition</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Level</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Days After</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">Active</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rules.map((rule) => (
                      <tr key={rule.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3">
                          {editingId === rule.id ? (
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="h-7 text-sm"
                            />
                          ) : (
                            <span>{rule.name}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {CONDITION_LABELS[rule.condition] ?? rule.condition}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {LEVEL_LABELS[rule.level] ?? `L${rule.level}`}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {editingId === rule.id ? (
                            <Input
                              type="number"
                              value={editDays}
                              onChange={(e) => setEditDays(e.target.value)}
                              className="h-7 text-sm w-20 ml-auto"
                            />
                          ) : (
                            <span className="tabular-nums">{rule.daysAfter}d</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleToggle(rule.id, rule.isActive)}
                            disabled={isPending}
                            title={rule.isActive ? "Deactivate" : "Activate"}
                          >
                            {rule.isActive ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" />
                            ) : (
                              <XCircle className="w-4 h-4 text-muted-foreground mx-auto" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {editingId === rule.id ? (
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" onClick={() => handleSaveEdit(rule.id)} disabled={isPending}>Save</Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEdit(rule)}
                              className="gap-1"
                            >
                              <Pencil className="w-3.5 h-3.5" /> Edit
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Log tab */}
        <TabsContent value="log">
          <Card className="mt-4">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Timestamp</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Rule</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Employee</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Level</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Quarter</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {escalations.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                          No escalations recorded. Run the check to detect violations.
                        </td>
                      </tr>
                    ) : (
                      escalations.map((esc) => (
                        <tr key={esc.id} className="hover:bg-muted/20">
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {format(new Date(esc.createdAt), "dd MMM yy HH:mm")}
                          </td>
                          <td className="px-4 py-3">{esc.ruleName}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium">{esc.targetName}</p>
                            <p className="text-xs text-muted-foreground">{esc.targetEmail}</p>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {LEVEL_LABELS[esc.level] ?? `L${esc.level}`}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{esc.quarter ?? "—"}</td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={
                                esc.status === "OPEN"
                                  ? "destructive"
                                  : esc.status === "RESOLVED"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {esc.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {esc.status === "OPEN" && (
                              <div className="flex gap-1 justify-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleResolve(esc.id)}
                                  disabled={isPending}
                                >
                                  Resolve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDismiss(esc.id)}
                                  disabled={isPending}
                                >
                                  Dismiss
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
