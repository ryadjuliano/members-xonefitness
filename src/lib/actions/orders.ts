"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createOrder(productId: number, method: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesi tidak ditemukan, silakan login ulang." };

  const { data: member } = await supabase.from("members").select("id, store_id").eq("auth_user_id", user.id).single();
  if (!member) return { error: "Data member tidak ditemukan." };

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, name, price")
    .eq("id", productId)
    .single();
  if (productError || !product) return { error: "Paket tidak ditemukan." };

  const { count } = await supabase.from("orders").select("id", { count: "exact", head: true });
  const code = `ORD-${10000 + (count ?? 0) + 1}`;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      code,
      member_id: member.id,
      store_id: member.store_id,
      total: product.price,
      grand_total: product.price,
      status: "pending",
    })
    .select("id, code")
    .single();
  if (orderError) return { error: orderError.message };

  await supabase.from("order_items").insert({
    order_id: order.id,
    product_id: product.id,
    product_name: product.name,
    quantity: 1,
    unit_price: product.price,
    subtotal: product.price,
  });

  await supabase.from("payments").insert({
    order_id: order.id,
    member_id: member.id,
    amount: product.price,
    method,
  });

  revalidatePath("/history");
  return { data: { orderId: order.id, code: order.code } };
}

export async function uploadPaymentProof(orderId: number, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesi tidak ditemukan, silakan login ulang." };

  const { data: member } = await supabase.from("members").select("id").eq("auth_user_id", user.id).single();
  if (!member) return { error: "Data member tidak ditemukan." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Pilih file bukti pembayaran." };

  const path = `members/${member.id}/${orderId}-${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from("payment-proofs").upload(path, file, {
    contentType: file.type || undefined,
  });
  if (uploadError) return { error: uploadError.message };

  const { error: updateError } = await supabase
    .from("payments")
    .update({ proof_path: path })
    .eq("order_id", orderId)
    .eq("member_id", member.id);
  if (updateError) return { error: updateError.message };

  return { success: true };
}
