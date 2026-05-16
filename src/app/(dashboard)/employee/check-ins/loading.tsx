import { PageHeaderSkeleton, CardSkeleton } from "@/components/shared/page-skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <CardSkeleton rows={4} />
      <CardSkeleton rows={4} />
    </div>
  );
}
