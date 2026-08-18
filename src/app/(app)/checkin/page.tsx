import { CheckinPanel } from "@/components/checkin/checkin-panel";
import { createClient } from "@/lib/supabase/server";
import { autoCheckoutStaleCheckins } from "@/lib/autoCheckout";

const HAS_SUPABASE = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

async function getTodayStatus() {
  if (!HAS_SUPABASE) return null;

  await autoCheckoutStaleCheckins();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: member } = await supabase.from("members").select("id").eq("auth_user_id", user?.id).single();
  if (!member) return null;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from("check_ins")
    .select("id, checked_in_at, checked_out_at")
    .eq("member_id", member.id)
    .gte("checked_in_at", startOfDay.toISOString())
    .order("checked_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? { id: data.id, checkedInAt: data.checked_in_at, checkedOutAt: data.checked_out_at } : null;
}

export default async function CheckInPage() {
  const status = await getTodayStatus();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Check-In</h1>
        <p className="mt-1 text-sm text-text-secondary">Catat kehadiranmu di gym hari ini.</p>
      </div>
      <CheckinPanel initialStatus={status} />
    </div>
  );
}
