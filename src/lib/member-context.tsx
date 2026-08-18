"use client";

import { createContext, useContext } from "react";

export type CurrentMember = {
  id: number;
  name: string;
  memberCode: string;
  phone: string;
  email: string | null;
  photoUrl: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
};

const MemberContext = createContext<CurrentMember | null>(null);

export function MemberProvider({ member, children }: { member: CurrentMember | null; children: React.ReactNode }) {
  return <MemberContext.Provider value={member}>{children}</MemberContext.Provider>;
}

export function useMember() {
  const member = useContext(MemberContext);
  if (!member) {
    throw new Error("useMember must be used within the (app) route group, and the member must be loaded.");
  }
  return member;
}
