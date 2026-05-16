import { PageHeaderSkeleton, TableSkeleton, Skeleton } from "@/components/shared/page-skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <PageHeaderSkeleton />
        <Skeleton className="h-9 w-36" />
      </div>
      <TableSkeleton rows={8} cols={7} />
    </div>
  );
}
