import { Icon } from "@/components/ui/icon";
import { formatDate } from "@/lib/utils";

function barcodeBars(seed: string) {
  const bars: number[] = [];
  for (const char of seed) {
    bars.push((char.charCodeAt(0) % 4) + 1);
  }
  return bars;
}

export function MemberDigitalCard({
  name,
  memberCode,
  planName,
  memberSince,
  validUntil,
}: {
  name: string;
  memberCode: string;
  planName: string | null;
  memberSince: string | null;
  validUntil: string | null;
}) {
  const bars = barcodeBars(memberCode);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-card-highlight p-5 shadow-glow">
      <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-primary/8" />

      <div className="relative z-10 mb-6 flex items-center justify-between gap-2">
        <div className="flex shrink-0 items-center gap-2">
          <Icon name="dumbbell" size={18} className="text-primary" />
          <span className="text-sm font-bold tracking-wide whitespace-nowrap">X ONE FITNESS</span>
        </div>
        {planName && (
          <span className="min-w-0 truncate rounded-full border border-primary/40 px-3 py-1 text-[11px] font-semibold text-primary">
            {planName}
          </span>
        )}
      </div>

      <p className="relative z-10 truncate text-xl font-bold">{name}</p>
      <p className="relative z-10 mt-1 text-xs whitespace-nowrap text-text-secondary">
        Anggota sejak {formatDate(memberSince)}
      </p>

      <div className="relative z-10 my-5 flex h-8 items-end gap-[3px]">
        {bars.map((h, i) => (
          <span key={i} className="bg-primary/60" style={{ width: 2, height: `${h * 8}px` }} />
        ))}
      </div>

      <div className="relative z-10 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] whitespace-nowrap text-text-tertiary uppercase tracking-wider">Nomor Anggota</p>
          <p className="truncate text-sm font-semibold">{memberCode}</p>
        </div>
        <div className="min-w-0 shrink-0 text-right">
          <p className="text-[10px] whitespace-nowrap text-text-tertiary uppercase tracking-wider">Berlaku Hingga</p>
          <p className="truncate text-sm font-semibold whitespace-nowrap">{formatDate(validUntil)}</p>
        </div>
      </div>
    </div>
  );
}
