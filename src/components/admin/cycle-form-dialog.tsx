"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { createCycle, updateCycle, type CycleFormData } from "@/actions/admin-actions";

interface CycleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: {
    id: string;
    name: string;
    year: number;
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
  } | null;
}

const DATE_FIELDS: { key: keyof CycleFormData; label: string }[] = [
  { key: "goalSettingOpen", label: "Goal Setting Open" },
  { key: "goalSettingClose", label: "Goal Setting Close" },
  { key: "q1Open", label: "Q1 Open" },
  { key: "q1Close", label: "Q1 Close" },
  { key: "q2Open", label: "Q2 Open" },
  { key: "q2Close", label: "Q2 Close" },
  { key: "q3Open", label: "Q3 Open" },
  { key: "q3Close", label: "Q3 Close" },
  { key: "q4Open", label: "Q4 Open" },
  { key: "q4Close", label: "Q4 Close" },
];

function toDateInput(iso: string) {
  return iso ? iso.split("T")[0] : "";
}

export function CycleFormDialog({ open, onOpenChange, existing }: CycleDialogProps) {
  const isEdit = !!existing;
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(existing?.name ?? "");
  const [year, setYear] = useState(String(existing?.year ?? new Date().getFullYear()));
  const [dates, setDates] = useState<Record<string, string>>(() => {
    if (existing) {
      return Object.fromEntries(
        DATE_FIELDS.map(({ key }) => [key, toDateInput((existing as unknown as Record<string, string>)[key])])
      );
    }
    return Object.fromEntries(DATE_FIELDS.map(({ key }) => [key, ""]));
  });

  function handleSubmit() {
    startTransition(async () => {
      const payload: CycleFormData = {
        name,
        year: parseInt(year),
        ...(dates as Omit<CycleFormData, "name" | "year">),
      };
      const result = isEdit
        ? await updateCycle(existing!.id, payload)
        : await createCycle(payload);

      if (result.success) {
        toast.success(isEdit ? "Cycle updated" : "Cycle created");
        onOpenChange(false);
      } else {
        toast.error(result.error ?? "Failed");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Cycle" : "Create New Cycle"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="cycle-name">Cycle Name</Label>
              <Input
                id="cycle-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="FY 2026-27"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cycle-year">Year</Label>
              <Input
                id="cycle-year"
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {DATE_FIELDS.map(({ key, label }) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`cycle-${key}`}>{label}</Label>
                <Input
                  id={`cycle-${key}`}
                  type="date"
                  value={dates[key]}
                  onChange={(e) => setDates((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </div>

        <DialogFooter showCloseButton>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Saving…" : isEdit ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
