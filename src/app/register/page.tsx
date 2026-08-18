"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { createClient } from "@/lib/supabase/client";
import { syntheticEmailFor } from "@/lib/utils";
import { registerMember } from "@/lib/actions/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Konfirmasi password tidak sama.");
      return;
    }
    if (password.length < 6) {
      setError("Password minimal 6 karakter.");
      return;
    }

    setIsSubmitting(true);
    const result = await registerMember(name, phone, password);
    if (result.error) {
      setIsSubmitting(false);
      setError(result.error);
      return;
    }

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: syntheticEmailFor(phone),
      password,
    });
    setIsSubmitting(false);
    if (signInError) {
      setError("Akun berhasil dibuat, tapi login otomatis gagal. Silakan login manual.");
      router.push("/login");
      return;
    }

    router.push("/home");
    router.refresh();
  };

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <Link href="/login" className="mb-6 inline-flex items-center gap-2 text-text-secondary">
          <Icon name="chevron-left" size={16} />
          <span className="text-sm">Kembali</span>
        </Link>

        <h1 className="mb-1 text-2xl font-bold">Create Account</h1>
        <p className="mb-8 text-sm text-text-secondary">Daftar sebagai member baru X One Fitness.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">{error}</div>
          )}

          <Input label="Nama Lengkap" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama kamu" />

          <div>
            <label className="mb-2 block text-sm font-medium whitespace-nowrap text-text-secondary">Nomor HP</label>
            <div className="flex h-12 items-center gap-2 rounded-lg border border-gray-300 bg-background-card px-3">
              <span className="shrink-0 text-sm whitespace-nowrap text-text-secondary">🇮🇩 +62</span>
              <div className="h-5 w-px shrink-0 bg-gray-300" />
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="812-3456-7890"
                className="h-full min-w-0 flex-1 bg-transparent text-base text-text-primary placeholder:text-text-tertiary focus:outline-none"
              />
            </div>
          </div>

          <Input
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimal 6 karakter"
          />
          <Input
            label="Konfirmasi Password"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Ulangi password"
          />

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Memproses..." : "Create Account"}
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-text-secondary">
          Sudah punya akun?{" "}
          <Link href="/login" className="font-semibold text-primary">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
