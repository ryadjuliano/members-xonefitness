"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn, formatDate, formatIDR } from "@/lib/utils";

export type TransactionRow = { id: number; code: string; productName: string; amount: number; status: string; createdAt: string };
export type AttendanceRow = { id: number; checkedInAt: string; checkedOutAt: string | null };

export function HistoryTabs({
  transactions,
  attendance,
}: {
  transactions: TransactionRow[];
  attendance: AttendanceRow[];
}) {
  const [tab, setTab] = useState<"transactions" | "attendance">("transactions");

  const paidCount = transactions.filter((t) => t.status === "paid").length;
  const totalPaid = transactions.filter((t) => t.status === "paid").reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex rounded-full border border-gray-200 bg-background-card p-1">
        <button
          onClick={() => setTab("transactions")}
          className={cn(
            "flex-1 rounded-full py-2 text-sm font-medium transition-colors",
            tab === "transactions" ? "bg-primary text-text-on-primary" : "text-text-secondary",
          )}
        >
          Transaksi
        </button>
        <button
          onClick={() => setTab("attendance")}
          className={cn(
            "flex-1 rounded-full py-2 text-sm font-medium transition-colors",
            tab === "attendance" ? "bg-primary text-text-on-primary" : "text-text-secondary",
          )}
        >
          Kehadiran
        </button>
      </div>

      {tab === "transactions" ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <SummaryTile value={transactions.length} label="Total" />
            <SummaryTile value={paidCount} label="Lunas" />
            <SummaryTile value={formatIDR(totalPaid)} label="Total Bayar" small />
          </div>
          <div className="space-y-2">
            {transactions.length === 0 && <EmptyState label="Belum ada transaksi." />}
            {transactions.map((t) => (
              <Card key={t.id} className="flex items-center gap-3 p-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Icon name="credit-card" size={16} className="text-primary" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.productName}</p>
                  <p className="text-xs text-text-tertiary">{formatDate(t.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatIDR(t.amount)}</p>
                  <StatusBadge status={t.status} />
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <SummaryTile value={attendance.length} label="Total Visit" />
            <SummaryTile
              value={attendance.filter((a) => new Date(a.checkedInAt).getMonth() === new Date().getMonth()).length}
              label="Bulan Ini"
            />
            <SummaryTile
              value={`${Math.round(
                (attendance.filter((a) => a.checkedOutAt).reduce((sum, a) => sum + (new Date(a.checkedOutAt!).getTime() - new Date(a.checkedInAt).getTime()) / 60000, 0) /
                  Math.max(attendance.filter((a) => a.checkedOutAt).length, 1)) || 0,
              )}m`}
              label="Rata-rata"
              small
            />
          </div>
          <div className="space-y-2">
            {attendance.length === 0 && <EmptyState label="Belum ada riwayat kehadiran." />}
            {attendance.map((a) => (
              <Card key={a.id} className="flex items-center gap-3 p-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Icon name="dumbbell" size={16} className="text-primary" />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium">Gym Visit</p>
                  <p className="text-xs text-text-tertiary">{formatDate(a.checkedInAt)}</p>
                </div>
                <span className="text-sm text-text-secondary">
                  {new Date(a.checkedInAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryTile({ value, label, small }: { value: number | string; label: string; small?: boolean }) {
  return (
    <Card className="flex min-w-0 flex-col items-center gap-1 p-3 text-center">
      <span className={cn("max-w-full truncate font-bold", small ? "text-sm" : "text-lg")}>{value}</span>
      <span className="max-w-full truncate text-[11px] whitespace-nowrap text-text-tertiary">{label}</span>
    </Card>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="rounded-lg border border-gray-200 bg-background-card p-4 text-center text-sm text-text-secondary">{label}</p>;
}
