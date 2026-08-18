import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { cn, formatIDR } from "@/lib/utils";

export function PackageGridCard({
  id,
  name,
  price,
  lifetime,
  highlighted,
}: {
  id: number;
  name: string;
  price: number;
  lifetime: string | null;
  highlighted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border shadow-card",
        highlighted ? "border-primary bg-card-highlight" : "border-gray-200 bg-background-card",
      )}
    >
      <div className="flex h-[90px] items-center justify-center bg-primary/10">
        <Icon name="dumbbell" size={32} className="text-primary" />
      </div>
      <div className="flex flex-1 flex-col p-3">
        {highlighted && (
          <span className="mb-2 inline-flex w-fit items-center gap-1 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap text-primary">
            <Icon name="crown" size={10} /> POPULER
          </span>
        )}
        {lifetime && <p className="text-xs font-semibold whitespace-nowrap text-primary">{lifetime}</p>}
        <p className="mt-1 line-clamp-2 flex-1 text-sm font-bold">{name}</p>
        <p className="mt-2 truncate text-base font-extrabold">{formatIDR(price)}</p>
        <Link
          href={`/home/membership/order-summary?productId=${id}`}
          className="mt-3 flex h-9 w-full items-center justify-center rounded-full bg-primary text-sm font-semibold text-text-on-primary"
        >
          Pilih
        </Link>
      </div>
    </div>
  );
}
