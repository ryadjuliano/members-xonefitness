// Placeholder data standing in for Supabase queries until credentials are
// wired up and the migration has run. Shapes mirror the real query results
// so swapping to live data (see the HAS_SUPABASE guards in each page) is a
// drop-in replacement.

export const MOCK_MEMBER = {
  name: "Rentalia Pakpahan",
  memberCode: "X1F579078",
  phone: "6285244444373",
  planName: "Individual Monthly Normal",
  startDate: "2026-07-15",
  endDate: "2026-08-15",
  photoUrl: null as string | null,
};

export const MOCK_CHECKIN_STATS = {
  visitsThisMonth: 9,
  totalVisits: 84,
  avgSessionMinutes: 62,
};

export const MOCK_RECENT_CHECKINS = [
  { id: 1, checkedInAt: "2026-08-12T09:44:37", checkedOutAt: null as string | null },
  { id: 2, checkedInAt: "2026-08-10T18:12:00", checkedOutAt: "2026-08-10T19:30:00" },
  { id: 3, checkedInAt: "2026-08-08T07:05:00", checkedOutAt: "2026-08-08T08:10:00" },
  { id: 4, checkedInAt: "2026-08-06T17:40:00", checkedOutAt: "2026-08-06T18:55:00" },
  { id: 5, checkedInAt: "2026-08-04T09:00:00", checkedOutAt: "2026-08-04T10:15:00" },
];

export const MOCK_TRANSACTIONS = [
  { id: 1, code: "SALE-26647", productName: "Individual Monthly Normal", amount: 325000, status: "paid", createdAt: "2026-07-15" },
  { id: 2, code: "SALE-26512", productName: "Individual Monthly Normal", amount: 325000, status: "paid", createdAt: "2026-06-15" },
  { id: 3, code: "SALE-26400", productName: "Locker Rental", amount: 50000, status: "pending", createdAt: "2026-06-10" },
];

export const MOCK_PACKAGES = [
  { id: 1, code: "IM", name: "Individual Monthly Normal", price: 325000, lifetime: "1 month", categoryName: "Normal", highlighted: false },
  { id: 2, code: "IM3", name: "Individual 3 Month Normal", price: 870000, lifetime: "3 month", categoryName: "Normal", highlighted: true },
  { id: 3, code: "IMP", name: "Individual Monthly Promo", price: 275000, lifetime: "1 month", categoryName: "Opening Promo", highlighted: false },
  { id: 4, code: "IMG", name: "Individual Monthly Group", price: 250000, lifetime: "1 month", categoryName: "Group Exclusive", highlighted: false },
];
