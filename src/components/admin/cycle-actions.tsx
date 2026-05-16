"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { activateCycle, closeCycle, forceOpenQuarter } from "@/actions/admin-actions";
import { CycleFormDialog } from "@/components/admin/cycle-form-dialog";
import type { Quarter } from "@/generated/prisma";
import { Pencil, Play, XCircle } from "lucide-react";

interface CycleData {
  id: string;
  name: string;
  year: number;
  status: string;
  forceOpenQuarter: string | null;
  goalSettingOpen: string;
  goalSettingClose: string;
  q1Open: string;
  q1Close: string;
  q2Open: string;
  q2Close: string;
  q3Open: string;
  q3Close: string;
  q4Open: string;
  q4Close: string;
}

export function CycleRow({ cycle }: { cycle: CycleData }) {
  const [editOpen, setEditOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleActivate() {
    startTransition(async () => {
      const r = await activateCycle(cycle.id);
      if (r.success) toast.success("Cycle activated");
      else toast.error(r.error ?? "Failed");
    });
  }

  function handleClose() {
    startTransition(async () => {
      const r = await closeCycle(cycle.id);
      if (r.success) toast.success("Cycle closed");
      else toast.error(r.error ?? "Failed");
    });
  }

  function handleForceQuarter(val: string) {
    startTransition(async () => {
      const quarter = val === "none" ? null : (val as Quarter);
      const r = await forceOpenQuarter(cycle.id, quarter);
      if (r.success) toast.success(quarter ? `Forced ${quarter} open` : "Force override cleared");
      else toast.error(r.error ?? "Failed");
    });
  }

  const isActive = cycle.status === "ACTIVE";

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-1">
          <Pencil className="w-3.5 h-3.5" /> Edit
        </Button>
        {cycle.status === "DRAFT" && (
          <Button size="sm" onClick={handleActivate} disabled={isPending} className="gap-1">
            <Play className="w-3.5 h-3.5" /> Activate
          </Button>
        )}
        {isActive && (
          <Button variant="destructive" size="sm" onClick={handleClose} disabled={isPending} className="gap-1">
            <XCircle className="w-3.5 h-3.5" /> Close
          </Button>
        )}
        {isActive && (
          <div className="flex items-center gap-1.5 ml-1">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Force Q:</span>
            <Select
              value={cycle.forceOpenQuarter ?? "none"}
              onValueChange={(v) => handleForceQuarter(v ?? "none")}
            >
              <SelectTrigger className="h-8 text-xs w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {(["Q1", "Q2", "Q3", "Q4"] as Quarter[]).map((q) => (
                  <SelectItem key={q} value={q}>{q}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <CycleFormDialog open={editOpen} onOpenChange={setEditOpen} existing={cycle} />
    </>
  );
}

export function CreateCycleButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2">
        Create Cycle
      </Button>
      <CycleFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
