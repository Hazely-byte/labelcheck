"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Navigation from "@/components/Navigation";
import UploadScreen from "@/components/UploadScreen";
import ResultsScreen from "@/components/ResultsScreen";
import FullScanCamera from "@/components/FullScanCamera";
import FullResultsScreen from "@/components/FullResultsScreen";
import { saveProductScanWithDeduplication } from "@/lib/productService";
import { createClient } from "@/lib/supabaseClient";
import type {
  AnalysisResponse,
  FullScanMergedResult,
  Product,
  ProductScan,
} from "@/lib/types";
import { Loader2 } from "lucide-react";

type ScannerMode = "quick" | "full" | "quick_results" | "full_results";

export default function ScannerPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Default to Full Product Scan
  const [mode, setMode] = useState<ScannerMode>("full");
  const [quickData, setQuickData] = useState<AnalysisResponse | null>(null);
  const [fullData, setFullData] = useState<FullScanMergedResult | null>(null);
  const [savedProduct, setSavedProduct] = useState<Product | null>(null);
  const [ambiguousCandidate, setAmbiguousCandidate] = useState<Product | null>(null);
  const [duplicateBatchScan, setDuplicateBatchScan] = useState<ProductScan | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  // Quick Scan Result Handler
  const handleQuickResults = async (data: AnalysisResponse) => {
    if (data && data.result) {
      setQuickData(data);
      setMode("quick_results");

      if (user) {
        try {
          const supabase = createClient();
          const { error } = await supabase.from("scans").insert({
            user_id: user.id,
            response_time_ms: data.responseTimeMs,
            priority_fields: data.result.priorityFields,
            additional_findings: data.result.additionalFindings,
          });
          if (error) {
            console.error("Auto-save quick scan error:", error.message);
          }
        } catch (err) {
          console.error("Auto-save exception:", err);
        }
      }
    }
  };

  // Full Product Scan Result Handler
  const handleFullResults = async (mergedResult: FullScanMergedResult) => {
    setFullData(mergedResult);
    setMode("full_results");

    if (user) {
      try {
        const decision = await saveProductScanWithDeduplication(user.id, mergedResult);
        if (decision.status === "batch_already_inspected" && decision.existingScan && decision.product) {
          setSavedProduct(decision.product);
          setDuplicateBatchScan(decision.existingScan);
          setAmbiguousCandidate(null);
        } else if (decision.status === "requires_choice" && decision.ambiguousCandidate) {
          setAmbiguousCandidate(decision.ambiguousCandidate);
          setDuplicateBatchScan(null);
        } else if (decision.product) {
          setSavedProduct(decision.product);
          setAmbiguousCandidate(null);
          setDuplicateBatchScan(null);
        }
      } catch (err) {
        console.error("Failed to auto-save Full Product scan:", err);
      }
    }
  };

  // Resolve Ambiguity on Deduplication
  const handleResolveAmbiguity = async (
    choice: "link_existing" | "create_new",
    targetProductId?: string
  ) => {
    if (!user || !fullData) return;
    try {
      const decision = await saveProductScanWithDeduplication(user.id, fullData, {
        forcedChoice: choice,
        targetProductId,
      });
      if (decision.status === "batch_already_inspected" && decision.existingScan && decision.product) {
        setSavedProduct(decision.product);
        setDuplicateBatchScan(decision.existingScan);
        setAmbiguousCandidate(null);
      } else if (decision.product) {
        setSavedProduct(decision.product);
        setAmbiguousCandidate(null);
        setDuplicateBatchScan(null);
      }
    } catch (err) {
      console.error("Error resolving deduplication ambiguity:", err);
    }
  };

  // Resolve Duplicate Batch Re-Scan Action
  const handleResolveDuplicateBatch = async (action: "view_existing" | "save_anyway") => {
    if (action === "view_existing" && duplicateBatchScan?.checklist_results) {
      // Load previous inspection report into view and dismiss prompt
      setFullData(duplicateBatchScan.checklist_results);
      setDuplicateBatchScan(null);
    } else if (action === "save_anyway" && user && fullData) {
      try {
        const decision = await saveProductScanWithDeduplication(user.id, fullData, {
          forceBatchSave: true,
          targetProductId: savedProduct?.id,
        });
        if (decision.product) {
          setSavedProduct(decision.product);
        }
        setDuplicateBatchScan(null);
      } catch (err) {
        console.error("Error saving new re-check:", err);
      }
    }
  };

  const handleReset = () => {
    setQuickData(null);
    setFullData(null);
    setSavedProduct(null);
    setAmbiguousCandidate(null);
    setDuplicateBatchScan(null);
    setMode("full");
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-3 bg-[var(--bg-primary)]">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
        <p style={{ color: "var(--text-muted)" }} className="text-sm">
          Loading Scanner…
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col w-full max-w-full bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <Navigation />

      <main className="flex-1 w-full max-w-full pb-36">
        {mode === "full" && (
          <FullScanCamera
            onResultsReady={handleFullResults}
            onBackToQuickScan={() => setMode("quick")}
          />
        )}

        {mode === "quick" && (
          <UploadScreen
            onResults={handleQuickResults}
            onBack={() => router.push("/history")}
            onSwitchToFullScan={() => setMode("full")}
          />
        )}

        {mode === "full_results" && fullData && (
          <FullResultsScreen
            data={fullData}
            onReset={handleReset}
            onViewProducts={() => router.push("/products")}
            savedProduct={savedProduct}
            ambiguousCandidate={ambiguousCandidate}
            onResolveAmbiguity={handleResolveAmbiguity}
            duplicateBatchScan={duplicateBatchScan}
            onResolveDuplicateBatch={handleResolveDuplicateBatch}
          />
        )}

        {mode === "quick_results" && quickData?.result && (
          <ResultsScreen data={quickData} onReset={handleReset} />
        )}
      </main>
    </div>
  );
}
