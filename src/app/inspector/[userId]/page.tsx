"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Package,
  Layers,
  Barcode,
  Calendar,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Images,
  Loader2,
  Share2,
  Check,
  AlertCircle,
  Scan,
  X,
  FileCheck2,
} from "lucide-react";
import type {
  ProductHierarchyItem,
  FullScanMergedResult,
} from "@/lib/types";
import { LEGAL_METROLOGY_10_FIELDS_META } from "@/lib/legalMetrologyRules";

interface PublicInspectorData {
  inspector: {
    userId: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    isCertified: boolean;
  };
  hierarchy: ProductHierarchyItem[];
  totalProducts: number;
  totalScans: number;
}

export default function PublicInspectorPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const resolvedParams = use(params);
  const userId = resolvedParams.userId;

  const [data, setData] = useState<PublicInspectorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [expandedBrands, setExpandedBrands] = useState<Record<string, boolean>>({});
  const [expandedCommodities, setExpandedCommodities] = useState<Record<string, boolean>>({});
  const [selectedScanDetail, setSelectedScanDetail] = useState<FullScanMergedResult | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchPublicCatalog() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/public-inspector/${userId}`);
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || "Inspector catalog not found or is private.");
        }

        if (isMounted) {
          setData(json);

          // Expand all brands by default
          const initialBrandExp: Record<string, boolean> = {};
          const initialCommExp: Record<string, boolean> = {};
          (json.hierarchy as ProductHierarchyItem[]).forEach((b) => {
            initialBrandExp[b.brandName] = true;
            b.commodities.forEach((c) => {
              initialCommExp[`${b.brandName}-${c.commodityName}`] = true;
            });
          });
          setExpandedBrands(initialBrandExp);
          setExpandedCommodities(initialCommExp);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : "Failed to load catalog.";
          setError(msg);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (userId) {
      fetchPublicCatalog();
    }

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const toggleBrand = (brand: string) => {
    setExpandedBrands((prev) => ({ ...prev, [brand]: !prev[brand] }));
  };

  const toggleCommodity = (key: string) => {
    setExpandedCommodities((prev) => ({ ...prev, [key]: !prev[key] }));
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
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] px-3 sm:px-4 pt-4 sm:pt-6 pb-24 w-full max-w-full">
      <div className="max-w-3xl mx-auto w-full">
        {/* Top Minimal Brand Bar */}
        <header className="flex items-center justify-between pb-4 mb-5 border-b border-zinc-800/80">
          <Link href="/" className="flex items-center gap-2 font-bold text-base cursor-pointer">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
              style={{ background: "var(--accent)" }}
            >
              <Scan className="w-3.5 h-3.5" />
            </div>
            <span>
              Label<span style={{ color: "var(--accent)" }}>Check</span>
            </span>
          </Link>

          <span className="text-[10px] text-zinc-400 font-mono px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800">
            Public Registry View
          </span>
        </header>

        {/* Loading State */}
        {loading && (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
            <p className="text-xs text-zinc-400">Verifying inspector credentials & loading catalog…</p>
          </div>
        )}

        {/* Error / 404 Private State */}
        {!loading && error && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-16 px-5 sm:px-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 text-center max-w-md mx-auto my-12"
          >
            <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-400 mx-auto mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Catalog Not Available</h2>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">
              This inspector catalog is private or does not exist. Public catalogs are restricted to verified certified Legal Metrology inspectors.
            </p>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 transition-colors min-h-[44px]"
            >
              Return to LabelCheck Home
            </Link>
          </motion.div>
        )}

        {/* Certified Inspector Catalog Content */}
        {!loading && !error && data && (
          <div className="space-y-6">
            {/* Inspector Identity Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 sm:p-6 rounded-2xl border bg-zinc-900/90 border-zinc-800"
            >
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  {data.inspector.avatarUrl ? (
                    <img
                      src={data.inspector.avatarUrl}
                      alt={data.inspector.name}
                      className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-500/40 shadow-md flex-shrink-0"
                    />
                  ) : (
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold border-2 border-emerald-500/40 flex-shrink-0"
                      style={{ background: "var(--accent)" }}
                    >
                      {data.inspector.name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h1 className="text-lg sm:text-xl font-bold text-white truncate">
                        {data.inspector.name}
                      </h1>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Certified Inspector
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 font-mono truncate">{data.inspector.email}</p>
                    <span className="text-[10px] text-zinc-500 mt-1 inline-block">
                      Official Registered Legal Metrology Inspection Catalog
                    </span>
                  </div>
                </div>

                {/* Share Link Button */}
                <button
                  onClick={handleCopyLink}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 min-h-[44px]"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400">Link Copied!</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4 text-purple-400" />
                      <span>Share Catalog</span>
                    </>
                  )}
                </button>
              </div>

              {/* Statistics Strip */}
              <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-zinc-800/80">
                <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-center">
                  <div className="text-lg sm:text-xl font-bold text-white font-mono">
                    {data.totalProducts}
                  </div>
                  <span className="text-[10px] text-zinc-400">Registered Products</span>
                </div>
                <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-center">
                  <div className="text-lg sm:text-xl font-bold text-white font-mono">
                    {data.totalScans}
                  </div>
                  <span className="text-[10px] text-zinc-400">Inspection Records</span>
                </div>
              </div>
            </motion.div>

            {/* Product Catalog Hierarchy List */}
            {data.hierarchy.length === 0 ? (
              <div className="py-12 px-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 text-center">
                <Package className="w-10 h-10 mx-auto mb-2 text-zinc-600" />
                <h3 className="text-sm font-bold text-white mb-1">No Registered Products Yet</h3>
                <p className="text-xs text-zinc-400">
                  This inspector has not catalogued any retail products yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-purple-400">
                    Inspected Brand & Commodity Catalog
                  </h2>
                  <span className="text-[11px] text-zinc-500 font-mono">
                    {data.hierarchy.length} {data.hierarchy.length === 1 ? "Brand" : "Brands"}
                  </span>
                </div>

                {data.hierarchy.map((brandItem) => {
                  const isBrandExpanded = !!expandedBrands[brandItem.brandName];

                  return (
                    <div
                      key={brandItem.brandName}
                      className="rounded-2xl border border-zinc-800 bg-zinc-900/70 overflow-hidden"
                    >
                      {/* Brand Accordion Header */}
                      <button
                        onClick={() => toggleBrand(brandItem.brandName)}
                        className="w-full p-3.5 sm:p-4 flex items-center justify-between hover:bg-zinc-800/50 transition-colors text-left cursor-pointer min-h-[52px]"
                      >
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                          <div className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 flex-shrink-0">
                            <Package className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-sm sm:text-base text-white truncate">
                              {brandItem.brandName}
                            </h3>
                            <span className="text-[10px] sm:text-[11px] text-zinc-400 font-mono">
                              {brandItem.commodities.length}{" "}
                              {brandItem.commodities.length === 1 ? "Commodity" : "Commodities"}
                            </span>
                          </div>
                        </div>

                        {isBrandExpanded ? (
                          <ChevronDown className="w-5 h-5 text-zinc-400 flex-shrink-0 ml-2" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-zinc-400 flex-shrink-0 ml-2" />
                        )}
                      </button>

                      {/* Commodities Accordion */}
                      <AnimatePresence>
                        {isBrandExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-zinc-800/80 px-3 sm:px-4 py-3 space-y-3 bg-zinc-950/40"
                          >
                            {brandItem.commodities.map((comm) => {
                              const commKey = `${brandItem.brandName}-${comm.commodityName}`;
                              const isCommExpanded = !!expandedCommodities[commKey];

                              return (
                                <div
                                  key={commKey}
                                  className="rounded-xl border border-zinc-800/70 bg-zinc-900/50 overflow-hidden"
                                >
                                  {/* Commodity Header */}
                                  <button
                                    onClick={() => toggleCommodity(commKey)}
                                    className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-zinc-800/40 transition-colors text-left cursor-pointer min-h-[44px]"
                                  >
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <Layers className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                                      <h4 className="font-semibold text-xs sm:text-sm text-zinc-200 truncate">
                                        {comm.commodityName}
                                      </h4>
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono flex-shrink-0">
                                        {comm.products.length} {comm.products.length === 1 ? "variant" : "variants"}
                                      </span>
                                    </div>

                                    {isCommExpanded ? (
                                      <ChevronDown className="w-4 h-4 text-zinc-500 flex-shrink-0 ml-2" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4 text-zinc-500 flex-shrink-0 ml-2" />
                                    )}
                                  </button>

                                  {/* Products List under this Commodity */}
                                  <AnimatePresence>
                                    {isCommExpanded && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="border-t border-zinc-800/60 p-3 space-y-3 bg-zinc-950/60"
                                      >
                                        {comm.products.map(({ product, scans }) => (
                                          <div
                                            key={product.id}
                                            className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800"
                                          >
                                            {/* Product Variant Details */}
                                            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                                              {product.barcode_number ? (
                                                <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                                  <Barcode className="w-3 h-3" />
                                                  <span>{product.barcode_number}</span>
                                                </div>
                                              ) : (
                                                <div className="text-[10px] text-zinc-500 italic">
                                                  No barcode on file
                                                </div>
                                              )}

                                              <span className="text-[10px] text-zinc-400 font-mono">
                                                {scans.length} {scans.length === 1 ? "Inspection" : "Inspections"}
                                              </span>
                                            </div>

                                            {/* Scans Timeline */}
                                            <div className="space-y-1.5 mt-2 pl-2 border-l-2 border-zinc-800">
                                              {scans.map((scan) => {
                                                const detectedCount = (
                                                  scan.checklist_results?.fields || []
                                                ).filter((f) => f.status === "detected").length;

                                                return (
                                                  <div
                                                    key={scan.id}
                                                    onClick={() =>
                                                      scan.checklist_results &&
                                                      setSelectedScanDetail(scan.checklist_results)
                                                    }
                                                    className="p-2.5 rounded-lg bg-zinc-950/80 hover:bg-zinc-800/60 border border-zinc-800/80 transition-colors cursor-pointer group flex items-center justify-between gap-2 min-h-[44px]"
                                                  >
                                                    <div className="min-w-0 flex-1">
                                                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-300 flex-wrap">
                                                        <Calendar className="w-3 h-3 text-zinc-500" />
                                                        <span>{formatDate(scan.created_at)}</span>
                                                        {scan.batch_number && (
                                                          <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-[10px] font-mono text-zinc-400">
                                                            Batch: {scan.batch_number}
                                                          </span>
                                                        )}
                                                      </div>

                                                      <div className="flex items-center gap-2 mt-1 text-[10px]">
                                                        <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                                                          <CheckCircle2 className="w-3 h-3" />
                                                          {detectedCount}/10 Mandatory Declarations
                                                        </span>
                                                        {scan.photo_urls && scan.photo_urls.length > 0 && (
                                                          <span className="text-zinc-500 flex items-center gap-0.5">
                                                            <Images className="w-3 h-3" />
                                                            {scan.photo_urls.length} photos
                                                          </span>
                                                        )}
                                                      </div>
                                                    </div>

                                                    <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        ))}
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Modal: Full Inspection Report Modal View */}
        {selectedScanDetail && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="w-5 h-5 text-purple-400" />
                  <h3 className="font-bold text-sm sm:text-base text-white">
                    Public Inspection Record
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedScanDetail(null)}
                  className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Product Identity */}
              <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                  Product Identity
                </span>
                <h4 className="text-base font-bold text-white mt-0.5">
                  {selectedScanDetail.metadata?.brandName || "Unspecified Brand"} —{" "}
                  <span className="text-zinc-400 font-normal">
                    {selectedScanDetail.metadata?.commodityName || "Commodity"}
                  </span>
                </h4>
                {selectedScanDetail.metadata?.barcodeNumber && (
                  <div className="mt-2 text-xs font-mono text-emerald-400">
                    Barcode: {selectedScanDetail.metadata.barcodeNumber}
                  </div>
                )}
              </div>

              {/* 10-Field Checklist */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  10 Mandatory Declarations
                </div>
                {selectedScanDetail.fields.map((f, i) => {
                  const meta = LEGAL_METROLOGY_10_FIELDS_META[f.fieldId];
                  const isDetected = f.status === "detected";
                  const isMissing = f.status === "not_detected";

                  return (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/60 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-white">
                          {meta?.label || f.fieldId}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            isDetected
                              ? "bg-emerald-500/15 text-emerald-400"
                              : isMissing
                              ? "bg-rose-500/15 text-rose-400"
                              : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {f.status.toUpperCase()}
                        </span>
                      </div>

                      {f.extractedText && (
                        <p className="font-mono text-[11px] text-zinc-300 mt-1 px-2.5 py-1.5 rounded bg-zinc-900/80 border border-zinc-800/80 leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
                          {f.extractedText}
                        </p>
                      )}

                      {f.note && <p className="text-zinc-500 text-[11px] mt-1">{f.note}</p>}
                    </div>
                  );
                })}
              </div>

              {/* Evidence Photos */}
              {selectedScanDetail.photoDataUrls && selectedScanDetail.photoDataUrls.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-zinc-800">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Inspection Evidence Photos ({selectedScanDetail.photoDataUrls.length})
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {selectedScanDetail.photoDataUrls.map((url, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedPhoto(url)}
                        className="aspect-square rounded-lg overflow-hidden border border-zinc-800 hover:border-purple-500 cursor-pointer"
                      >
                        <img src={url} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Evidence Photo Fullscreen Preview Modal */}
        {selectedPhoto && (
          <div
            onClick={() => setSelectedPhoto(null)}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-pointer"
          >
            <div className="max-w-2xl max-h-[85vh] rounded-2xl overflow-hidden border border-zinc-700">
              <img src={selectedPhoto} alt="Full evidence preview" className="w-full h-full object-contain" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
