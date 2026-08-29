"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { User } from "@supabase/supabase-js";
import { Scan, History, LogOut, Loader2, Sparkles, FolderTree } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import LoginScreen from "@/components/LoginScreen";
import UploadScreen from "@/components/UploadScreen";
import ResultsScreen from "@/components/ResultsScreen";
import HistoryScreen from "@/components/HistoryScreen";
import FullScanCamera from "@/components/FullScanCamera";
import FullResultsScreen from "@/components/FullResultsScreen";
import ProductsScreen from "@/components/ProductsScreen";
import { saveProductScanWithDeduplication } from "@/lib/productService";
import type {
  AnalysisResponse,
  FullScanMergedResult,
  Product,
} from "@/lib/types";

type Screen =
  | "login"
  | "scan"
  | "full_scan"
  | "results"
  | "full_results"
  | "history"
  | "products";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("login");
  const [analysisData, setAnalysisData] = useState<AnalysisResponse | null>(null);
  const [fullScanData, setFullScanData] = useState<FullScanMergedResult | null>(null);
  const [savedProduct, setSavedProduct] = useState<Product | null>(null);
  const [ambiguousCandidate, setAmbiguousCandidate] = useState<Product | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // Check current active session
    supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      setUser(currentUser);
      if (currentUser) {
        setScreen("scan");
      } else {
        setScreen("login");
      }
      setAuthLoading(false);
    });

    // Listen to live auth state transitions
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const activeUser = session?.user ?? null;
      setUser(activeUser);
      if (activeUser) {
        setScreen((prev) => (prev === "login" ? "scan" : prev));
      } else {
        setScreen("login");
        setAnalysisData(null);
        setFullScanData(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Quick Scan Result Handler (Preserved 100%)
  const handleQuickResults = async (data: AnalysisResponse) => {
    if (data && data.result) {
      setAnalysisData(data);
      setScreen("results");

      // Auto-save silently to Supabase if authenticated
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
            console.error("Auto-save scan error:", error.message);
          }
        } catch (err) {
          console.error("Auto-save exception:", err);
        }
      }
    }
  };

  // Full Product Scan Result Handler
  const handleFullScanResults = async (mergedResult: FullScanMergedResult) => {
    setFullScanData(mergedResult);
    setScreen("full_results");

    if (user) {
      try {
        const decision = await saveProductScanWithDeduplication(user.id, mergedResult);
        if (decision.status === "requires_choice" && decision.ambiguousCandidate) {
          setAmbiguousCandidate(decision.ambiguousCandidate);
        } else if (decision.product) {
          setSavedProduct(decision.product);
          setAmbiguousCandidate(null);
        }
      } catch (err) {
        console.error("Failed to auto-save Full Product scan:", err);
      }
    }
  };

  // Handle Ambiguity Resolution on Deduplication
  const handleResolveAmbiguity = async (
    choice: "link_existing" | "create_new",
    targetProductId?: string
  ) => {
    if (!user || !fullScanData) return;
    try {
      const decision = await saveProductScanWithDeduplication(user.id, fullScanData, {
        forcedChoice: choice,
        targetProductId,
      });
      if (decision.product) {
        setSavedProduct(decision.product);
        setAmbiguousCandidate(null);
      }
    } catch (err) {
      console.error("Error resolving deduplication ambiguity:", err);
    }
  };

  const handleSelectHistoricalQuickScan = (data: AnalysisResponse) => {
    setAnalysisData(data);
    setScreen("results");
  };

  const handleSelectProductScan = (data: FullScanMergedResult) => {
    setFullScanData(data);
    setScreen("full_results");
  };

  const handleResetScan = () => {
    setAnalysisData(null);
    setFullScanData(null);
    setSavedProduct(null);
    setAmbiguousCandidate(null);
    setScreen("scan");
  };

  const handleSignOut = async () => {
    try {
      setLoggingOut(true);
      const supabase = createClient();
      await supabase.auth.signOut();
      setUser(null);
      setAnalysisData(null);
      setFullScanData(null);
      setScreen("login");
    } catch (err) {
      console.error("Sign out error:", err);
    } finally {
      setLoggingOut(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
        <p style={{ color: "var(--text-muted)" }} className="text-sm">
          Loading LabelCheck…
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Navigation Bar (Visible when user is authenticated) */}
      {user && (
        <header
          className="border-b sticky top-0 z-50 backdrop-blur-md px-4 py-2.5"
          style={{
            background: "rgba(15, 15, 20, 0.85)",
            borderColor: "var(--bg-card-hover)",
          }}
        >
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
            {/* Logo */}
            <button
              onClick={handleResetScan}
              className="flex items-center gap-2 font-bold text-base sm:text-lg cursor-pointer"
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
                style={{ background: "var(--accent)" }}
              >
                <Scan className="w-4 h-4" />
              </div>
              <span>
                Label<span style={{ color: "var(--accent)" }}>Check</span>
              </span>
            </button>

            {/* Navigation links & User actions */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Scanner Nav button */}
              <button
                onClick={() => setScreen("scan")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  screen === "scan" ||
                  screen === "full_scan" ||
                  screen === "results" ||
                  screen === "full_results"
                    ? "text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
                style={{
                  background:
                    screen === "scan" ||
                    screen === "full_scan" ||
                    screen === "results" ||
                    screen === "full_results"
                      ? "var(--bg-card)"
                      : "transparent",
                }}
              >
                <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                <span>Scanner</span>
              </button>

              {/* History Nav button */}
              <button
                onClick={() => setScreen("history")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  screen === "history" ? "text-white" : "text-zinc-400 hover:text-white"
                }`}
                style={{
                  background: screen === "history" ? "var(--bg-card)" : "transparent",
                }}
              >
                <History className="w-3.5 h-3.5 text-amber-400" />
                <span>History</span>
              </button>

              {/* Products Nav button */}
              <button
                onClick={() => setScreen("products")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  screen === "products" ? "text-white" : "text-zinc-400 hover:text-white"
                }`}
                style={{
                  background: screen === "products" ? "var(--bg-card)" : "transparent",
                }}
              >
                <FolderTree className="w-3.5 h-3.5 text-purple-400" />
                <span>Products</span>
              </button>

              {/* User Email Badge */}
              <span
                className="hidden lg:inline-block text-xs px-2.5 py-1 rounded-full truncate max-w-[140px] text-zinc-400 bg-zinc-900 border border-zinc-800"
                title={user.email ?? ""}
              >
                {user.email}
              </span>

              {/* Logout Button */}
              <button
                onClick={handleSignOut}
                disabled={loggingOut}
                title="Log out"
                className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:cursor-wait text-zinc-400 hover:text-red-400 bg-zinc-900 border border-zinc-800"
              >
                {loggingOut ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <LogOut className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Main Content Area with Transitions */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          {screen === "login" && (
            <motion.div
              key="login"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <LoginScreen />
            </motion.div>
          )}

          {screen === "scan" && (
            <motion.div
              key="scan"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <UploadScreen
                onResults={handleQuickResults}
                onBack={() => setScreen("history")}
                onSwitchToFullScan={() => setScreen("full_scan")}
              />
            </motion.div>
          )}

          {screen === "full_scan" && (
            <motion.div
              key="full_scan"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <FullScanCamera
                onResultsReady={handleFullScanResults}
                onBackToQuickScan={() => setScreen("scan")}
              />
            </motion.div>
          )}

          {screen === "results" && analysisData?.result && (
            <motion.div
              key="results"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <ResultsScreen data={analysisData} onReset={handleResetScan} />
            </motion.div>
          )}

          {screen === "full_results" && fullScanData && (
            <motion.div
              key="full_results"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <FullResultsScreen
                data={fullScanData}
                onReset={handleResetScan}
                onViewProducts={() => setScreen("products")}
                savedProduct={savedProduct}
                ambiguousCandidate={ambiguousCandidate}
                onResolveAmbiguity={handleResolveAmbiguity}
              />
            </motion.div>
          )}

          {screen === "history" && (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <HistoryScreen
                onSelectScan={handleSelectHistoricalQuickScan}
                onBackToScan={() => setScreen("scan")}
              />
            </motion.div>
          )}

          {screen === "products" && user && (
            <motion.div
              key="products"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <ProductsScreen
                userId={user.id}
                onSelectProductScan={handleSelectProductScan}
                onBackToScanner={() => setScreen("scan")}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
