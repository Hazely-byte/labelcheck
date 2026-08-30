"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Navigation from "@/components/Navigation";
import ProductsScreen from "@/components/ProductsScreen";
import FullResultsScreen from "@/components/FullResultsScreen";
import type { FullScanMergedResult } from "@/lib/types";
import { Loader2 } from "lucide-react";

export default function ProductsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [selectedScanResult, setSelectedScanResult] = useState<FullScanMergedResult | null>(null);

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
          Loading Products Catalog…
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col w-full max-w-full bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <Navigation />

      <main className="flex-1 w-full max-w-full pb-36">
        {selectedScanResult ? (
          <FullResultsScreen
            data={selectedScanResult}
            onReset={() => setSelectedScanResult(null)}
            onViewProducts={() => setSelectedScanResult(null)}
          />
        ) : (
          <ProductsScreen
            userId={user.id}
            onSelectProductScan={(res) => setSelectedScanResult(res)}
            onBackToScanner={() => router.push("/scanner")}
          />
        )}
      </main>
    </div>
  );
}
