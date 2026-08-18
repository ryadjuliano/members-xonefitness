import { Card } from "@/components/ui/card";
import { MemberDigitalCard } from "@/components/profile/member-digital-card";
import { ProfileMenuItem } from "@/components/profile/profile-menu-item";
import { LogoutItem } from "@/components/profile/logout-item";
import { createClient } from "@/lib/supabase/server";
import { MOCK_MEMBER } from "@/lib/mock-data";

const HAS_SUPABASE = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

async function getProfileData() {
  if (!HAS_SUPABASE) {
    return {
      name: MOCK_MEMBER.name,
      phone: MOCK_MEMBER.phone,
      email: null as string | null,
      memberCode: MOCK_MEMBER.memberCode,
      planName: MOCK_MEMBER.planName,
      startDate: MOCK_MEMBER.startDate,
      endDate: MOCK_MEMBER.endDate,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: member } = await supabase
    .from("members")
    .select("name, phone, email, member_code, start_date, end_date")
    .eq("auth_user_id", user?.id)
    .single();

  return {
    name: member?.name ?? "Member",
    phone: member?.phone ?? "-",
    email: member?.email ?? null,
    memberCode: member?.member_code ?? "-",
    planName: null as string | null,
    startDate: member?.start_date ?? null,
    endDate: member?.end_date ?? null,
  };
}

export default async function ProfilePage() {
  const profile = await getProfileData();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Profil</h1>

      <MemberDigitalCard
        name={profile.name}
        memberCode={profile.memberCode}
        planName={profile.planName}
        memberSince={profile.startDate}
        validUntil={profile.endDate}
      />

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-text-secondary">Informasi Akun</h2>
        <div className="space-y-3">
          <InfoRow label="Nama" value={profile.name} />
          <InfoRow label="No. HP" value={`+${profile.phone}`} />
          <InfoRow label="Email" value={profile.email ?? "-"} />
          <InfoRow label="Nomor Anggota" value={profile.memberCode} />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <ProfileMenuItem href="/profile/edit" icon="pen" label="Edit Profil" />
        <ProfileMenuItem href="/change-password" icon="lock" label="Keamanan" />
      </Card>

      <LogoutItem />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-text-tertiary">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
