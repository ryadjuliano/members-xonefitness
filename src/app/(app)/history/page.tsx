import { HistoryTabs } from "@/components/history/history-tabs";
import { createClient } from "@/lib/supabase/server";
import { MOCK_RECENT_CHECKINS, MOCK_TRANSACTIONS } from "@/lib/mock-data";

const HAS_SUPABASE = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

async function getHistoryData() {
  if (!HAS_SUPABASE) {
    return { transactions: MOCK_TRANSACTIONS, attendance: MOCK_RECENT_CHECKINS };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: member } = await supabase.from("members").select("id").eq("auth_user_id", user?.id).single();
  if (!member) return { transactions: [], attendance: [] };

  const [{ data: orders }, { data: checkins }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, code, status, grand_total, created_at, order_items(product_name)")
      .eq("member_id", member.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("check_ins")
      .select("id, checked_in_at, checked_out_at")
      .eq("member_id", member.id)
      .order("checked_in_at", { ascending: false })
      .limit(100),
  ]);

  const transactions = (orders ?? []).map((o) => {
    const items = Array.isArray(o.order_items) ? o.order_items : [];
    return {
      id: o.id,
      code: o.code,
      productName: items[0]?.product_name ?? "Pembelian",
      amount: Number(o.grand_total),
      status: o.status,
      createdAt: o.created_at,
    };
  });

  const attendance = (checkins ?? []).map((c) => ({ id: c.id, checkedInAt: c.checked_in_at, checkedOutAt: c.checked_out_at }));

  return { transactions, attendance };
}

export default async function HistoryPage() {
  const { transactions, attendance } = await getHistoryData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Riwayat</h1>
        <p className="mt-1 text-sm text-text-secondary">Transaksi dan kehadiran kamu.</p>
      </div>
      <HistoryTabs transactions={transactions} attendance={attendance} />
    </div>
  );
}
