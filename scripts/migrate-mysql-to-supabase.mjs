// One-off ETL: db_onefitness (MySQL, tec_* POS schema) -> Supabase (Postgres).
// Run once, after `supabase/migrations/0001_init.sql` has been applied and
// .env(.local) has real Supabase + MySQL credentials:
//
//   node scripts/migrate-mysql-to-supabase.mjs
//
// Idempotent per table: each step checks whether its target table is
// already populated and skips re-inserting if so (rebuilding whatever id
// map it needs from the existing rows instead) — safe to re-run if it dies
// partway through.

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

/**
 * mysql2 returns DATE columns as JS Date objects (in local server time) —
 * string-interpolating one directly calls Date.prototype.toString(), which
 * produces "Sun Aug 12 2026 00:00:00 GMT+0700 (...)" and makes Postgres
 * reject it as an invalid time zone. Format explicitly as YYYY-MM-DD instead.
 */
function mysqlDateOnly(value) {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

/** PostgREST caps unbounded selects at 1000 rows — page through with .range() to get everything. */
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

async function tableIsEmpty(table) {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`Checking ${table} emptiness failed: ${error.message}`);
  return (count ?? 0) === 0;
}

/** Bulk insert in chunks, returning the inserted rows (with their new ids) in the same order. */
async function chunkInsertReturning(table, rows, columns, chunkSize = 500) {
  const results = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { data, error } = await supabase.from(table).insert(chunk).select(columns);
    if (error) throw new Error(`Insert into ${table} failed at row ${i}: ${error.message}`);
    results.push(...data);
    process.stdout.write(`\r  ${table}: ${results.length}/${rows.length}`);
  }
  console.log();
  return results;
}

async function chunkInsert(table, rows, chunkSize = 500) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) throw new Error(`Insert into ${table} failed at row ${i}: ${error.message}`);
    inserted += chunk.length;
    process.stdout.write(`\r  ${table}: ${inserted}/${rows.length}`);
  }
  console.log();
  return inserted;
}

console.log("=== 1/8 stores ===");
const [mysqlStores] = await mysqlConn.query("SELECT * FROM tec_stores");
const storeIdMap = new Map(); // mysql id -> supabase id
if (await tableIsEmpty("stores")) {
  for (const s of mysqlStores) {
    const { data, error } = await supabase
      .from("stores")
      .insert({ name: s.name, code: s.code, phone: s.phone || null, address: s.address1 || null, city: s.city || null })
      .select("id")
      .single();
    if (error) throw new Error(`stores insert failed: ${error.message}`);
    storeIdMap.set(s.id, data.id);
  }
  console.log(`  inserted ${mysqlStores.length} stores`);
} else {
  console.log("  stores already populated, rebuilding id map from existing rows");
  const byCode = new Map((await fetchAllRows("stores", "id, code")).map((r) => [r.code, r.id]));
  for (const s of mysqlStores) storeIdMap.set(s.id, byCode.get(s.code));
}

console.log("=== 2/8 product_categories ===");
const [mysqlCategories] = await mysqlConn.query("SELECT * FROM tec_categories");
const categoryIdMap = new Map();
if (await tableIsEmpty("product_categories")) {
  for (const c of mysqlCategories) {
    const { data, error } = await supabase
      .from("product_categories")
      .insert({ code: c.code, name: c.name, image_url: c.image === "no_image.png" ? null : c.image })
      .select("id")
      .single();
    if (error) throw new Error(`product_categories insert failed: ${error.message}`);
    categoryIdMap.set(c.id, data.id);
  }
  console.log(`  inserted ${mysqlCategories.length} categories`);
} else {
  console.log("  product_categories already populated, rebuilding id map from existing rows");
  const byCode = new Map((await fetchAllRows("product_categories", "id, code")).map((r) => [r.code, r.id]));
  for (const c of mysqlCategories) categoryIdMap.set(c.id, byCode.get(c.code));
}

console.log("=== 3/8 products ===");
const [mysqlProducts] = await mysqlConn.query("SELECT * FROM tec_products");
const productIdMap = new Map();
if (await tableIsEmpty("products")) {
  for (const p of mysqlProducts) {
    const { data, error } = await supabase
      .from("products")
      .insert({
        code: p.code,
        name: p.name,
        category_id: categoryIdMap.get(p.category_id) ?? null,
        price: Number(p.price),
        image_url: p.image === "no_image.png" ? null : p.image,
        lifetime: p.lifetime || null,
      })
      .select("id")
      .single();
    if (error) throw new Error(`products insert failed (${p.code}): ${error.message}`);
    productIdMap.set(p.id, data.id);
  }
  console.log(`  inserted ${mysqlProducts.length} products`);
} else {
  console.log("  products already populated, rebuilding id map from existing rows");
  const byCode = new Map((await fetchAllRows("products", "id, code")).map((r) => [r.code, r.id]));
  for (const p of mysqlProducts) productIdMap.set(p.id, byCode.get(p.code));
}

console.log("=== 4/8 members (+ auth accounts) ===");
const [mysqlCustomers] = await mysqlConn.query("SELECT * FROM tec_customers");
const memberIdMap = new Map(); // mysql customer id -> supabase member id
let authCreated = 0;
let authSkipped = 0;
let memberFailed = 0;
const memberFailures = [];

// A phone is only safe to grant a login to when it's unique across the
// *entire* source dataset. The legacy POS data has real duplicates (shared
// family/staff numbers, blank entries, data-entry mistakes) — precompute
// frequency up front so duplicates NEVER get a login (ambiguous ownership),
// rather than the first occurrence winning by processing order.
const phoneFrequency = new Map();
for (const c of mysqlCustomers) {
  const normalized = normalizePhone(c.phone);
  if (normalized.length < 9) continue;
  phoneFrequency.set(normalized, (phoneFrequency.get(normalized) ?? 0) + 1);
}

if (await tableIsEmpty("members")) {
  const memberCodeSeen = new Set();
  const rawPhoneSeen = new Set();
  let processed = 0;

  for (const c of mysqlCustomers) {
    try {
      let memberCode = c.member_code?.trim() || `LEGACY${c.id}`;
      if (memberCodeSeen.has(memberCode)) memberCode = `${memberCode}-${c.id}`;
      memberCodeSeen.add(memberCode);

      const normalizedPhone = normalizePhone(c.phone);
      const phoneUsable = normalizedPhone.length >= 9 && phoneFrequency.get(normalizedPhone) === 1;

      // members.phone is unique — a raw phone string reused across multiple
      // customers (same duplicate-detection reason above) can only be
      // stored once verbatim; every other occurrence falls back to a
      // synthetic placeholder so the insert doesn't collide.
      const rawPhone = c.phone?.trim();
      let storedPhone;
      if (!rawPhone || rawPhoneSeen.has(rawPhone)) {
        storedPhone = `unknown-${c.id}`;
      } else {
        storedPhone = rawPhone;
        rawPhoneSeen.add(rawPhone);
      }

      let authUserId = null;
      if (phoneUsable) {
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: syntheticEmailFor(normalizedPhone),
          password: "123456",
          email_confirm: true,
          // NOT "member" — that value is what the on_auth_member_created
          // trigger matches to auto-create a *self-registration* members
          // row (see supabase/migrations/0001_init.sql). Using it here
          // made the trigger fire for every admin-created account too,
          // inserting a bogus blank-phone members row on the first call
          // and then failing every subsequent createUser with a unique
          // constraint violation on members.phone — so almost no migrated
          // member ever actually got a working auth account.
          user_metadata: { must_change_password: true, name: c.name, role: "migrated_member" },
        });
        if (authError) {
          authSkipped++;
        } else {
          authUserId = authData.user.id;
          authCreated++;
        }
      } else {
        authSkipped++;
      }

      const { data, error } = await supabase
        .from("members")
        .insert({
          auth_user_id: authUserId,
          name: c.name || "Unknown",
          phone: storedPhone,
          email: c.email || null,
          member_code: memberCode,
          id_card_number: c.no_id || c.idcard || null,
          occupation: c.occupation || null,
          sex: c.sex || null,
          birthplace: c.place || null,
          dob: c.dob,
          address: c.address || null,
          emergency_contact_name: c.emergency_person || null,
          emergency_contact_phone: c.emergency_number || null,
          status: c.status === 1 ? "active" : "inactive",
          start_date: c.start_date,
          end_date: c.end_date,
          store_id: c.store_id ? (storeIdMap.get(c.store_id) ?? null) : null,
          created_at: c.created_at,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      memberIdMap.set(c.id, data.id);
    } catch (err) {
      // One bad row (e.g. a leftover auth user from a previous partial run)
      // shouldn't take down the other ~2,200 members — log and keep going.
      memberFailed++;
      memberFailures.push(`customer id ${c.id} (${c.name}): ${err.message}`);
    }

    processed++;
    if (processed % 100 === 0) process.stdout.write(`\r  members: ${processed}/${mysqlCustomers.length}`);
  }
  console.log(
    `\n  processed ${mysqlCustomers.length} members — ${authCreated} auth accounts created, ${authSkipped} skipped (blank/duplicate/invalid phone), ${memberFailed} failed`,
  );
  if (memberFailures.length > 0) {
    console.log("  first few failures:");
    for (const line of memberFailures.slice(0, 5)) console.log(`    - ${line}`);
  }
} else {
  console.log("  members already populated, rebuilding id map from existing rows (by member_code)");
  const byCode = new Map((await fetchAllRows("members", "id, member_code")).map((r) => [r.member_code, r.id]));
  const memberCodeSeen = new Set();
  for (const c of mysqlCustomers) {
    let memberCode = c.member_code?.trim() || `LEGACY${c.id}`;
    if (memberCodeSeen.has(memberCode)) memberCode = `${memberCode}-${c.id}`;
    memberCodeSeen.add(memberCode);
    if (byCode.has(memberCode)) memberIdMap.set(c.id, byCode.get(memberCode));
  }
}

console.log("=== 5/8 orders ===");
let orderIdMap = new Map(); // mysql sale id -> supabase order id
if (await tableIsEmpty("orders")) {
  const [mysqlSales] = await mysqlConn.query("SELECT * FROM tec_sales");
  const rows = mysqlSales
    .filter((s) => memberIdMap.has(s.customer_id))
    .map((s) => ({
      code: `SALE-${s.id}`,
      member_id: memberIdMap.get(s.customer_id),
      store_id: storeIdMap.get(s.store_id) ?? null,
      total: Number(s.total || 0),
      grand_total: Number(s.grand_total || 0),
      status: s.status === "paid" ? "paid" : s.status === "pending" ? "pending" : "cancelled",
      created_at: s.date,
    }));
  const inserted = await chunkInsertReturning("orders", rows, "id, code");
  for (const o of inserted) orderIdMap.set(Number(o.code.replace("SALE-", "")), o.id);
} else {
  console.log("  orders already populated, rebuilding id map from existing rows");
  const all = await fetchAllRows("orders", "id, code");
  for (const o of all) orderIdMap.set(Number(o.code.replace("SALE-", "")), o.id);
}

console.log("=== 6/8 order_items ===");
if (await tableIsEmpty("order_items")) {
  const [mysqlSaleItems] = await mysqlConn.query("SELECT * FROM tec_sale_items");
  const rows = mysqlSaleItems
    .filter((si) => orderIdMap.has(si.sale_id))
    .map((si) => ({
      order_id: orderIdMap.get(si.sale_id),
      product_id: productIdMap.get(si.product_id) ?? null,
      product_name: si.product_name || "Unknown",
      quantity: Number(si.quantity || 1),
      unit_price: Number(si.unit_price || 0),
      subtotal: Number(si.subtotal || 0),
    }));
  await chunkInsert("order_items", rows);
} else {
  console.log("  order_items already populated, skipping");
}

console.log("=== 7/8 payments ===");
if (await tableIsEmpty("payments")) {
  const [mysqlPayments] = await mysqlConn.query("SELECT * FROM tec_payments");
  const rows = mysqlPayments
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
  await chunkInsert("payments", rows);
} else {
  console.log("  payments already populated, skipping");
}

console.log("=== 8/8 check_ins ===");
if (await tableIsEmpty("check_ins")) {
  const [mysqlAttendance] = await mysqlConn.query("SELECT * FROM tec_attendance");
  const byMemberCode = new Map((await fetchAllRows("members", "id, member_code")).map((m) => [m.member_code, m.id]));

  const rows = [];
  let unresolved = 0;
  for (const a of mysqlAttendance) {
    const memberId = byMemberCode.get(a.member_id?.trim());
    if (!memberId) {
      unresolved++;
      continue;
    }
    const dateOnly = mysqlDateOnly(a.date_checkin);
    const checkedInAt = `${dateOnly} ${a.check_in}`;
    const checkedOutAt = a.check_out && a.check_out !== "00:00:00" ? `${dateOnly} ${a.check_out}` : null;
    rows.push({ member_id: memberId, checked_in_at: checkedInAt, checked_out_at: checkedOutAt, created_at: a.created_at });
  }
  await chunkInsert("check_ins", rows);
  if (unresolved > 0) console.log(`  note: ${unresolved} attendance rows had a member_code with no matching member, skipped`);
} else {
  console.log("  check_ins already populated, skipping");
}

console.log("\n=== Migration complete ===");
await mysqlConn.end();
process.exit(0);
