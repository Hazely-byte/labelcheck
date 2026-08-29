"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
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
    <div className="min-h-screen px-3 sm:px-4 pt-4 sm:pt-6 pb-24 w-full max-w-full">
      <div className="max-w-2xl mx-auto w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 sm:mb-6"
        >
          <button
            onClick={onBackToScan}
            className="flex items-center gap-1.5 text-xs mb-3 text-zinc-400 hover:text-white transition-colors cursor-pointer min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Scanner</span>
          </button>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Quick Scan History</h1>
            <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono">
              {scans.length} {scans.length === 1 ? "Scan" : "Scans"}
            </span>
          </div>
          <p style={{ color: "var(--text-secondary)" }} className="text-xs sm:text-sm mt-1">
            Review past single-label priority checks.
          </p>
        </motion.div>

        {/* Loading State */}
        {loading && (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
            <p style={{ color: "var(--text-muted)" }} className="text-xs">
              Loading your scan records…
            </p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="p-4 rounded-xl text-xs bg-red-500/10 border border-red-500/30 text-red-300 text-center">
            {error}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && scans.length === 0 && (
          <div className="py-16 px-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 text-center">
            <Inbox className="w-10 h-10 mx-auto mb-3 text-zinc-600" />
            <h2 className="text-base font-bold text-white mb-1">No Past Quick Scans</h2>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-5">
              Completed Quick Scans are automatically preserved here.
            </p>
            <button
              onClick={onBackToScan}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white cursor-pointer min-h-[44px]"
              style={{ background: "var(--accent)" }}
            >
              Start a Scan
            </button>
          </div>
        )}

        {/* Scans List */}
        {!loading && !error && scans.length > 0 && (
          <div className="space-y-3">
            {scans.map((scan, i) => {
              const detectedCount = (scan.priority_fields || []).filter(
                (f) => f.status === "detected"
              ).length;
              const notDetectedCount = (scan.priority_fields || []).filter(
                (f) => f.status === "not_detected"
              ).length;
              const hasAdditional = (scan.additional_findings || []).length > 0;

              return (
                <motion.div
                  key={scan.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => handleCardClick(scan)}
                  className="p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer group active:scale-[0.99] min-h-[52px]"
                  style={{
                    background: "var(--bg-card)",
                    borderColor: "var(--bg-card-hover)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {/* Date & Speed */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                          <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                          <span>{formatDate(scan.created_at)}</span>
                        </div>
                        {scan.response_time_ms && (
                          <div className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-400 font-mono">
                            <Clock className="w-3 h-3" />
                            <span>{(scan.response_time_ms / 1000).toFixed(1)}s</span>
                          </div>
                        )}
                      </div>

                      {/* Status Badges */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{detectedCount} Detected</span>
                        </div>
                        {notDetectedCount > 0 && (
                          <div className="flex items-center gap-1 text-xs font-semibold text-rose-400">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>{notDetectedCount} Missing</span>
                          </div>
                        )}
                        {hasAdditional && (
                          <div className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300">
                            <Sparkles className="w-3 h-3" />
                            <span>+Additional findings</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all flex-shrink-0 self-center" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
