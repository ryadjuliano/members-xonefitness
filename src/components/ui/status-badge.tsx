import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<string, string> = {
  paid: "bg-success/20 text-success",
  active: "bg-success/20 text-success",
  approved: "bg-success/20 text-success",
  pending: "bg-warning/20 text-warning",
  uploaded: "bg-info/20 text-info",
  cancelled: "bg-error/20 text-error",
  rejected: "bg-error/20 text-error",
  inactive: "bg-gray-300/40 text-text-tertiary",
};

const STATUS_LABEL: Record<string, string> = {
  paid: "Lunas",
  pending: "Menunggu",
  cancelled: "Dibatalkan",
  active: "Aktif",
  inactive: "Nonaktif",
  approved: "Disetujui",
  rejected: "Ditolak",
  uploaded: "Terupload",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const key = status.toLowerCase();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        STATUS_STYLE[key] ?? "bg-gray-300/40 text-text-secondary",
        className,
      )}
    >
      {STATUS_LABEL[key] ?? status}
    </span>
  );
}
