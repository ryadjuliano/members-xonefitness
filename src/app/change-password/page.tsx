"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { createClient } from "@/lib/supabase/client";

export default function ChangePasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError("Password baru minimal 6 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Konfirmasi password tidak sama.");
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
      data: { must_change_password: false },
    });

    setIsSubmitting(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    // Hard navigation — same reasoning as login: this just changed auth
    // state (must_change_password flag), so a client-side push risks the
    // middleware evaluating a Router Cache entry from before the change.
    window.location.href = "/home";
  };

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-warning/15">
            <Icon name="lock" size={28} className="text-warning" />
          </div>
          <h1 className="text-xl font-bold">Buat Password Baru</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Ini pertama kali kamu login. Demi keamanan, silakan buat password baru sebelum melanjutkan.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">{error}</div>
          )}
          <Input
            label="Password Baru"
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Minimal 6 karakter"
          />
          <Input
            label="Konfirmasi Password Baru"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Ulangi password baru"
          />
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Menyimpan..." : "Simpan & Lanjutkan"}
          </Button>
        </form>
      </div>
    </div>
  );
}
