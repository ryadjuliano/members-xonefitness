import Image from "next/image";
import { cn } from "@/lib/utils";

export function Avatar({
  name,
  photoUrl,
  size = 40,
  className,
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt={name}
        width={size}
        height={size}
        className={cn("rounded-full border-2 border-primary/40 object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className={cn("flex items-center justify-center rounded-full border-2 border-primary/40 bg-primary/15 font-bold text-primary", className)}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initial}
    </span>
  );
}
