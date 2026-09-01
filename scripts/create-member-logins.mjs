// One-off: give members who don't have a login yet (added via the POS's
// "Add Member" form, or synced in later from the legacy MySQL POS without
// an auth account) a default login — password "123456" — and flag their
// account with must_change_password so the app forces a real password on
// first sign-in (see proxy.ts + /change-password).
//
// Only members with a phone number that's uniquely resolvable across the
// ENTIRE members table get a login — same safety rule the original
// MySQL migration used: a phone shared by more than one row, or a
// blank/placeholder phone (from walk-ins added without a real number),
// has ambiguous ownership and is skipped rather than guessed at.
//
// Usage:
//   node scripts/create-member-logins.mjs            # dry run, reports counts only
//   node scripts/create-member-logins.mjs --apply     # actually creates accounts

import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
    }
  }
}

const APPLY = process.argv.includes("--apply");
const DEFAULT_PASSWORD = "123456";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env(.local).");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
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

/** PostgREST caps unbounded selects at 1000 rows — page through with .range() to get everything. */
async function fetchAllRows(table, columns, filters = (q) => q) {
  const pageSize = 1000;
  const all = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await filters(supabase.from(table).select(columns)).range(from, from + pageSize - 1);
    if (error) throw new Error(`fetchAllRows(${table}) failed: ${error.message}`);
    all.push(...data);
    if (data.length < pageSize) break;
  }
  return all;
}

console.log(APPLY ? "*** APPLY MODE — will create real auth accounts ***" : "*** DRY RUN — no accounts created, counts only ***");

const allMembers = await fetchAllRows("members", "id, name, phone, auth_user_id", (q) => q.is("deleted_at", null));
console.log(`  ${allMembers.length} total members`);

// Frequency across the WHOLE table (not just the ones missing a login) — a
// phone reused by an already-migrated member is just as ambiguous as one
// reused within this batch.
const phoneFrequency = new Map();
for (const m of allMembers) {
  const n = normalizePhone(m.phone);
  if (n.length >= 9) phoneFrequency.set(n, (phoneFrequency.get(n) ?? 0) + 1);
}

const candidates = allMembers.filter((m) => !m.auth_user_id);
console.log(`  ${candidates.length} members without a login yet`);

let usable = 0;
let skippedNoPhone = 0;
let skippedAmbiguous = 0;
let created = 0;
let failed = 0;
const failures = [];

for (const m of candidates) {
  const raw = (m.phone || "").trim();
  if (!raw || raw.startsWith("unknown-") || raw.startsWith("pos-")) {
    skippedNoPhone++;
    continue;
  }
  const normalized = normalizePhone(raw);
  if (normalized.length < 9 || phoneFrequency.get(normalized) !== 1) {
    skippedAmbiguous++;
    continue;
  }

  usable++;
  if (!APPLY) continue;

  try {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: syntheticEmailFor(normalized),
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      // NOT "member" — that's the role value the on_auth_member_created
      // trigger matches to auto-insert a *self-registration* members row,
      // which would collide with this already-existing member row.
      user_metadata: { must_change_password: true, name: m.name, phone: normalized, role: "migrated_member" },
    });
    if (authError) throw new Error(authError.message);

    const { error: updateError } = await supabase
      .from("members")
      .update({ auth_user_id: authData.user.id })
      .eq("id", m.id);
    if (updateError) throw new Error(updateError.message);

    created++;
  } catch (err) {
    failed++;
    failures.push(`member id ${m.id} (${m.name}): ${err.message}`);
  }

  if ((created + failed) % 25 === 0) process.stdout.write(`\r  ${created + failed}/${usable}`);
}
if (APPLY) console.log();

console.log(`\n  usable (unique real phone, would get a login): ${usable}`);
console.log(`  skipped — blank/placeholder phone: ${skippedNoPhone}`);
console.log(`  skipped — invalid/ambiguous (shared) phone: ${skippedAmbiguous}`);
if (APPLY) {
  console.log(`  accounts created: ${created}`);
  console.log(`  failed: ${failed}`);
  if (failures.length > 0) {
    console.log("  first few failures:");
    for (const line of failures.slice(0, 5)) console.log(`    - ${line}`);
  }
}

console.log(APPLY ? "\n=== Done ===" : "\n=== Dry run complete — re-run with --apply to create these accounts ===");
process.exit(0);
