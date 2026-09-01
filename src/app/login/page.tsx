"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { createClient } from "@/lib/supabase/client";
import { syntheticEmailFor } from "@/lib/utils";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: syntheticEmailFor(phone),
      password,
    });

    setIsSubmitting(false);
    if (signInError) {
      setError("Nomor HP atau password salah.");
      return;
    }

    // Hard navigation on purpose: right after login, a client-side
    // router.push() can land on a page still served from the Router Cache
    // (last computed while logged out), so the middleware's
    // must-change-password redirect wouldn't see the fresh session either.
    // A full page load re-evaluates everything against the just-set cookie.
    window.location.href = "/home";
  };

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center text-center">
          <Image src="/logo-v2.png" alt="X One Fitness" width={160} height={98} className="mb-4 h-auto w-40" priority />
          <h1 className="text-2xl font-bold">Welcome Back</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Masuk untuk lihat status keanggotaan kamu.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
              {error}
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium whitespace-nowrap text-text-secondary">
              Nomor HP
            </label>
            <div className="flex h-12 items-center gap-2 rounded-lg border border-gray-300 bg-background-card px-3">
              <span className="shrink-0 text-sm whitespace-nowrap text-text-secondary">
                🇮🇩 +62
              </span>
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
            type={showPassword ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-text-tertiary"
              >
                <Icon name={showPassword ? "eye-slash" : "eye"} size={18} />
              </button>
            }
          />

          <div className="text-right">
            <Link href="/forgot-password" className="text-sm text-primary">
              Lupa password?
            </Link>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Memproses..." : "Login"}
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-text-secondary">
          Belum punya akun?{" "}
          <Link href="/register" className="font-semibold text-primary">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
