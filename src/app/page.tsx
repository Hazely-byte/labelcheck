"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { User } from "@supabase/supabase-js";
import { Scan, History, LogOut, Loader2, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import LoginScreen from "@/components/LoginScreen";
import UploadScreen from "@/components/UploadScreen";
import ResultsScreen from "@/components/ResultsScreen";
import HistoryScreen from "@/components/HistoryScreen";
import type { AnalysisResponse } from "@/lib/types";

type Screen = "login" | "scan" | "results" | "history";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("login");
  const [analysisData, setAnalysisData] = useState<AnalysisResponse | null>(null);
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
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleResults = async (data: AnalysisResponse) => {
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
          } else {
            console.log("Scan successfully saved to Supabase.");
          }
        } catch (err) {
          console.error("Auto-save exception:", err);
        }
      }
    }
  };

  const handleSelectHistoricalScan = (data: AnalysisResponse) => {
    setAnalysisData(data);
    setScreen("results");
  };

  const handleResetScan = () => {
    setAnalysisData(null);
    setScreen("scan");
  };

  const handleSignOut = async () => {
    try {
      setLoggingOut(true);
      const supabase = createClient();
      await supabase.auth.signOut();
      setUser(null);
      setAnalysisData(null);
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
          className="border-b sticky top-0 z-50 backdrop-blur-md px-4 py-3"
          style={{
            background: "rgba(15, 15, 20, 0.85)",
            borderColor: "var(--bg-card-hover)",
          }}
        >
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            {/* Logo */}
            <button
              onClick={() => setScreen("scan")}
              className="flex items-center gap-2 font-bold text-lg cursor-pointer"
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
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Scan Nav button */}
              <button
                onClick={() => setScreen("scan")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  screen === "scan" || screen === "results"
                    ? "text-white"
                    : "text-[var(--text-secondary)] hover:text-white"
                }`}
                style={{
                  background:
                    screen === "scan" || screen === "results"
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
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  screen === "history"
                    ? "text-white"
                    : "text-[var(--text-secondary)] hover:text-white"
                }`}
                style={{
                  background:
                    screen === "history" ? "var(--bg-card)" : "transparent",
                }}
              >
                <History className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                <span>History</span>
              </button>

              {/* User Email Badge */}
              <span
                className="hidden md:inline-block text-xs px-2.5 py-1 rounded-full truncate max-w-[160px]"
                style={{
                  background: "var(--bg-secondary)",
                  color: "var(--text-muted)",
                }}
                title={user.email ?? ""}
              >
                {user.email}
              </span>

              {/* Logout Button */}
              <button
                onClick={handleSignOut}
                disabled={loggingOut}
                title="Log out"
                className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:cursor-wait"
                style={{
                  color: "var(--text-muted)",
                  background: "var(--bg-card)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--red)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
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
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
            >
              <LoginScreen />
            </motion.div>
          )}

          {screen === "scan" && (
            <motion.div
              key="scan"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
            >
              <UploadScreen
                onResults={handleResults}
                onBack={() => setScreen("history")}
              />
            </motion.div>
          )}

          {screen === "results" && analysisData?.result && (
            <motion.div
              key="results"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
            >
              <ResultsScreen data={analysisData} onReset={handleResetScan} />
            </motion.div>
          )}

          {screen === "history" && (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
            >
              <HistoryScreen
                onSelectScan={handleSelectHistoricalScan}
                onBackToScan={() => setScreen("scan")}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
