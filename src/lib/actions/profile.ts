"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateProfile(input: { name: string; email?: string }) {
  if (!input.name.trim()) return { error: "Nama tidak boleh kosong." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesi tidak ditemukan, silakan login ulang." };

  const { error } = await supabase
    .from("members")
    .update({ name: input.name.trim(), email: input.email || null })
    .eq("auth_user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/profile");
  return { success: true };
}
