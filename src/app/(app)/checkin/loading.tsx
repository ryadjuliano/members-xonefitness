import { Skeleton } from "@/components/ui/skeleton";

export default function CheckInLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="aspect-square w-full rounded-lg" />
    </div>
  );
}
