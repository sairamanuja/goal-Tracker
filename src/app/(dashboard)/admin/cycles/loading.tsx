import { PageHeaderSkeleton, CardSkeleton, Skeleton } from "@/components/shared/page-skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <PageHeaderSkeleton />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="space-y-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}
