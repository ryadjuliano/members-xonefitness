"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function getCurrentMemberId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("members").select("id").eq("auth_user_id", user.id).single();
  return data?.id ?? null;
}

/** qrCode is validated against stores.code — the gym prints one static QR at the front desk. */
export async function checkIn(qrCode: string) {
  const supabase = await createClient();
  const memberId = await getCurrentMemberId(supabase);
  if (!memberId) return { error: "Sesi tidak ditemukan, silakan login ulang." };

  const scanned = qrCode.trim();
  // Case-insensitive on purpose — a printed static QR shouldn't break check-in over
  // capitalization. Compared in JS (not `ilike`) so scanned text with literal
  // %/_ can't be misread as SQL wildcards.
  const { data: stores } = await supabase.from("stores").select("id, code");
  const store = stores?.find((s) => s.code.toLowerCase() === scanned.toLowerCase());
  if (!store) return { error: `QR code tidak valid ("${scanned}"). Scan QR yang ada di gym.` };

  const { data, error } = await supabase
    .from("check_ins")
    .insert({ member_id: memberId, store_id: store.id, checked_in_at: new Date().toISOString() })
    .select("id, checked_in_at")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/checkin");
  revalidatePath("/home");
  return { data };
}

export async function uploadCheckinSelfie(checkinId: number, formData: FormData) {
  const supabase = await createClient();
  const memberId = await getCurrentMemberId(supabase);
  if (!memberId) return { error: "Sesi tidak ditemukan, silakan login ulang." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Foto tidak ditemukan." };

  const path = `members/${memberId}/${checkinId}-${Date.now()}.jpg`;
  const { error: uploadError } = await supabase.storage.from("checkin-selfies").upload(path, file, {
    contentType: file.type || "image/jpeg",
  });
  if (uploadError) return { error: uploadError.message };

  const { error: updateError } = await supabase
    .from("check_ins")
    .update({ photo_url: path })
    .eq("id", checkinId)
    .eq("member_id", memberId);
  if (updateError) return { error: updateError.message };

  revalidatePath("/checkin");
  return { success: true };
}

export async function checkOut(checkinId: number) {
  const supabase = await createClient();
  const memberId = await getCurrentMemberId(supabase);
  if (!memberId) return { error: "Sesi tidak ditemukan, silakan login ulang." };

  const { error } = await supabase
    .from("check_ins")
    .update({ checked_out_at: new Date().toISOString() })
    .eq("id", checkinId)
    .eq("member_id", memberId);

  if (error) return { error: error.message };

  revalidatePath("/checkin");
  revalidatePath("/home");
  return { success: true };
}
