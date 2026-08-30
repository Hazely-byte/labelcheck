"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  MinusCircle,
  AlertTriangle,
  RotateCcw,
  Package,
  Barcode,
  Layers,
  Images,
  FolderOpen,
  ChevronDown,
} from "lucide-react";
import { LEGAL_METROLOGY_10_FIELDS_META } from "@/lib/legalMetrologyRules";
import type {
  FullScanMergedResult,
  FullScanFieldStatus,
  Product,
} from "@/lib/types";

interface FullResultsScreenProps {
  data: FullScanMergedResult;
  onReset: () => void;
  onViewProducts: () => void;
  savedProduct?: Product | null;
  ambiguousCandidate?: Product | null;
  onResolveAmbiguity?: (choice: "link_existing" | "create_new", targetProductId?: string) => void;
}

const STATUS_CONFIG: Record<
  FullScanFieldStatus,
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
  not_applicable: {
    icon: MinusCircle,
    color: "var(--grey)",
    bg: "var(--grey-bg)",
    label: "Not Applicable",
  },
};

export default function FullResultsScreen({
  data,
  onReset,
  onViewProducts,
  savedProduct,
  ambiguousCandidate,
  onResolveAmbiguity,
}: FullResultsScreenProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [expandedConflicts, setExpandedConflicts] = useState<Record<string, boolean>>({});

  const fields = data.fields || [];
  const metadata = data.metadata || {
    brandName: null,
    commodityName: null,
    barcodeNumber: null,
    batchNumber: null,
  };
  const conflicts = data.conflicts || [];

  const toggleConflict = (fieldId: string) => {
    setExpandedConflicts((prev) => ({ ...prev, [fieldId]: !prev[fieldId] }));
  };

  const counts = {
    detected: fields.filter((f) => f.status === "detected").length,
    not_detected: fields.filter((f) => f.status === "not_detected").length,
    uncertain: fields.filter((f) => f.status === "uncertain").length,
    not_applicable: fields.filter((f) => f.status === "not_applicable").length,
  };

  const responseSec = ((data.totalProcessingTimeMs || 0) / 1000).toFixed(1);

  return (
    <div className="min-h-screen px-3 sm:px-4 pt-4 sm:pt-6 pb-36 w-full max-w-full">
      <div className="max-w-3xl mx-auto w-full">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }} className="mb-5 sm:mb-6">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                style={{ background: "var(--accent)" }}
              >
                <Layers className="w-4 h-4" />
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
                Full Product Inspection Report
              </h1>
            </div>

            <div
              className="text-xs px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full font-medium"
              style={{ background: "rgba(124, 92, 252, 0.15)", color: "var(--accent-light)" }}
            >
              {data.totalPhotosCaptured} angles • {responseSec}s
            </div>
          </div>
          <p style={{ color: "var(--text-secondary)" }} className="text-xs sm:text-sm">
            Complete statutory compliance evaluation across all 10 Legal Metrology declarations.
          </p>
        </motion.div>

        {/* Product Identity & Metadata Banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 sm:p-5 rounded-2xl border mb-5 sm:mb-6"
          style={{ background: "var(--bg-card)", borderColor: "var(--bg-card-hover)" }}
        >
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <Package className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400">
                  Product Identity
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white break-words">
                {metadata.brandName || "Unspecified Brand"} —{" "}
                <span style={{ color: "var(--text-secondary)" }}>
                  {metadata.commodityName || "Packaged Commodity"}
                </span>
              </h2>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {metadata.barcodeNumber && (
                <div className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                  <Barcode className="w-3.5 h-3.5" />
                  <span>{metadata.barcodeNumber}</span>
                </div>
              )}

              {metadata.batchNumber && (
                <div className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-zinc-300">
                  Batch: <span className="font-mono text-white">{metadata.batchNumber}</span>
                </div>
              )}
            </div>
          </div>

          {/* Deduplication Status / Ambiguity Alert */}
          {ambiguousCandidate && onResolveAmbiguity && (
            <div className="mt-4 p-3.5 sm:p-4 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs">
              <p className="font-semibold mb-1.5">
                Existing Product Match: &quot;{ambiguousCandidate.brand_name} {ambiguousCandidate.commodity_name}&quot;
              </p>
              <p className="mb-3 text-amber-300/90 leading-relaxed">
                No barcode was detected on this package. Is this the same product, or a different item?
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => onResolveAmbiguity("link_existing", ambiguousCandidate.id)}
                  className="px-3 py-2 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400 cursor-pointer min-h-[44px] text-center"
                >
                  Link to Existing Product
                </button>
                <button
                  onClick={() => onResolveAmbiguity("create_new")}
                  className="px-3 py-2 rounded-lg bg-zinc-800 text-white font-semibold hover:bg-zinc-700 cursor-pointer min-h-[44px] text-center"
                >
                  Create as New Variant
                </button>
              </div>
            </div>
          )}

          {savedProduct && (
            <div className="mt-3 text-xs text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">Catalogued under &quot;{savedProduct.brand_name} — {savedProduct.commodity_name}&quot;</span>
            </div>
          )}
        </motion.div>

        {/* Summary Count Strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl p-3.5 sm:p-4 mb-5 sm:mb-6 flex flex-wrap gap-3 sm:gap-4"
          style={{ background: "var(--bg-card)" }}
        >
          <div className="flex items-center gap-1.5 sm:gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-emerald-400 text-sm">{counts.detected}</span>
            <span className="text-xs text-zinc-400">Detected</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <XCircle className="w-4 h-4 text-rose-400" />
            <span className="font-bold text-rose-400 text-sm">{counts.not_detected}</span>
            <span className="text-xs text-zinc-400">Not Detected</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-amber-400 text-sm">{counts.uncertain}</span>
            <span className="text-xs text-zinc-400">Uncertain</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <MinusCircle className="w-4 h-4 text-zinc-400" />
            <span className="font-bold text-zinc-400 text-sm">{counts.not_applicable}</span>
            <span className="text-xs text-zinc-400">N/A</span>
          </div>
        </motion.div>

        {/* 10 Legal Metrology Field Cards */}
        <div className="space-y-3 mb-6 sm:mb-8">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-purple-400 px-1">
            <span>10 Mandatory Declarations</span>
            <span className="hidden sm:inline">Rule Citations</span>
          </div>

          {fields.map((field, idx) => {
            const meta = LEGAL_METROLOGY_10_FIELDS_META[field.fieldId];
            const config = STATUS_CONFIG[field.status] || STATUS_CONFIG.not_detected;
            const Icon = config.icon;
            const conflict = conflicts.find((c) => c.fieldId === field.fieldId);
            const isConflictExpanded = !!expandedConflicts[field.fieldId];

            return (
              <motion.div
                key={field.fieldId || idx}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="p-4 sm:p-5 rounded-2xl border transition-all"
                style={{ background: "var(--bg-card)", borderColor: "var(--bg-card-hover)" }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: config.bg }}
                  >
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: config.color }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between flex-wrap gap-1.5 mb-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-semibold text-xs sm:text-sm text-white">
                          {meta?.label || field.fieldId}
                        </h3>
                        <span
                          className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full font-medium"
                          style={{ background: config.bg, color: config.color }}
                        >
                          {config.label}
                        </span>
                        {field.sourcePhotoIndex && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                            Angle #{field.sourcePhotoIndex}
                          </span>
                        )}
                      </div>

                      {meta?.ruleReference && (
                        <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                          {meta.ruleReference}
                        </span>
                      )}
                    </div>

                    {field.extractedText && (
                      <p className="text-xs font-mono mt-2 px-3 py-2 rounded-xl bg-zinc-950/70 text-zinc-200 break-words border border-zinc-800">
                        {field.extractedText}
                      </p>
                    )}

                    {/* Subtle, low-key, expandable conflict badge */}
                    {conflict && (
                      <div className="mt-2.5">
                        <button
                          type="button"
                          onClick={() => toggleConflict(field.fieldId)}
                          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer min-h-[36px]"
                        >
                          <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
                          <span>Readings varied across photos</span>
                          <ChevronDown
                            className={`w-3 h-3 transition-transform duration-200 ${
                              isConflictExpanded ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        <AnimatePresence>
                          {isConflictExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-2 p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1.5 text-[11px] font-mono text-zinc-300"
                            >
                              <div className="text-[10px] text-zinc-500 font-sans mb-1">
                                Reconciled to highest confidence detection above:
                              </div>
                              {conflict.detectedValues.map((val, i) => (
                                <div key={i} className="flex items-center justify-between gap-2">
                                  <span className="text-zinc-500">Angle #{val.photoIndex}:</span>
                                  <span className="text-amber-200">&quot;{val.value}&quot;</span>
                                </div>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {field.applicabilityReason && (
                      <p className="text-xs text-zinc-400 mt-2 italic leading-relaxed">
                        Applicability: {field.applicabilityReason}
                      </p>
                    )}

                    {field.note && (
                      <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                        {field.note}
                      </p>
                    )}

                    {field.status === "detected" && (
                      <div className="mt-3 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${field.confidenceScore}%`,
                              background: config.color,
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500">
                          {field.confidenceScore}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Captured Angles Photo Gallery */}
        {data.photoDataUrls && data.photoDataUrls.length > 0 && (
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center gap-2 mb-3 px-1 text-zinc-300 text-xs font-semibold">
              <Images className="w-4 h-4 text-purple-400" />
              <span>Inspection Evidence Photos ({data.photoDataUrls.length})</span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {data.photoDataUrls.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedPhoto(url)}
                  className="aspect-square rounded-xl overflow-hidden border border-zinc-800 hover:border-purple-500 transition-all cursor-pointer relative group"
                >
                  <img src={url} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] text-white font-mono">
                    View
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mt-6 sm:mt-8">
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={onReset}
            className="flex-1 py-3.5 sm:py-4 rounded-xl font-semibold text-base flex items-center justify-center gap-2.5 transition-all cursor-pointer text-white min-h-[52px]"
            style={{ background: "var(--accent)", boxShadow: "0 0 25px var(--accent-glow)" }}
          >
            <RotateCcw className="w-5 h-5" />
            <span>Scan Another Product</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={onViewProducts}
            className="px-6 py-3.5 sm:py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer text-zinc-200 border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 min-h-[52px]"
          >
            <FolderOpen className="w-4 h-4" />
            <span>View in Catalog</span>
          </motion.button>
        </div>
      </div>

      {/* Modal for full-size photo preview */}
      {selectedPhoto && (
        <div
          onClick={() => setSelectedPhoto(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="max-w-2xl max-h-[85vh] rounded-2xl overflow-hidden border border-zinc-700">
            <img src={selectedPhoto} alt="Full evidence preview" className="w-full h-full object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
