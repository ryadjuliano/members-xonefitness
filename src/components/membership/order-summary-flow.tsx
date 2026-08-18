"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { createOrder, uploadPaymentProof } from "@/lib/actions/orders";
import { BANK_TRANSFER, WHATSAPP_ADMIN_NUMBER } from "@/lib/constants";
import { cn, formatIDR } from "@/lib/utils";

type Method = "transfer" | "qris" | "cash";

const METHODS: { value: Method; label: string; icon: IconName }[] = [
  { value: "transfer", label: "Transfer", icon: "building" },
  { value: "qris", label: "QRIS", icon: "qrcode" },
  { value: "cash", label: "Cash", icon: "money-bill" },
];

export function OrderSummaryFlow({
  productId,
  productName,
  price,
  memberName,
}: {
  productId: number;
  productName: string;
  price: number;
  memberName: string;
}) {
  const [method, setMethod] = useState<Method>("transfer");
  const [order, setOrder] = useState<{ id: number; code: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofUploaded, setProofUploaded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    const result = await createOrder(productId, method);
    setIsSubmitting(false);
    if (result.error || !result.data) {
      setError(result.error ?? "Gagal membuat pesanan.");
      return;
    }
    setOrder({ id: result.data.orderId, code: result.data.code });
  };

  const handleUploadProof = async () => {
    if (!order || !proofFile) return;
    setIsUploading(true);
    setError(null);
    const formData = new FormData();
    formData.set("file", proofFile);
    const result = await uploadPaymentProof(order.id, formData);
    setIsUploading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setProofUploaded(true);
  };

  const waMessage = encodeURIComponent(
    `Halo admin X One Fitness, saya ${memberName} sudah melakukan pembayaran untuk paket "${productName}" (${formatIDR(price)}).${
      order ? ` No. pesanan: ${order.code}.` : ""
    } Mohon dikonfirmasi. Terima kasih.`,
  );

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold">{productName}</p>
            {order && <p className="mt-0.5 text-xs text-text-tertiary">No. Pesanan: {order.code}</p>}
          </div>
          {order && <StatusBadge status="pending" />}
        </div>
        <p className="mt-2 text-lg font-extrabold text-primary">{formatIDR(price)}</p>
      </Card>

      {error && <div className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">{error}</div>}

      <div>
        <p className="mb-2 text-sm font-semibold text-text-secondary">Metode Pembayaran</p>
        <div className="grid grid-cols-3 gap-2">
          {METHODS.map((m) => (
            <button
              key={m.value}
              disabled={!!order}
              onClick={() => setMethod(m.value)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border p-3 disabled:opacity-60",
                method === m.value ? "border-primary bg-primary/10" : "border-gray-200 bg-background-card",
              )}
            >
              <Icon name={m.icon} size={18} className={method === m.value ? "text-primary" : "text-text-secondary"} />
              <span className="text-xs font-medium">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {!order ? (
        <Button className="w-full" onClick={handleConfirm} disabled={isSubmitting}>
          {isSubmitting ? "Memproses..." : "Konfirmasi Pesanan"}
        </Button>
      ) : (
        <>
          {method === "transfer" && (
            <Card className="p-4">
              <p className="mb-2 text-sm font-semibold">Instruksi Transfer Bank</p>
              <p className="text-sm text-text-secondary">
                {BANK_TRANSFER.bankName} — {BANK_TRANSFER.accountNumber}
              </p>
              <p className="text-sm text-text-secondary">a.n. {BANK_TRANSFER.accountHolder}</p>
              <ol className="mt-3 list-decimal space-y-1 pl-4 text-xs text-text-tertiary">
                <li>Transfer sejumlah {formatIDR(price)} ke rekening di atas.</li>
                <li>Simpan bukti transfer.</li>
                <li>Upload bukti transfer di bawah ini.</li>
              </ol>
            </Card>
          )}
          {method === "qris" && (
            <Card className="flex flex-col items-center gap-2 p-6">
              <Icon name="qrcode" size={64} className="text-text-tertiary" />
              <p className="text-sm text-text-secondary">Scan QRIS ini di kasir gym untuk membayar.</p>
            </Card>
          )}
          {method === "cash" && (
            <Card className="p-4">
              <p className="text-sm text-text-secondary">Silakan bayar tunai langsung ke staff gym saat kunjungan berikutnya.</p>
            </Card>
          )}

          {method !== "cash" && (
            <div>
              <p className="mb-2 text-sm font-semibold text-text-secondary">Upload Bukti Pembayaran</p>
              {proofUploaded ? (
                <Card className="flex items-center gap-3 p-4">
                  <Icon name="check-circle" size={20} className="text-success" />
                  <span className="text-sm">Bukti pembayaran terupload.</span>
                </Card>
              ) : (
                <>
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-background-card px-4 py-6 text-center">
                    <Icon name="cloud-upload" size={24} className="text-text-tertiary" />
                    <span className="text-sm text-text-secondary">
                      {proofFile ? proofFile.name : "Ambil foto atau pilih file bukti pembayaran"}
                    </span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <Button className="mt-3 w-full" variant="outline" disabled={!proofFile || isUploading} onClick={handleUploadProof}>
                    {isUploading ? "Mengupload..." : "Upload Bukti"}
                  </Button>
                </>
              )}
            </div>
          )}

          <a
            href={`https://wa.me/${WHATSAPP_ADMIN_NUMBER}?text=${waMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-success px-2 text-center text-sm font-semibold whitespace-nowrap text-black"
          >
            <Icon name="whatsapp" size={18} />
            Konfirmasi via WhatsApp
          </a>
        </>
      )}
    </div>
  );
}
