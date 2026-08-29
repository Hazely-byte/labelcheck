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
          // Default expand all brands
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
    <div className="min-h-screen p-4 pt-6 pb-24">
      <div className="max-w-3xl mx-auto">
        {/* Top Header */}
        <div className="mb-6">
          <button
            onClick={onBackToScanner}
            className="flex items-center gap-2 text-xs mb-3 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Scanner
          </button>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                style={{ background: "var(--accent)" }}
              >
                <FolderTree className="w-4 h-4" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold">Product Catalog</h1>
            </div>

            <span className="text-xs px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 font-mono">
              {hierarchy.length} {hierarchy.length === 1 ? "Brand" : "Brands"}
            </span>
          </div>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm mt-1">
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
          <div className="py-16 px-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 text-center">
            <Package className="w-10 h-10 mx-auto mb-3 text-zinc-600" />
            <h2 className="text-base font-bold text-white mb-1">No Products Catalogued Yet</h2>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-5">
              Full Product Scans will automatically catalog and deduplicate products under Brand and Commodity categories here.
            </p>
            <button
              onClick={onBackToScanner}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white cursor-pointer"
              style={{ background: "var(--accent)" }}
            >
              Start a Full Product Scan
            </button>
          </div>
        )}

        {/* Hierarchy Accordion Tree */}
        {!loading && !error && hierarchy.length > 0 && (
          <div className="space-y-4">
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
                    className="w-full p-4 flex items-center justify-between hover:bg-zinc-800/50 transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                        <Package className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="font-bold text-base text-white">{brandItem.brandName}</h2>
                        <span className="text-[11px] text-zinc-400 font-mono">
                          {brandItem.commodities.length}{" "}
                          {brandItem.commodities.length === 1 ? "Commodity Type" : "Commodity Types"}
                        </span>
                      </div>
                    </div>

                    {isBrandExpanded ? (
                      <ChevronDown className="w-5 h-5 text-zinc-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-zinc-400" />
                    )}
                  </button>

                  {/* Brand Children: Commodities */}
                  <AnimatePresence>
                    {isBrandExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-zinc-800/80 px-4 py-3 space-y-3 bg-zinc-950/40"
                      >
                        {brandItem.commodities.map((comm) => {
                          const commKey = `${brandItem.brandName}-${comm.commodityName}`;
                          const isCommExpanded = !!expandedCommodities[commKey];

                          return (
                            <div key={comm.commodityName} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
                              {/* Commodity Row */}
                              <button
                                onClick={() => toggleCommodity(commKey)}
                                className="w-full flex items-center justify-between text-left cursor-pointer"
                              >
                                <div className="flex items-center gap-2">
                                  <Layers className="w-4 h-4 text-zinc-400" />
                                  <span className="text-sm font-semibold text-zinc-200">
                                    {comm.commodityName}
                                  </span>
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-mono">
                                    {comm.products.length} {comm.products.length === 1 ? "item" : "items"}
                                  </span>
                                </div>

                                {isCommExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-zinc-500" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-zinc-500" />
                                )}
                              </button>

                              {/* Products & Timeline List */}
                              {isCommExpanded && (
                                <div className="mt-3 space-y-2 pt-2 border-t border-zinc-800/60">
                                  {comm.products.map(({ product, scans }) => (
                                    <div
                                      key={product.id}
                                      className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800/80"
                                    >
                                      {/* Product Barcode & Details */}
                                      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                                        <div className="flex items-center gap-1.5">
                                          {product.barcode_number ? (
                                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[11px] flex items-center gap-1">
                                              <Barcode className="w-3 h-3" />
                                              {product.barcode_number}
                                            </span>
                                          ) : (
                                            <span className="text-[11px] text-zinc-500 italic">
                                              No Barcode on File
                                            </span>
                                          )}
                                        </div>

                                        <span className="text-[10px] text-zinc-500">
                                          {scans.length} {scans.length === 1 ? "Inspection" : "Inspections"}
                                        </span>
                                      </div>

                                      {/* Timeline of Scans */}
                                      <div className="space-y-1.5 pl-2 border-l-2 border-purple-500/30">
                                        {scans.map((scan) => {
                                          const results = scan.checklist_results;
                                          const detectedCount = (results?.fields || []).filter(
                                            (f) => f.status === "detected"
                                          ).length;

                                          return (
                                            <div
                                              key={scan.id}
                                              onClick={() => handleScanItemClick(scan)}
                                              className="p-2 rounded-md hover:bg-zinc-800/60 transition-colors cursor-pointer flex items-center justify-between text-xs group"
                                            >
                                              <div className="flex items-center gap-2">
                                                <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                                                <span className="text-zinc-300">
                                                  {formatDate(scan.created_at)}
                                                </span>
                                                {scan.batch_number && (
                                                  <span className="text-zinc-500 text-[10px] font-mono">
                                                    (Batch: {scan.batch_number})
                                                  </span>
                                                )}
                                              </div>

                                              <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                                                  <CheckCircle2 className="w-3 h-3" />
                                                  {detectedCount}/10
                                                </span>

                                                {scan.photo_urls && scan.photo_urls.length > 0 && (
                                                  <span className="text-[10px] text-zinc-400 flex items-center gap-0.5">
                                                    <Images className="w-3 h-3" />
                                                    {scan.photo_urls.length}
                                                  </span>
                                                )}

                                                <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-purple-400 transition-colors" />
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
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
