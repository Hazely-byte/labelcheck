"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Navigation from "@/components/Navigation";
import ProfileScreen from "@/components/ProfileScreen";
import { Loader2 } from "lucide-react";

export default function ProfilePage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/");
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-3 bg-[var(--bg-primary)]">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
        <p style={{ color: "var(--text-muted)" }} className="text-sm">
          Loading Profile…
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col w-full max-w-full bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <Navigation />

      <main className="flex-1 w-full max-w-full pb-36">
        <ProfileScreen user={user} onSignOut={handleSignOut} />
      </main>
    </div>
  );
}
