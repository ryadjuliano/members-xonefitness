"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { checkIn, checkOut, uploadCheckinSelfie } from "@/lib/actions/checkin";
import { QrScanner } from "@/components/checkin/qr-scanner";
import { SelfieCamera } from "@/components/checkin/selfie-camera";

type TodayStatus = { id: number; checkedInAt: string; checkedOutAt: string | null } | null;
type Step = "idle" | "scanning" | "selfie" | "uploading" | "done-in" | "done-out";

export function CheckinPanel({ initialStatus }: { initialStatus: TodayStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [step, setStep] = useState<Step>("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCheckinId, setPendingCheckinId] = useState<number | null>(null);

  const isCheckedIn = !!status && !status.checkedOutAt;

  const handleQrDecode = async (text: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    const result = await checkIn(text);
    setIsSubmitting(false);
    if (result.error || !result.data) {
      setError(result.error ?? "Gagal check-in.");
      setStep("idle");
      return;
    }
    setStatus({ id: result.data.id, checkedInAt: result.data.checked_in_at, checkedOutAt: null });
    setPendingCheckinId(result.data.id);
    router.refresh();
    setStep("selfie");
  };

  const handleSelfieCapture = async (blob: Blob) => {
    if (!pendingCheckinId) return;
    setStep("uploading");
    setError(null);
    const formData = new FormData();
    formData.set("file", blob, "selfie.jpg");
    const result = await uploadCheckinSelfie(pendingCheckinId, formData);
    if (result.error) {
      setError(result.error);
      setStep("selfie");
      return;
    }
    setStep("done-in");
  };

  const handleCheckOut = async () => {
    if (!status) return;
    setIsSubmitting(true);
    setError(null);
    const result = await checkOut(status.id);
    setIsSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setStatus({ ...status, checkedOutAt: new Date().toISOString() });
    setStep("done-out");
    router.refresh();
  };

  if (step === "done-in" || step === "done-out") {
    return (
      <Card className="flex flex-col items-center gap-4 p-8 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15">
          <Icon name="check-circle" size={32} className="text-success" />
        </span>
        <div>
          <h2 className="text-lg font-bold">{step === "done-in" ? "Check-in Berhasil" : "Check-out Berhasil"}</h2>
          <p className="mt-1 text-sm text-text-secondary">
            {new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
        <Button className="w-full" onClick={() => setStep("idle")}>
          Selesai
        </Button>
      </Card>
    );
  }

  if (step === "scanning") {
    return (
      <Card className="flex flex-col items-center gap-4 p-6 text-center">
        <div>
          <h2 className="text-lg font-bold">Scan QR Gym</h2>
          <p className="mt-1 text-sm text-text-secondary">Arahkan kamera ke QR code di meja depan gym.</p>
        </div>
        <QrScanner onDecode={handleQrDecode} onError={(msg) => setError(msg)} />
        {error && <p className="w-full rounded-lg border border-error/30 bg-error/10 px-4 py-2 text-sm text-error">{error}</p>}
        <Button className="w-full" variant="outline" onClick={() => setStep("idle")} disabled={isSubmitting}>
          Batal
        </Button>
      </Card>
    );
  }

  if (step === "selfie" || step === "uploading") {
    return (
      <Card className="flex flex-col items-center gap-4 p-6 text-center">
        <div>
          <h2 className="text-lg font-bold">Foto Selfie Absen</h2>
          <p className="mt-1 text-sm text-text-secondary">Check-in berhasil! Ambil foto selfie untuk melengkapi absensi.</p>
        </div>
        {step === "uploading" ? (
          <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-background-elevated">
            <p className="text-sm text-text-secondary">Mengunggah foto...</p>
          </div>
        ) : (
          <SelfieCamera onCapture={handleSelfieCapture} onError={(msg) => setError(msg)} />
        )}
        {error && <p className="w-full rounded-lg border border-error/30 bg-error/10 px-4 py-2 text-sm text-error">{error}</p>}
        <Button className="w-full" variant="ghost" onClick={() => setStep("done-in")} disabled={step === "uploading"}>
          Lewati foto
        </Button>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col items-center gap-6 p-8 text-center">
      <span className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
        <Icon name="dumbbell" size={40} className="text-primary" />
      </span>

      {error && <p className="w-full rounded-lg border border-error/30 bg-error/10 px-4 py-2 text-sm text-error">{error}</p>}

      {isCheckedIn ? (
        <>
          <div>
            <p className="text-sm text-text-secondary">Kamu check-in pada</p>
            <p className="text-lg font-bold">
              {new Date(status!.checkedInAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <Button className="w-full" variant="outline" onClick={handleCheckOut} disabled={isSubmitting}>
            {isSubmitting ? "Memproses..." : "Check-Out"}
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-text-secondary">Kamu belum check-in hari ini.</p>
          <Button
            className="w-full"
            onClick={() => {
              setError(null);
              setStep("scanning");
            }}
          >
            Scan QR untuk Check-In
          </Button>
        </>
      )}
    </Card>
  );
}
