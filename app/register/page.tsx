"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    // KRISHIDHENU uses passwordless mobile OTP authentication.
    // Redirect to the streamlined login & registration flow.
    router.replace("/login");
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-surface">
      <div className="text-center text-ink-faint text-sm">
        Redirecting to KRISHIDHENU login...
      </div>
    </main>
  );
}
