import { PageHeaderSkeleton, StatCardSkeleton, CardSkeleton } from "@/components/shared/page-skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <CardSkeleton rows={6} />
        <CardSkeleton rows={6} />
      </div>
    </div>
  );
}
