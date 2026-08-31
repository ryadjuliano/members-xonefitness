"use server";

import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone, syntheticEmailFor } from "@/lib/utils";

/**
 * Creates the auth account for a new self-registered member via the admin
 * API rather than the public supabase.auth.signUp() endpoint. Supabase
 * rejects our synthetic @members.xonefitness.local email at signup time
 * with "email_address_invalid" (its anti-abuse check requires a
 * mail-deliverable domain) — admin.createUser() isn't subject to that
 * check, which is also why the legacy-member migration script works.
 *
 * The account is created with no session; the caller signs in right after
 * with the same phone/password (identical to the login flow).
 */
export async function registerMember(name: string, phone: string, password: string) {
  const normalizedPhone = normalizePhone(phone);
  if (normalizedPhone.length < 9) return { error: "Nomor HP tidak valid." };

  const admin = createAdminClient();
  const { data: authData, error } = await admin.auth.admin.createUser({
    email: syntheticEmailFor(normalizedPhone),
    password,
    email_confirm: true,
    user_metadata: { name, phone: normalizedPhone, role: "member" },
  });

  if (error) {
    return { error: error.message.includes("already been registered") ? "Nomor HP sudah terdaftar." : error.message };
  }

  const userId = authData.user.id;

  // The `on_auth_member_created` DB trigger (supabase/migrations/0001_init.sql)
  // is supposed to create this row automatically, but relying solely on a
  // trigger meant this broke silently at some point (likely a Supabase
  // project migration that never re-applied it) — self-registered members
  // got a working login but no `members` row, so they never showed up in
  // the POS member list. Doing it explicitly here works regardless of
  // whether that trigger exists; `ignoreDuplicates` makes it a no-op if the
  // trigger *did* fire first.
  const { error: memberError } = await admin.from("members").upsert(
    {
      auth_user_id: userId,
      name,
      phone: normalizedPhone,
      member_code: `XOF${createHash("md5").update(userId).digest("hex").slice(0, 8).toUpperCase()}`,
      status: "active",
    },
    { onConflict: "auth_user_id", ignoreDuplicates: true }
  );

  if (memberError) {
    // Roll back the auth account — createUser isn't retryable otherwise,
    // since the synthetic email is deterministic from phone, so a failed
    // member insert would permanently strand this phone number.
    await admin.auth.admin.deleteUser(userId);
    return {
      error: memberError.message.includes("duplicate") ? "Nomor HP sudah terdaftar." : memberError.message,
    };
  }

  return { success: true };
}
