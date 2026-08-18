import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Auto-checkout: a check-in with no checked_out_at gets one stamped in
 * automatically once it's more than 24h old. "More than 24h ago" and
 * "checked_in_at falls on an earlier calendar date than today" are the same
 * condition in practice — 24h always spans past a date boundary — so this
 * single time-based filter covers both without a separate query.
 *
 * checked_out_at is backfilled to exactly checked_in_at + 24h (not "now"),
 * so the recorded session length is deterministic regardless of when this
 * sweep happens to run.
 *
 * check_ins is shared with the xonefitness-pos-v2 staff app (manual
 * check-in/out) — this sweep catches stale rows from either app, since it
 * runs against the same table. Mirrors xonefitness-pos-v2's
 * src/lib/autoCheckout.ts.
 *
 * Bounded to the last 30 days: the migrated legacy attendance history has
 * many thousands of rows with a genuinely-null checked_out_at going back to
 * 2024 (the source system never recorded a checkout for them either) —
 * without a lower bound those would flood every query (PostgREST caps
 * unbounded selects at 1000 rows, so they'd also starve out real recent
 * rows from ever being seen) and get needlessly rewritten on every request.
 */
export async function autoCheckoutStaleCheckins() {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const windowStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const pageSize = 1000;
  const stale: { id: number; checked_in_at: string }[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from("check_ins")
      .select("id, checked_in_at")
      .is("checked_out_at", null)
      .gte("checked_in_at", windowStart)
      .lt("checked_in_at", cutoff)
      .range(from, from + pageSize - 1);
    if (error || !data) break;
    stale.push(...data);
    if (data.length < pageSize) break;
  }

  if (stale.length === 0) return;

  await Promise.all(
    stale.map((row) => {
      const checkedOutAt = new Date(new Date(row.checked_in_at).getTime() + 24 * 60 * 60 * 1000).toISOString();
      return admin.from("check_ins").update({ checked_out_at: checkedOutAt }).eq("id", row.id);
    }),
  );
}
