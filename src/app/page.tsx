"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import LoginScreen from "@/components/LoginScreen";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/scanner");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-3 bg-[var(--bg-primary)]">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
        <p style={{ color: "var(--text-muted)" }} className="text-sm">
          Loading LabelCheck…
        </p>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return <LoginScreen />;
}
