import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { ProfileMenuItem } from "@/components/profile/profile-menu-item";
import { createClient } from "@/lib/supabase/server";
import { formatDate, relativeTime } from "@/lib/utils";
import { MOCK_CHECKIN_STATS, MOCK_MEMBER, MOCK_RECENT_CHECKINS } from "@/lib/mock-data";
import { autoCheckoutStaleCheckins } from "@/lib/autoCheckout";

const HAS_SUPABASE = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

function daysUntil(dateString: string) {
  return Math.ceil((new Date(dateString).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 11) return "Selamat Pagi";
  if (hour < 15) return "Selamat Siang";
  if (hour < 18) return "Selamat Sore";
  return "Selamat Malam";
}

async function getHomeData() {
  if (!HAS_SUPABASE) {
    return {
      member: { name: MOCK_MEMBER.name, photoUrl: MOCK_MEMBER.photoUrl, endDate: MOCK_MEMBER.endDate },
      planName: MOCK_MEMBER.planName,
      stats: MOCK_CHECKIN_STATS,
      recentCheckins: MOCK_RECENT_CHECKINS,
    };
  }

  await autoCheckoutStaleCheckins();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: member } = await supabase
    .from("members")
    .select("id, name, photo_url, end_date")
    .eq("auth_user_id", user?.id)
    .single();

  if (!member) {
    return {
      member: { name: "Member", photoUrl: null, endDate: null },
      planName: null,
      stats: { visitsThisMonth: 0, totalVisits: 0, avgSessionMinutes: 0 },
      recentCheckins: [],
    };
  }

  const [{ data: lastOrderItem }, { data: checkins }] = await Promise.all([
    supabase
      .from("orders")
      .select("order_items(product_name)")
      .eq("member_id", member.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("check_ins")
      .select("id, checked_in_at, checked_out_at")
      .eq("member_id", member.id)
      .order("checked_in_at", { ascending: false })
      .limit(200),
  ]);

  const allCheckins = checkins ?? [];
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const visitsThisMonth = allCheckins.filter((c) => new Date(c.checked_in_at) >= startOfMonth).length;
  const withDuration = allCheckins.filter((c) => c.checked_out_at);
  const avgSessionMinutes = withDuration.length
    ? Math.round(
        withDuration.reduce(
          (sum, c) => sum + (new Date(c.checked_out_at!).getTime() - new Date(c.checked_in_at).getTime()) / 60000,
          0,
        ) / withDuration.length,
      )
    : 0;

  const orderItems = lastOrderItem?.order_items;
  const planName = Array.isArray(orderItems) ? orderItems[0]?.product_name : null;

  return {
    member: { name: member.name, photoUrl: member.photo_url, endDate: member.end_date },
    planName: planName ?? null,
    stats: { visitsThisMonth, totalVisits: allCheckins.length, avgSessionMinutes },
    recentCheckins: allCheckins
      .slice(0, 5)
      .map((c) => ({ id: c.id, checkedInAt: c.checked_in_at, checkedOutAt: c.checked_out_at })),
  };
}

export default async function HomePage() {
  const { member, planName, stats, recentCheckins } = await getHomeData();

  const daysRemaining = member.endDate ? daysUntil(member.endDate) : null;
  const isExpired = daysRemaining !== null && daysRemaining < 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-text-secondary">{greeting()},</p>
          <h1 className="text-xl font-bold">{member.name}</h1>
        </div>
        <Link href="/profile">
          <Avatar name={member.name} photoUrl={member.photoUrl} size={44} />
        </Link>
      </div>

      <Card highlight className="relative overflow-hidden p-5 shadow-glow">
        <div className="mb-3 flex items-center gap-2">
          <Icon name="crown" size={16} className="text-primary" />
          <span className="text-sm font-medium text-text-secondary">{planName ?? "Belum ada paket aktif"}</span>
        </div>
        {daysRemaining !== null ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-extrabold text-primary">{Math.max(daysRemaining, 0)}</span>
              <span className="text-sm text-text-secondary">hari tersisa</span>
            </div>
            <p className="mt-1 text-sm text-text-secondary">
              {isExpired ? "Berakhir pada" : "Berlaku hingga"} {formatDate(member.endDate)}
            </p>
          </>
        ) : (
          <p className="text-sm text-text-secondary">Kamu belum memiliki paket membership aktif.</p>
        )}
        <Link
          href="/home/membership"
          className="mt-4 inline-flex h-10 w-full items-center justify-center whitespace-nowrap rounded-full bg-primary text-sm font-semibold text-text-on-primary"
        >
          {isExpired || daysRemaining === null ? "Beli Paket" : "Perpanjang"}
        </Link>
      </Card>

      <Card className="overflow-hidden">
        <ProfileMenuItem href="/home/membership" icon="bag" label="Beli Paket" />
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <StatTile icon="fire" value={stats.visitsThisMonth} label="Bulan ini" />
        <StatTile icon="dumbbell" value={stats.totalVisits} label="Total visit" />
        <StatTile icon="clock-outline" value={`${stats.avgSessionMinutes}m`} label="Rata-rata" />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Aktivitas Terbaru</h2>
          <Link href="/history" className="text-sm text-primary">
            Lihat semua
          </Link>
        </div>
        <div className="space-y-2">
          {recentCheckins.length === 0 && (
            <p className="rounded-lg border border-gray-200 bg-background-card p-4 text-center text-sm text-text-secondary">
              Belum ada aktivitas check-in.
            </p>
          )}
          {recentCheckins.map((c) => (
            <Card key={c.id} className="flex items-center gap-3 p-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Icon name="dumbbell" size={16} className="text-primary" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium">Gym Visit</p>
                <p className="text-xs text-text-tertiary">{formatDate(c.checkedInAt)}</p>
              </div>
              <span className="text-xs text-text-secondary">{relativeTime(c.checkedInAt)}</span>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatTile({ icon, value, label }: { icon: "fire" | "dumbbell" | "clock-outline"; value: number | string; label: string }) {
  return (
    <Card className="flex min-w-0 flex-col items-center gap-1.5 p-3 text-center">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Icon name={icon} size={16} className="text-primary" />
      </span>
      <span className="max-w-full truncate text-lg font-bold">{value}</span>
      <span className="max-w-full truncate text-[11px] whitespace-nowrap text-text-tertiary">{label}</span>
    </Card>
  );
}
