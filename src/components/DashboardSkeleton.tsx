import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const StatsSkeleton = () => (
  <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
    {[1, 2, 3].map(i => (
      <Card key={i} className="border bg-card shadow-sm">
        <CardContent className="flex items-center gap-4 p-5">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

export const PieChartSkeleton = () => (
  <Card className="border shadow-sm">
    <CardHeader className="pb-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="ml-auto h-6 w-16 rounded-full" />
      </div>
    </CardHeader>
    <CardContent>
      <div className="flex justify-center py-4">
        <Skeleton className="h-[200px] w-[200px] rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-2 mt-4">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-1.5">
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

export const ListCardSkeleton = ({ title }: { title?: string }) => (
  <Card className="border shadow-sm">
    <CardHeader className="pb-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-5 w-36" />
      </div>
    </CardHeader>
    <CardContent className="space-y-2">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      ))}
    </CardContent>
  </Card>
);

export const GalleryCardsSkeleton = ({ count = 6 }: { count?: number }) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: count }).map((_, i) => (
      <Card key={i} className="border">
        <CardContent className="flex items-center justify-between p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-5 w-5" />
        </CardContent>
      </Card>
    ))}
  </div>
);
