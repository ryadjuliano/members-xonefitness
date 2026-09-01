"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function LogoutItem() {
  const [confirming, setConfirming] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // Hard navigation — same reasoning as login: this clears auth state, so
    // a client-side push risks the next page reusing a Router Cache entry
    // fetched while still signed in.
    window.location.href = "/login";
  };

  if (confirming) {
    return (
      <div className="rounded-lg border border-error/30 bg-error/10 p-4">
        <p className="mb-3 text-sm font-medium">Yakin ingin logout?</p>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => setConfirming(false)}>
            Batal
          </Button>
          <Button variant="danger" size="sm" className="flex-1" onClick={handleLogout} disabled={isLoggingOut}>
            {isLoggingOut ? "..." : "Logout"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex w-full items-center gap-3 rounded-lg border border-error/20 bg-error/10 p-3 text-left"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-error/20">
        <Icon name="logout" size={16} className="text-error" />
      </span>
      <span className="text-sm font-medium text-error">Logout</span>
    </button>
  );
}
