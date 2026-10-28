"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { useMember } from "@/lib/member-context";
import { updateProfile } from "@/lib/actions/profile";

export default function EditProfilePage() {
  const router = useRouter();
  const member = useMember();
  const [email, setEmail] = useState(member.email ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSubmitting(true);

    const result = await updateProfile({ email });
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setSuccess(true);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <Link href="/profile" className="inline-flex items-center gap-2 text-text-secondary">
        <Icon name="chevron-left" size={16} />
        <span className="text-sm">Kembali</span>
      </Link>

      <h1 className="text-xl font-bold">Edit Profil</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">{error}</div>}
        {success && (
          <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
            Profil berhasil diperbarui.
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-medium text-text-secondary">Nama Lengkap</label>
          <p className="flex min-h-12 items-center rounded-lg border border-gray-300 bg-background-elevated px-4 py-3 text-base text-text-tertiary">
            {member.name}
          </p>
          <p className="mt-1.5 text-xs text-text-tertiary">Nama tidak dapat diubah sendiri. Hubungi admin gym untuk perubahan nama.</p>
        </div>
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="opsional" />
        <div>
          <label className="mb-2 block text-sm font-medium text-text-secondary">No. HP</label>
          <p className="flex h-12 items-center rounded-lg border border-gray-300 bg-background-elevated px-4 text-base text-text-tertiary">
            +{member.phone}
          </p>
          <p className="mt-1.5 text-xs text-text-tertiary">Nomor HP dipakai untuk login dan tidak dapat diubah sendiri.</p>
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}
        </Button>
      </form>
    </div>
  );
}
