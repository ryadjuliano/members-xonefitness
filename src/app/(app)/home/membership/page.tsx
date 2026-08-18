import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { PackageGridCard } from "@/components/membership/package-grid-card";
import { createClient } from "@/lib/supabase/server";
import { MOCK_PACKAGES } from "@/lib/mock-data";

const HAS_SUPABASE = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

async function getPackages() {
  if (!HAS_SUPABASE) return MOCK_PACKAGES;

  const supabase = await createClient();
  const { data } = await supabase.from("products").select("id, name, price, lifetime").order("price");

  return (data ?? []).map((p) => ({ id: p.id, name: p.name, price: Number(p.price), lifetime: p.lifetime, highlighted: false }));
}

export default async function MembershipPage() {
  const packages = await getPackages();
  const popularIndex = Math.floor(packages.length / 2);

  return (
    <div className="space-y-6">
      <Link href="/home" className="inline-flex items-center gap-2 text-text-secondary">
        <Icon name="chevron-left" size={16} />
        <span className="text-sm">Kembali</span>
      </Link>

      <div>
        <h1 className="text-xl font-bold">Pilih Paket</h1>
        <p className="mt-1 text-sm text-text-secondary">Pilih paket membership yang sesuai untukmu.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {packages.map((pkg, index) => (
          <PackageGridCard key={pkg.id} {...pkg} highlighted={pkg.highlighted || index === popularIndex} />
        ))}
        {packages.length === 0 && (
          <p className="col-span-2 rounded-lg border border-gray-200 bg-background-card p-6 text-center text-sm text-text-secondary">
            Belum ada paket tersedia.
          </p>
        )}
      </div>
    </div>
  );
}
