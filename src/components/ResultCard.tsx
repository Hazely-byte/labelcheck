"use client";

import { motion } from "framer-motion";
import { CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import type { PriorityFieldStatus, PriorityFieldResult } from "@/lib/types";
import { PRIORITY_FIELDS_META } from "@/lib/legalMetrologyRules";

const STATUS_CONFIG: Record<
  PriorityFieldStatus,
  { icon: typeof CheckCircle2; color: string; bg: string; label: string }
> = {
  detected: {
    icon: CheckCircle2,
    color: "var(--green)",
    bg: "var(--green-bg)",
    label: "Detected",
  },
  not_detected: {
    icon: XCircle,
    color: "var(--red)",
    bg: "var(--red-bg)",
    label: "Not Detected",
  },
  uncertain: {
    icon: HelpCircle,
    color: "var(--yellow)",
    bg: "var(--yellow-bg)",
    label: "Uncertain",
  },
};

interface ResultCardProps {
  field: PriorityFieldResult;
  index: number;
}

export default function ResultCard({ field, index }: ResultCardProps) {
  const config = STATUS_CONFIG[field.status] || STATUS_CONFIG.uncertain;
  const Icon = config.icon;
  const meta = PRIORITY_FIELDS_META[field.id];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.08, type: "spring", stiffness: 180, damping: 20 }}
      className="rounded-xl p-5 border transition-all"
      style={{
        background: "var(--bg-card)",
        borderColor: field.status === "not_detected" ? "rgba(240, 71, 71, 0.3)" : "var(--bg-card-hover)",
      }}
    >
      <div className="flex items-start gap-4">
        {/* Status Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: index * 0.08 + 0.15, type: "spring", stiffness: 300 }}
          className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: config.bg }}
        >
          <Icon className="w-5 h-5" style={{ color: config.color }} />
        </motion.div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-semibold text-sm">{meta?.label ?? field.id}</h3>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: config.bg, color: config.color }}
            >
              {config.label}
            </span>
            {meta && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: "var(--bg-card-hover)", color: "var(--text-muted)" }}
              >
                {meta.ruleReference}
              </span>
            )}
          </div>

          {/* Extracted text */}
          {field.extractedText && (
            <p
              className="text-sm mt-2 font-mono px-3 py-2 rounded-lg break-words"
              style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)" }}
            >
              {field.extractedText}
            </p>
          )}

          {/* Note / Deferral explanation */}
          {field.note && (
            <p
              className="text-xs mt-2"
              style={{
                color: field.status === "not_detected" ? "#fca5a5" : "var(--text-muted)",
              }}
            >
              {field.note}
            </p>
          )}

          {/* Confidence bar */}
          <div className="mt-3 flex items-center gap-2">
            <div
              className="flex-1 h-1.5 rounded-full overflow-hidden"
              style={{ background: "var(--bg-secondary)" }}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${field.confidenceScore}%` }}
                transition={{ delay: index * 0.08 + 0.3, duration: 0.5, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{ background: config.color }}
              />
            </div>
            <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
              {field.confidenceScore}%
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
