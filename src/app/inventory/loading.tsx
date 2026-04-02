
import { Skeleton } from "@/components/ui/skeleton";

export default function InventoryLoading() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-96 mt-2" />
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4">
        <Skeleton className="h-10 w-full md:w-96" />
        <Skeleton className="h-8 w-32" />
      </div>

      <div className="space-y-2 border rounded-sm">
        <Skeleton className="h-12 w-full bg-muted/50" />
        {[1, 2, 3, 4, 5, 6].map(i => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}
