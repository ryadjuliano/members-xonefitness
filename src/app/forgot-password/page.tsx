import Link from "next/link";
import { Icon } from "@/components/ui/icon";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
          <Icon name="lock" size={28} className="text-primary" />
        </div>
        <h1 className="text-xl font-bold">Lupa Password?</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Reset password mandiri belum tersedia. Hubungi staff di gym untuk mengatur ulang password kamu.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-flex h-12 w-full items-center justify-center whitespace-nowrap rounded-full bg-primary px-5 text-base font-semibold text-text-on-primary active:bg-primary-dark"
        >
          Kembali ke Login
        </Link>
      </div>
    </div>
  );
}
