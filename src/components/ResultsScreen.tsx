"use client";

import { motion } from "framer-motion";
import {
  RotateCcw,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Zap,
  Clock,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import type { AnalysisResponse } from "@/lib/types";
import { ADDITIONAL_FIELDS_META } from "@/lib/legalMetrologyRules";
import ResultCard from "./ResultCard";

interface ResultsScreenProps {
  data: AnalysisResponse;
  onReset: () => void;
}

export default function ResultsScreen({ data, onReset }: ResultsScreenProps) {
  // Defensive extraction with safe fallbacks
  const result = data?.result;
  const responseTimeMs = typeof data?.responseTimeMs === "number" ? data.responseTimeMs : 0;

  const priorityFields = Array.isArray(result?.priorityFields) ? result.priorityFields : [];
  const additionalFindings = Array.isArray(result?.additionalFindings) ? result.additionalFindings : [];

  const counts = {
    detected: priorityFields.filter((f) => f && f.status === "detected").length,
    not_detected: priorityFields.filter((f) => f && f.status === "not_detected").length,
    uncertain: priorityFields.filter((f) => f && f.status === "uncertain").length,
  };

  const responseTimeSec = (responseTimeMs / 1000).toFixed(1);
  const isFast = responseTimeMs <= 5000 && responseTimeMs > 0;

  return (
    <div className="min-h-screen p-4 pt-8 pb-20">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <h1 className="text-2xl md:text-3xl font-bold">Analysis Results</h1>
            <div
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium"
              style={{
                background: isFast ? "rgba(67, 181, 129, 0.15)" : "rgba(250, 166, 26, 0.15)",
                color: isFast ? "var(--green)" : "var(--yellow)",
              }}
            >
              {isFast ? <Zap className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
              <span>Analyzed in {responseTimeSec}s</span>
              {!isFast && responseTimeMs > 5000 && (
                <span className="flex items-center gap-0.5 ml-1">
                  <AlertTriangle className="w-3 h-3" />
                  (&gt;5s)
                </span>
              )}
            </div>
          </div>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm">
            Legal Metrology compliance breakdown for the uploaded label.
          </p>
        </motion.div>

        {/* Priority Summary Strip */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl p-4 mb-6 flex flex-wrap gap-4"
          style={{ background: "var(--bg-card)" }}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" style={{ color: "var(--green)" }} />
            <span className="font-bold" style={{ color: "var(--green)" }}>
              {counts.detected}
            </span>
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>
              Priority Detected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4" style={{ color: "var(--red)" }} />
            <span className="font-bold" style={{ color: "var(--red)" }}>
              {counts.not_detected}
            </span>
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>
              Not Detected / Deferred
            </span>
          </div>
          {counts.uncertain > 0 && (
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4" style={{ color: "var(--yellow)" }} />
              <span className="font-bold" style={{ color: "var(--yellow)" }}>
                {counts.uncertain}
              </span>
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                Uncertain
              </span>
            </div>
          )}
        </motion.div>

        {/* Section 1: Tier 1 Priority Declarations */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--accent-light)" }}>
              Priority Declarations (Rule 6)
            </h2>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: "var(--bg-card)", color: "var(--text-muted)" }}
            >
              {priorityFields.length} Mandatory Checks
            </span>
          </div>

          <div className="space-y-3">
            {priorityFields.map((field, i) => (
              <ResultCard key={field.id || i} field={field} index={i} />
            ))}
          </div>
        </div>

        {/* Section 2: Tier 2 Additional Declarations */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4" style={{ color: "var(--accent)" }} />
            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--accent-light)" }}>
              Additional Visible Declarations
            </h2>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: "var(--bg-card)", color: "var(--text-muted)" }}
            >
              {additionalFindings.length} Found in Photo
            </span>
          </div>

          {additionalFindings.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {additionalFindings.map((item, idx) => {
                const meta = ADDITIONAL_FIELDS_META[item.field];
                return (
                  <motion.div
                    key={item.field || idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + idx * 0.05 }}
                    className="p-4 rounded-xl border flex flex-col justify-between"
                    style={{
                      background: "var(--bg-card)",
                      borderColor: "var(--bg-card-hover)",
                    }}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold text-xs text-white">
                          {meta?.label ?? item.field}
                        </span>
                        {meta && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}
                          >
                            {meta.ruleReference}
                          </span>
                        )}
                      </div>
                      <p
                        className="text-xs font-mono mt-2 px-2.5 py-1.5 rounded break-words"
                        style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)" }}
                      >
                        {item.extractedText}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div
              className="p-5 rounded-xl border text-center text-xs"
              style={{
                background: "var(--bg-secondary)",
                borderColor: "var(--bg-card-hover)",
                color: "var(--text-muted)",
              }}
            >
              No additional secondary declarations detected in this single photo angle.
            </div>
          )}
        </div>

        {/* Scan Another Button */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8"
        >
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onReset}
            className="w-full py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-3 transition-all cursor-pointer"
            style={{
              background: "var(--bg-card)",
              border: "2px solid var(--accent)",
              color: "var(--accent)",
            }}
          >
            <RotateCcw className="w-5 h-5" />
            Scan Another Label
          </motion.button>
        </motion.div>

        {/* Disclaimer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 text-center text-xs px-4"
          style={{ color: "var(--text-muted)" }}
        >
          Informational flagging tool only — not a legal compliance certification. For official verification, consult a Legal Metrology officer.
        </motion.p>
      </div>
    </div>
  );
}
