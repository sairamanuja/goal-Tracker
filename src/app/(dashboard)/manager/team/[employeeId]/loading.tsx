import { PageHeaderSkeleton, TableSkeleton, Skeleton } from "@/components/shared/page-skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-20" />
        <PageHeaderSkeleton />
      </div>
      <Skeleton className="h-3 w-full rounded-full" />
      <TableSkeleton rows={5} cols={6} />
    </div>
  );
}
