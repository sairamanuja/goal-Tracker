"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { syncOrgFromEntraId } from "@/actions/admin-actions";
import { RefreshCw } from "lucide-react";

export function SyncEntraButton() {
  const [isPending, startTransition] = useTransition();
  const [lastResult, setLastResult] = useState<string | null>(null);

  function handleSync() {
    startTransition(async () => {
      const result = await syncOrgFromEntraId();
      if (result.success) {
        const msg = `Synced ${result.synced} users from Entra ID`;
        toast.success(msg);
        setLastResult(msg);
      } else {
        toast.error(result.error ?? "Sync failed");
        setLastResult(null);
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" onClick={handleSync} disabled={isPending} className="gap-2">
        <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
        {isPending ? "Syncing…" : "Sync from Entra ID"}
      </Button>
      {lastResult && (
        <span className="text-xs text-green-700">{lastResult}</span>
      )}
    </div>
  );
}
