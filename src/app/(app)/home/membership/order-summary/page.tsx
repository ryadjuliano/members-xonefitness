import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { OrderSummaryFlow } from "@/components/membership/order-summary-flow";
import { createClient } from "@/lib/supabase/server";
import { MOCK_MEMBER, MOCK_PACKAGES } from "@/lib/mock-data";

const HAS_SUPABASE = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

async function getData(productId: number) {
  if (!HAS_SUPABASE) {
    const product = MOCK_PACKAGES.find((p) => p.id === productId);
    return product ? { product, memberName: MOCK_MEMBER.name } : null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: product }, { data: member }] = await Promise.all([
    supabase.from("products").select("id, name, price").eq("id", productId).single(),
    supabase.from("members").select("name").eq("auth_user_id", user?.id).single(),
  ]);

  if (!product) return null;
  return { product: { id: product.id, name: product.name, price: Number(product.price) }, memberName: member?.name ?? "Member" };
}

export default async function OrderSummaryPage({ searchParams }: { searchParams: Promise<{ productId?: string }> }) {
  const { productId } = await searchParams;
  const parsedId = Number(productId);
  if (!productId || !Number.isFinite(parsedId)) notFound();

  const data = await getData(parsedId);
  if (!data) notFound();

  return (
    <div className="space-y-6">
      <Link href="/home/membership" className="inline-flex items-center gap-2 text-text-secondary">
        <Icon name="chevron-left" size={16} />
        <span className="text-sm">Kembali</span>
      </Link>

      <h1 className="text-xl font-bold">Ringkasan Pesanan</h1>

      <OrderSummaryFlow
        productId={data.product.id}
        productName={data.product.name}
        price={data.product.price}
        memberName={data.memberName}
      />
    </div>
  );
}
