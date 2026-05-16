import { PageHeaderSkeleton, CardSkeleton, Skeleton, TableSkeleton } from "@/components/shared/page-skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <PageHeaderSkeleton />
        <Skeleton className="h-9 w-28" />
      </div>
      <CardSkeleton rows={1} />
      <TableSkeleton rows={4} cols={5} />
    </div>
  );
}
