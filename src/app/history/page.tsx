"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Navigation from "@/components/Navigation";
import HistoryScreen from "@/components/HistoryScreen";
import ResultsScreen from "@/components/ResultsScreen";
import type { AnalysisResponse } from "@/lib/types";
import { Loader2 } from "lucide-react";

export default function HistoryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [selectedScan, setSelectedScan] = useState<AnalysisResponse | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-3 bg-[var(--bg-primary)]">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
        <p style={{ color: "var(--text-muted)" }} className="text-sm">
          Loading History…
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col w-full max-w-full bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <Navigation />

      <main className="flex-1 w-full max-w-full pb-36">
        {selectedScan ? (
          <ResultsScreen
            data={selectedScan}
            onReset={() => setSelectedScan(null)}
          />
        ) : (
          <HistoryScreen
            onSelectScan={(data) => setSelectedScan(data)}
            onBackToScan={() => router.push("/scanner")}
          />
        )}
      </main>
    </div>
  );
}
