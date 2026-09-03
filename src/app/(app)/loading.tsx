import { CardSkeleton, Skeleton } from '@/components/ui/misc';

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-3 h-8 w-64" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <div className="card p-5">
        <Skeleton className="h-4 w-48" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
