import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icon";

export function ProfileMenuItem({ href, icon, label }: { href: string; icon: IconName; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 border-b border-gray-200 p-3 last:border-b-0">
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-background-elevated">
        <Icon name={icon} size={16} className="text-text-secondary" />
      </span>
      <span className="flex-1 text-sm font-medium">{label}</span>
      <Icon name="chevron-right" size={14} className="text-text-tertiary" />
    </Link>
  );
}
