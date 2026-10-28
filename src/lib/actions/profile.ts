"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Nama dan No. HP hanya bisa diubah admin dari POS, jadi member cuma bisa
// mengubah email di sini.
export async function updateProfile(input: { email?: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesi tidak ditemukan, silakan login ulang." };

  const { error } = await supabase
    .from("members")
    .update({ email: input.email || null })
    .eq("auth_user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/profile");
  return { success: true };
}
