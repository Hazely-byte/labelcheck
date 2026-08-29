"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Loader2,
  Calendar,
  Sparkles,
  Inbox,
} from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import type { SavedScanRecord, AnalysisResponse } from "@/lib/types";

interface HistoryScreenProps {
  onSelectScan: (data: AnalysisResponse) => void;
  onBackToScan: () => void;
}

export default function HistoryScreen({ onSelectScan, onBackToScan }: HistoryScreenProps) {
  const [scans, setScans] = useState<SavedScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScans = async () => {
    try {
      setLoading(true);
      setError(null);
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from("scans")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setScans((data as SavedScanRecord[]) || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load scan history";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function loadScans() {
      try {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from("scans")
          .select("*")
          .order("created_at", { ascending: false });

        if (fetchError) throw fetchError;
        if (isMounted) {
          setScans((data as SavedScanRecord[]) || []);
          setError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : "Failed to load scan history";
          setError(msg);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadScans();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCardClick = (scan: SavedScanRecord) => {
    const formattedResponse: AnalysisResponse = {
      result: {
        priorityFields: scan.priority_fields || [],
        additionalFindings: scan.additional_findings || [],
      },
      responseTimeMs: scan.response_time_ms || 0,
    };
    onSelectScan(formattedResponse);
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="min-h-screen p-4 pt-8 pb-20">
      <div className="max-w-2xl mx-auto">
        {/* Top Header */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <button
            onClick={onBackToScan}
            className="flex items-center gap-2 text-sm mb-4 transition-colors cursor-pointer"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Scanner
          </button>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h1 className="text-2xl md:text-3xl font-bold">Inspection History</h1>
            <span
              className="text-xs px-3 py-1.5 rounded-full font-medium"
              style={{ background: "var(--bg-card)", color: "var(--text-secondary)" }}
            >
              {scans.length} {scans.length === 1 ? "Scan" : "Scans"} Saved
            </span>
          </div>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
            Review and reopen past compliance inspection reports.
          </p>
        </motion.div>

        {/* Loading State */}
        {loading && (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
            <p style={{ color: "var(--text-muted)" }} className="text-sm">
              Loading your scan records…
            </p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-5 rounded-2xl border text-center"
            style={{ background: "var(--red-bg)", borderColor: "rgba(240, 71, 71, 0.3)" }}
          >
            <p style={{ color: "var(--red)" }} className="text-sm font-semibold mb-2">
              {error}
            </p>
            <button
              onClick={fetchScans}
              className="text-xs underline cursor-pointer"
              style={{ color: "var(--text-primary)" }}
            >
              Retry
            </button>
          </motion.div>
        )}

        {/* Empty State */}
        {!loading && !error && scans.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-16 px-6 rounded-2xl border text-center"
            style={{ background: "var(--bg-card)", borderColor: "var(--bg-card-hover)" }}
          >
            <div
              className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center mb-4"
              style={{ background: "rgba(124, 92, 252, 0.15)" }}
            >
              <Inbox className="w-6 h-6" style={{ color: "var(--accent)" }} />
            </div>
            <h2 className="text-lg font-bold mb-1">No Past Scans Yet</h2>
            <p style={{ color: "var(--text-muted)" }} className="text-sm max-w-sm mx-auto mb-6">
              When you analyze a product label, the full compliance report will automatically be saved to your account.
            </p>
            <button
              onClick={onBackToScan}
              className="px-6 py-2.5 rounded-xl font-medium text-sm transition-all cursor-pointer text-white"
              style={{ background: "var(--accent)", boxShadow: "0 0 20px var(--accent-glow)" }}
            >
              Scan a Label Now
            </button>
          </motion.div>
        )}

        {/* Scans List */}
        {!loading && !error && scans.length > 0 && (
          <div className="space-y-3">
            <AnimatePresence>
              {scans.map((scan, idx) => {
                const priority = scan.priority_fields || [];
                const detectedCount = priority.filter((f) => f && f.status === "detected").length;
                const notDetectedCount = priority.filter((f) => f && f.status === "not_detected").length;
                const additionalCount = (scan.additional_findings || []).length;
                const responseSec = ((scan.response_time_ms || 0) / 1000).toFixed(1);

                return (
                  <motion.div
                    key={scan.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    whileHover={{ scale: 1.01, y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => handleCardClick(scan)}
                    className="p-5 rounded-2xl border cursor-pointer transition-all group"
                    style={{
                      background: "var(--bg-card)",
                      borderColor: "var(--bg-card-hover)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Top row: Date & Response time */}
                        <div className="flex items-center gap-3 text-xs mb-2 flex-wrap" style={{ color: "var(--text-muted)" }}>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDate(scan.created_at)}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {responseSec}s
                          </span>
                        </div>

                        {/* Middle row: Priority Badges */}
                        <div className="flex items-center gap-2 flex-wrap mb-3">
                          <span
                            className="text-xs px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5"
                            style={{
                              background: detectedCount === 3 ? "var(--green-bg)" : "rgba(124, 92, 252, 0.15)",
                              color: detectedCount === 3 ? "var(--green)" : "var(--accent-light)",
                            }}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {detectedCount} / 3 Priority Detected
                          </span>

                          {notDetectedCount > 0 && (
                            <span
                              className="text-xs px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5"
                              style={{ background: "var(--red-bg)", color: "var(--red)" }}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              {notDetectedCount} Deferred / Missing
                            </span>
                          )}

                          {additionalCount > 0 && (
                            <span
                              className="text-xs px-2.5 py-1 rounded-lg font-medium flex items-center gap-1"
                              style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)" }}
                            >
                              <Sparkles className="w-3 h-3" />
                              +{additionalCount} extra
                            </span>
                          )}
                        </div>

                        {/* Snapshot of fields */}
                        <div className="text-xs space-y-1" style={{ color: "var(--text-secondary)" }}>
                          {priority.slice(0, 2).map((p) => (
                            <div key={p.id} className="truncate">
                              <span className="font-medium text-white">{p.id}:</span>{" "}
                              <span style={{ color: p.status === "detected" ? "var(--green)" : "var(--red)" }}>
                                {p.status === "detected" ? p.extractedText || "Detected" : p.note || "Not detected"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Right Chevron */}
                      <div className="self-center flex-shrink-0">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors group-hover:bg-[rgba(124,92,252,0.2)]"
                          style={{ background: "var(--bg-secondary)" }}
                        >
                          <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" style={{ color: "var(--accent)" }} />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
