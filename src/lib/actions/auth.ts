"use server";

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
  const { error } = await admin.auth.admin.createUser({
    email: syntheticEmailFor(normalizedPhone),
    password,
    email_confirm: true,
    user_metadata: { name, phone: normalizedPhone, role: "member" },
  });

  if (error) {
    return { error: error.message.includes("already been registered") ? "Nomor HP sudah terdaftar." : error.message };
  }
  return { success: true };
}
