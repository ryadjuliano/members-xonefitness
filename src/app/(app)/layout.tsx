import { BottomNav } from "@/components/layout/bottom-nav";
import { MemberProvider, type CurrentMember } from "@/lib/member-context";
import { createClient } from "@/lib/supabase/server";
import { MOCK_MEMBER } from "@/lib/mock-data";

async function getCurrentMember(): Promise<CurrentMember> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return {
      id: 0,
      name: MOCK_MEMBER.name,
      memberCode: MOCK_MEMBER.memberCode,
      phone: MOCK_MEMBER.phone,
      email: null,
      photoUrl: MOCK_MEMBER.photoUrl,
      status: "active",
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
    .select("id, name, member_code, phone, email, photo_url, status, start_date, end_date")
    .eq("auth_user_id", user?.id)
    .single();

  return {
    id: member?.id ?? 0,
    name: member?.name ?? "Member",
    memberCode: member?.member_code ?? "-",
    phone: member?.phone ?? "-",
    email: member?.email ?? null,
    photoUrl: member?.photo_url ?? null,
    status: member?.status ?? "active",
    startDate: member?.start_date ?? null,
    endDate: member?.end_date ?? null,
  };
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const member = await getCurrentMember();

  return (
    <MemberProvider member={member}>
      <div className="mx-auto min-h-dvh w-full max-w-[480px] bg-background">
        <main className="px-5 pt-6 pb-28">{children}</main>
        <BottomNav />
      </div>
    </MemberProvider>
  );
}
