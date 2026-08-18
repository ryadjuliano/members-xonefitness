// One-off repair for damage caused by a bug in the original
// migrate-mysql-to-supabase.mjs run (see that file's updated comments):
//
//   1. The on_auth_member_created trigger fired for every admin-created auth
//      user (metadata role was "member", same value the trigger matches for
//      self-registration), inserting a bogus blank-phone `members` row on
//      the very first call and then failing every subsequent
//      auth.admin.createUser() call with a unique-constraint violation on
//      members.phone. Net effect: almost no migrated member ever got a
//      working Supabase Auth account, and the one customer whose call did
//      succeed (id 21, "Billy Sinurat") lost their real members row
//      entirely (the follow-up insert with their real data collided with
//      the trigger's row on the auth_user_id unique constraint).
//   2. members.phone is unique, and the legacy MySQL data has genuine
//      duplicate phone numbers (shared/mistyped numbers) — every customer
//      whose raw phone string had already been used by an earlier customer
//      failed to insert at all, silently dropping their profile *and* all
//      of their orders/payments/check-ins (filtered out downstream via
//      memberIdMap.has(...)).
//
// This script is idempotent — safe to re-run:
//   - Step 1 only inserts members whose member_code doesn't already exist.
//   - Step 2 only inserts orders/payments/check-ins for member ids it just
//     created in step 1 (skips entirely if there's nothing new).
//   - Step 3 only creates an auth account for members that don't have one.
//
// Run: node scripts/backfill-migration-gaps.mjs

import { existsSync, readFileSync } from "node:fs";
import mysql from "mysql2/promise";
import { createClient } from "@supabase/supabase-js";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env(.local).");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const mysqlConn = await mysql.createConnection({
  host: process.env.MYSQL_HOST || "localhost",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "db_onefitness",
});

function normalizePhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("62")) return digits;
  return `62${digits}`;
}

function syntheticEmailFor(normalizedPhone) {
  return `${normalizedPhone}@members.xonefitness.local`;
}

function mysqlDateOnly(value) {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return value == null ? null : String(value).slice(0, 10);
}

async function fetchAllRows(table, columns) {
  const pageSize = 1000;
  const all = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + pageSize - 1);
    if (error) throw new Error(`fetchAllRows(${table}) failed: ${error.message}`);
    all.push(...data);
    if (data.length < pageSize) break;
  }
  return all;
}

console.log("=== loading source + existing state ===");
const [mysqlCustomers] = await mysqlConn.query("SELECT * FROM tec_customers");
const [mysqlProducts] = await mysqlConn.query("SELECT id, code FROM tec_products");
const existingMembers = await fetchAllRows(
  "members",
  "id, member_code, phone, auth_user_id, name, dob, start_date, end_date",
);
const existingStores = await fetchAllRows("stores", "id, code");
const existingProducts = await fetchAllRows("products", "id, code");
const storeIdMap = new Map(existingStores.map((s) => [s.code, s.id]));
const productCodeById = new Map(existingProducts.map((p) => [p.code, p.id]));
// mysql product id -> supabase product id, joined through the shared `code` column
const productIdMap = new Map(
  mysqlProducts.filter((p) => productCodeById.has(p.code)).map((p) => [p.id, productCodeById.get(p.code)]),
);

// Replicate the (now-fixed) migration script's member_code dedup exactly,
// so this lines up 1:1 with what's already in the members table.
const memberCodeSeen = new Set();
const codeToCustomer = new Map();
for (const c of mysqlCustomers) {
  let memberCode = c.member_code?.trim() || `LEGACY${c.id}`;
  if (memberCodeSeen.has(memberCode)) memberCode = `${memberCode}-${c.id}`;
  memberCodeSeen.add(memberCode);
  codeToCustomer.set(memberCode, c);
}

// Phone-login eligibility: unique across the *entire* source dataset only.
const phoneFrequency = new Map();
for (const c of mysqlCustomers) {
  const normalized = normalizePhone(c.phone);
  if (normalized.length < 9) continue;
  phoneFrequency.set(normalized, (phoneFrequency.get(normalized) ?? 0) + 1);
}

const existingCodes = new Set(existingMembers.map((m) => m.member_code));
const rawPhoneSeen = new Set(existingMembers.map((m) => m.phone).filter(Boolean));
const memberIdMap = new Map(); // mysql customer id -> supabase member id (only for rows this script touches)

console.log(`  mysql customers: ${mysqlCustomers.length}, existing supabase members: ${existingMembers.length}`);

// ── Step 0: fix the dob/start_date/end_date off-by-one ────────────────────
// The original run passed mysql2's raw JS Date objects straight to
// supabase-js for `dob`/`start_date`/`end_date`, which serializes them as a
// full UTC ISO timestamp — shifting the calendar date back by one day for
// any server timezone ahead of UTC (see mysqlDateOnly() above, which this
// script actually uses). Recompute from source and overwrite every row
// that's already in the table; idempotent since it just reasserts the
// correct value.
console.log("=== 1/4 fixing dob/start_date/end_date off-by-one ===");
const dateFixRows = [];
for (const m of existingMembers) {
  const c = codeToCustomer.get(m.member_code);
  if (!c) continue;
  const correctDob = mysqlDateOnly(c.dob);
  const correctStart = mysqlDateOnly(c.start_date);
  const correctEnd = mysqlDateOnly(c.end_date);
  if (correctDob !== m.dob || correctStart !== m.start_date || correctEnd !== m.end_date) {
    dateFixRows.push({ id: m.id, dob: correctDob, start_date: correctStart, end_date: correctEnd });
  }
}
// members.id is `generated always as identity` — Postgres rejects an
// explicit id in an upsert's INSERT branch (needs OVERRIDING SYSTEM VALUE),
// so plain per-row updates it is.
for (const row of dateFixRows) {
  const { error } = await supabase
    .from("members")
    .update({ dob: row.dob, start_date: row.start_date, end_date: row.end_date })
    .eq("id", row.id);
  if (error) throw new Error(`date fix update failed for member ${row.id}: ${error.message}`);
}
console.log(`  ${dateFixRows.length} members had their dates corrected`);

// ── Step 1: repair the one auth-trigger phantom row, insert the rest ──────
console.log("\n=== 2/4 repairing / inserting missing member rows ===");

// The trigger bug's phantom row: blank phone, has an auth_user_id, whose
// linked auth user's email encodes the real customer's phone number.
const phantomCandidates = existingMembers.filter((m) => m.phone === "" && m.auth_user_id);
const phantomByNormalizedPhone = new Map(); // normalizedPhone -> existing member row
for (const m of phantomCandidates) {
  const { data: authUser, error } = await supabase.auth.admin.getUserById(m.auth_user_id);
  if (error || !authUser?.user?.email) continue;
  const normalized = authUser.user.email.replace(/@members\.xonefitness\.local$/, "");
  phantomByNormalizedPhone.set(normalized, m);
}

let inserted = 0;
let repaired = 0;
let skippedAlreadyPresent = 0;

for (const [memberCode, c] of codeToCustomer) {
  if (existingCodes.has(memberCode)) {
    skippedAlreadyPresent++;
    continue;
  }

  const normalizedPhone = normalizePhone(c.phone);
  const rawPhone = c.phone?.trim();
  const phantom = normalizedPhone.length >= 9 ? phantomByNormalizedPhone.get(normalizedPhone) : null;

  const fields = {
    name: c.name || "Unknown",
    id_card_number: c.no_id || c.idcard || null,
    occupation: c.occupation || null,
    sex: c.sex || null,
    birthplace: c.place || null,
    dob: mysqlDateOnly(c.dob),
    address: c.address || null,
    emergency_contact_name: c.emergency_person || null,
    emergency_contact_phone: c.emergency_number || null,
    status: c.status === 1 ? "active" : "inactive",
    start_date: mysqlDateOnly(c.start_date),
    end_date: mysqlDateOnly(c.end_date),
    store_id: c.store_id ? (storeIdMap.get(c.store_id) ?? null) : null,
  };

  if (phantom) {
    // Repair in place — this row's auth_user_id already works, don't touch it.
    const { error } = await supabase
      .from("members")
      .update({ ...fields, phone: rawPhone, email: c.email || null, member_code: memberCode })
      .eq("id", phantom.id);
    if (error) {
      console.log(`  FAILED repairing phantom row for customer ${c.id} (${c.name}): ${error.message}`);
      continue;
    }
    memberIdMap.set(c.id, phantom.id);
    repaired++;
    continue;
  }

  const storedPhone = !rawPhone || rawPhoneSeen.has(rawPhone) ? `unknown-${c.id}` : rawPhone;
  if (rawPhone && storedPhone === rawPhone) rawPhoneSeen.add(rawPhone);

  const { data, error } = await supabase
    .from("members")
    .insert({
      auth_user_id: null,
      phone: storedPhone,
      email: c.email || null,
      member_code: memberCode,
      created_at: c.created_at,
      ...fields,
    })
    .select("id")
    .single();
  if (error) {
    console.log(`  FAILED inserting customer ${c.id} (${c.name}): ${error.message}`);
    continue;
  }
  memberIdMap.set(c.id, data.id);
  inserted++;
}

console.log(
  `  ${skippedAlreadyPresent} already present, ${repaired} repaired, ${inserted} newly inserted, ${memberIdMap.size} total touched`,
);

// ── Step 2: backfill orders/order_items/payments/check_ins for touched members ──
console.log("\n=== 3/4 backfilling orders, payments, check-ins for touched members ===");

if (memberIdMap.size === 0) {
  console.log("  nothing to backfill");
} else {
  const customerIds = [...memberIdMap.keys()];

  const [mysqlSales] = await mysqlConn.query(
    `SELECT * FROM tec_sales WHERE customer_id IN (${customerIds.map(() => "?").join(",")})`,
    customerIds,
  );
  const orderRows = mysqlSales.map((s) => ({
    code: `SALE-${s.id}`,
    member_id: memberIdMap.get(s.customer_id),
    store_id: storeIdMap.get(s.store_id) ?? null,
    total: Number(s.total || 0),
    grand_total: Number(s.grand_total || 0),
    status: s.status === "paid" ? "paid" : s.status === "pending" ? "pending" : "cancelled",
    created_at: s.date,
  }));

  const orderIdMap = new Map(); // mysql sale id -> supabase order id
  const existingOrderCodes = new Set(
    orderRows.length ? (await fetchAllRows("orders", "id, code")).map((o) => o.code) : [],
  );
  const newOrderRows = orderRows.filter((o) => !existingOrderCodes.has(o.code));
  for (let i = 0; i < newOrderRows.length; i += 500) {
    const chunk = newOrderRows.slice(i, i + 500);
    const { data, error } = await supabase.from("orders").insert(chunk).select("id, code");
    if (error) throw new Error(`orders insert failed: ${error.message}`);
    for (const o of data) orderIdMap.set(Number(o.code.replace("SALE-", "")), o.id);
  }
  console.log(`  orders: ${newOrderRows.length} inserted`);

  if (orderIdMap.size > 0) {
    const saleIds = [...orderIdMap.keys()];
    const [mysqlSaleItems] = await mysqlConn.query(
      `SELECT * FROM tec_sale_items WHERE sale_id IN (${saleIds.map(() => "?").join(",")})`,
      saleIds,
    );
    const itemRows = mysqlSaleItems
      .filter((si) => orderIdMap.has(si.sale_id))
      .map((si) => ({
        order_id: orderIdMap.get(si.sale_id),
        product_id: productIdMap.get(si.product_id) ?? null,
        product_name: si.product_name || "Unknown",
        quantity: Number(si.quantity || 1),
        unit_price: Number(si.unit_price || 0),
        subtotal: Number(si.subtotal || 0),
      }));
    for (let i = 0; i < itemRows.length; i += 500) {
      const { error } = await supabase.from("order_items").insert(itemRows.slice(i, i + 500));
      if (error) throw new Error(`order_items insert failed: ${error.message}`);
    }
    console.log(`  order_items: ${itemRows.length} inserted`);
  }

  const [mysqlPayments] = await mysqlConn.query(
    `SELECT * FROM tec_payments WHERE customer_id IN (${customerIds.map(() => "?").join(",")})`,
    customerIds,
  );
  const paymentRows = mysqlPayments
    .filter((p) => p.customer_id && memberIdMap.has(p.customer_id))
    .map((p) => ({
      order_id: p.sale_id ? (orderIdMap.get(p.sale_id) ?? null) : null,
      member_id: memberIdMap.get(p.customer_id),
      amount: Number(p.amount || 0),
      method: p.paid_by || null,
      transaction_id: p.transaction_id || null,
      note: p.note || null,
      created_at: p.date,
    }));
  for (let i = 0; i < paymentRows.length; i += 500) {
    const { error } = await supabase.from("payments").insert(paymentRows.slice(i, i + 500));
    if (error) throw new Error(`payments insert failed: ${error.message}`);
  }
  console.log(`  payments: ${paymentRows.length} inserted`);

  const touchedMemberCodes = new Map( // member_code -> supabase member id, for the customers we just touched
    [...memberIdMap.entries()].map(([mysqlId, supabaseId]) => {
      const code = [...codeToCustomer.entries()].find(([, c]) => c.id === mysqlId)?.[0];
      return [code, supabaseId];
    }),
  );
  const [mysqlAttendance] = await mysqlConn.query("SELECT * FROM tec_attendance");
  const checkinRows = [];
  for (const a of mysqlAttendance) {
    const memberId = touchedMemberCodes.get(a.member_id?.trim());
    if (!memberId) continue;
    const dateOnly = mysqlDateOnly(a.date_checkin);
    const checkedInAt = `${dateOnly} ${a.check_in}`;
    const checkedOutAt = a.check_out && a.check_out !== "00:00:00" ? `${dateOnly} ${a.check_out}` : null;
    checkinRows.push({ member_id: memberId, checked_in_at: checkedInAt, checked_out_at: checkedOutAt, created_at: a.created_at });
  }
  for (let i = 0; i < checkinRows.length; i += 500) {
    const { error } = await supabase.from("check_ins").insert(checkinRows.slice(i, i + 500));
    if (error) throw new Error(`check_ins insert failed: ${error.message}`);
  }
  console.log(`  check_ins: ${checkinRows.length} inserted`);
}

// ── Step 3: create missing auth accounts for every eligible member ────────
console.log("\n=== 4/4 creating missing auth accounts ===");

const allMembers = await fetchAllRows("members", "id, member_code, auth_user_id, name");
let created = 0;
let ineligible = 0;
let failed = 0;
let processed = 0;

for (const m of allMembers) {
  processed++;
  if (processed % 200 === 0) process.stdout.write(`\r  ${processed}/${allMembers.length}`);
  if (m.auth_user_id) continue;

  const customer = codeToCustomer.get(m.member_code);
  if (!customer) {
    ineligible++;
    continue;
  }
  const normalizedPhone = normalizePhone(customer.phone);
  const eligible = normalizedPhone.length >= 9 && phoneFrequency.get(normalizedPhone) === 1;
  if (!eligible) {
    ineligible++;
    continue;
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: syntheticEmailFor(normalizedPhone),
    password: "123456",
    email_confirm: true,
    user_metadata: { must_change_password: true, name: m.name, role: "migrated_member" },
  });
  if (authError) {
    failed++;
    console.log(`\n  FAILED creating auth for member ${m.id} (${m.name}): ${authError.message}`);
    continue;
  }

  const { error: updateError } = await supabase
    .from("members")
    .update({ auth_user_id: authData.user.id })
    .eq("id", m.id);
  if (updateError) {
    failed++;
    console.log(`\n  FAILED linking auth for member ${m.id} (${m.name}): ${updateError.message}`);
    continue;
  }
  created++;
}

console.log(`\n  ${created} auth accounts created, ${ineligible} ineligible (no/blank/duplicate phone), ${failed} failed`);
console.log("\n=== Backfill complete ===");

await mysqlConn.end();
process.exit(0);
