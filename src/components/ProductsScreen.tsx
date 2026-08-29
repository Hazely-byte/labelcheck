"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Package,
  Layers,
  Barcode,
  Calendar,
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Images,
  FolderTree,
} from "lucide-react";
import { fetchProductHierarchy } from "@/lib/productService";
import type {
  ProductHierarchyItem,
  ProductScan,
  FullScanMergedResult,
} from "@/lib/types";

interface ProductsScreenProps {
  userId: string;
  onSelectProductScan: (scanResult: FullScanMergedResult) => void;
  onBackToScanner: () => void;
}

export default function ProductsScreen({
  userId,
  onSelectProductScan,
  onBackToScanner,
}: ProductsScreenProps) {
  const [hierarchy, setHierarchy] = useState<ProductHierarchyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedBrands, setExpandedBrands] = useState<Record<string, boolean>>({});
  const [expandedCommodities, setExpandedCommodities] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const data = await fetchProductHierarchy(userId);
        if (isMounted) {
          setHierarchy(data);
          const initialBrandExp: Record<string, boolean> = {};
          const initialCommExp: Record<string, boolean> = {};
          data.forEach((b) => {
            initialBrandExp[b.brandName] = true;
            b.commodities.forEach((c) => {
              initialCommExp[`${b.brandName}-${c.commodityName}`] = true;
            });
          });
          setExpandedBrands(initialBrandExp);
          setExpandedCommodities(initialCommExp);
          setError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : "Failed to load products catalog.";
          setError(msg);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  const toggleBrand = (brand: string) => {
    setExpandedBrands((prev) => ({ ...prev, [brand]: !prev[brand] }));
  };

  const toggleCommodity = (key: string) => {
    setExpandedCommodities((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleScanItemClick = (scan: ProductScan) => {
    if (scan.checklist_results) {
      onSelectProductScan(scan.checklist_results);
    }
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
      <div className="max-w-3xl mx-auto w-full">
        {/* Top Header */}
        <div className="mb-5 sm:mb-6">
          <button
            onClick={onBackToScanner}
            className="flex items-center gap-1.5 text-xs mb-3 text-zinc-400 hover:text-white transition-colors cursor-pointer min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Scanner</span>
          </button>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                style={{ background: "var(--accent)" }}
              >
                <FolderTree className="w-4 h-4" />
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
                Product Catalog
              </h1>
            </div>

            <span className="text-xs px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 font-mono">
              {hierarchy.length} {hierarchy.length === 1 ? "Brand" : "Brands"}
            </span>
          </div>
          <p style={{ color: "var(--text-secondary)" }} className="text-xs sm:text-sm mt-1">
            Browse inspected brands, commodities, deduplicated barcodes, and scan timelines.
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
            <p className="text-xs text-zinc-400">Loading catalog hierarchy…</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs text-center">
            {error}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && hierarchy.length === 0 && (
          <div className="py-16 px-4 sm:px-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 text-center">
            <Package className="w-10 h-10 mx-auto mb-3 text-zinc-600" />
            <h2 className="text-base font-bold text-white mb-1">No Products Catalogued Yet</h2>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-5 leading-relaxed">
              Full Product Scans will automatically catalog and deduplicate products under Brand and Commodity categories here.
            </p>
            <button
              onClick={onBackToScanner}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white cursor-pointer min-h-[44px]"
              style={{ background: "var(--accent)" }}
            >
              Start a Full Product Scan
            </button>
          </div>
        )}

        {/* Hierarchy Accordion Tree */}
        {!loading && !error && hierarchy.length > 0 && (
          <div className="space-y-3 sm:space-y-4">
            {hierarchy.map((brandItem) => {
              const isBrandExpanded = !!expandedBrands[brandItem.brandName];

              return (
                <div
                  key={brandItem.brandName}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/70 overflow-hidden"
                >
                  {/* Brand Header */}
                  <button
                    onClick={() => toggleBrand(brandItem.brandName)}
                    className="w-full p-3.5 sm:p-4 flex items-center justify-between hover:bg-zinc-800/50 transition-colors text-left cursor-pointer min-h-[52px]"
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 flex-shrink-0">
                        <Package className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="font-bold text-sm sm:text-base text-white truncate">
                          {brandItem.brandName}
                        </h2>
                        <span className="text-[10px] sm:text-[11px] text-zinc-400 font-mono">
                          {brandItem.commodities.length}{" "}
                          {brandItem.commodities.length === 1 ? "Commodity Type" : "Commodity Types"}
                        </span>
                      </div>
                    </div>

                    {isBrandExpanded ? (
                      <ChevronDown className="w-5 h-5 text-zinc-400 flex-shrink-0 ml-2" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-zinc-400 flex-shrink-0 ml-2" />
                    )}
                  </button>

                  {/* Brand Children: Commodities */}
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
                                  <h3 className="font-semibold text-xs sm:text-sm text-zinc-200 truncate">
                                    {comm.commodityName}
                                  </h3>
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

                              {/* Products & Timeline under this commodity */}
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
                                          <div className="flex items-center gap-2">
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
                                          </div>

                                          <span className="text-[10px] text-zinc-400 font-mono">
                                            {scans.length} {scans.length === 1 ? "Inspection" : "Inspections"}
                                          </span>
                                        </div>

                                        {/* Scan Timeline */}
                                        <div className="space-y-1.5 mt-2 pl-2 border-l-2 border-zinc-800">
                                          {scans.map((scan) => {
                                            const detected = (
                                              scan.checklist_results?.fields || []
                                            ).filter((f) => f.status === "detected").length;

                                            return (
                                              <div
                                                key={scan.id}
                                                onClick={() => handleScanItemClick(scan)}
                                                className="p-2 rounded-lg bg-zinc-950/80 hover:bg-zinc-800/60 border border-zinc-800/80 transition-colors cursor-pointer group flex items-center justify-between gap-2 min-h-[44px]"
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
                                                      {detected}/10 Declarations
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
    </div>
  );
}
