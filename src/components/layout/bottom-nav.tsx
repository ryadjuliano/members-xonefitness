"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

const TABS: { href: string; label: string; outline: IconName; filled: IconName }[] = [
  { href: "/home", label: "Beranda", outline: "home-outline", filled: "home-filled" },
  { href: "/checkin", label: "Scan", outline: "camera-outline", filled: "camera-filled" },
  { href: "/history", label: "Riwayat", outline: "clock-outline", filled: "clock-filled" },
  { href: "/profile", label: "Profil", outline: "person-outline", filled: "person-filled" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="glass-tab-bar shadow-glow fixed right-4 bottom-6 left-4 z-40 mx-auto flex max-w-[448px] items-center justify-around rounded-full px-2 py-2">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex flex-1 flex-col items-center gap-1 py-1"
            aria-current={isActive ? "page" : undefined}
          >
            <span
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                isActive && "bg-primary",
              )}
            >
              <Icon
                name={isActive ? tab.filled : tab.outline}
                className={isActive ? "text-text-on-primary" : "text-text-secondary"}
                size={20}
              />
            </span>
            <span className={cn("text-xs whitespace-nowrap", isActive ? "font-semibold text-primary" : "text-text-tertiary")}>
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
