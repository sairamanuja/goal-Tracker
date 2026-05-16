"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { submitCheckIn } from "@/actions/check-in-actions";
import type { Quarter } from "@/generated/prisma";
import { Pencil, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

interface CheckInFormProps {
  employeeId: string;
  quarter: Quarter;
  existingComment: string | null;
  existingUpdatedAt: string | null;
}

export function CheckInForm({
  employeeId,
  quarter,
  existingComment,
  existingUpdatedAt,
}: CheckInFormProps) {
  const [editing, setEditing] = useState(!existingComment);
  const [comment, setComment] = useState(existingComment ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await submitCheckIn({ employeeId, quarter, comment });
      if (result.success) {
        toast.success("Check-in saved");
        setEditing(false);
      } else {
        toast.error(result.error ?? "Save failed");
      }
    });
  }

  if (!editing && existingComment) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border bg-muted/30 px-4 py-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 text-sm font-medium text-green-700">
              <CheckCircle2 className="w-4 h-4" />
              Check-in submitted
            </div>
            {existingUpdatedAt && (
              <span className="text-xs text-muted-foreground">
                {format(new Date(existingUpdatedAt), "dd MMM yyyy, HH:mm")}
              </span>
            )}
          </div>
          <p className="text-sm whitespace-pre-wrap">{existingComment}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-2">
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="check-in-comment">
          Discussion Notes
          <span className="ml-1 text-muted-foreground font-normal text-xs">(min 20 characters)</span>
        </Label>
        <Textarea
          id="check-in-comment"
          placeholder="Summarize the discussion: progress, blockers, action items..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="min-h-28"
        />
        <p className="text-xs text-muted-foreground text-right">
          {comment.trim().length} / 20 min
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          onClick={handleSave}
          disabled={isPending || comment.trim().length < 20}
        >
          {isPending ? "Saving…" : "Submit Check-in"}
        </Button>
        {existingComment && (
          <Button variant="outline" onClick={() => { setComment(existingComment); setEditing(false); }}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
