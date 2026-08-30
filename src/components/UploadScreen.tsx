"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Image as ImageIcon,
  Loader2,
  Zap,
  ArrowLeft,
  X,
  Sparkles,
} from "lucide-react";
import imageCompression from "browser-image-compression";
import type { AnalysisResponse } from "@/lib/types";

interface UploadScreenProps {
  onResults: (response: AnalysisResponse) => void;
  onBack: () => void;
  onSwitchToFullScan: () => void;
}

export default function UploadScreen({
  onResults,
  onBack,
  onSwitchToFullScan,
}: UploadScreenProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    setError(null);
    setFileName(file.name);

    try {
      const options = {
        maxWidthOrHeight: 1024,
        useWebWorker: true,
        fileType: "image/jpeg" as const,
        initialQuality: 0.75,
      };
      const compressed = await imageCompression(file, options);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(compressed);
    } catch {
      setError("Failed to process image. Please try another file.");
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith("image/")) {
        processFile(file);
      } else {
        setError("Please drop an image file.");
      }
    },
    [processFile]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const clearImage = () => {
    setPreview(null);
    setFileName("");
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAnalyze = async () => {
    if (!preview) return;
    setIsAnalyzing(true);
    setError(null);

    try {
      const base64Data = preview.split(",")[1];
      const mimeMatch = preview.match(/data:([^;]+);/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64Data, mimeType }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      onResults(data as AnalysisResponse);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-3 sm:px-4 pt-4 sm:pt-6 pb-36 w-full max-w-full">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl mb-5 sm:mb-6"
      >
        {/* Mode Toggle Switcher */}
        <div className="p-1 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center mb-5 max-w-sm mx-auto w-full">
          <button
            type="button"
            className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-white cursor-default min-h-[44px]"
            style={{
              background: "var(--bg-card)",
              boxShadow: "0 0 10px rgba(0,0,0,0.5)",
            }}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Quick Scan</span>
          </button>

          <button
            type="button"
            onClick={onSwitchToFullScan}
            className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-zinc-400 hover:text-white cursor-pointer min-h-[44px]"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Full Product Scan</span>
          </button>
        </div>

        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs mb-3 transition-colors cursor-pointer text-zinc-400 hover:text-white min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>View Past Scans</span>
          </button>
        )}

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Quick Label Scan</h1>
        <p style={{ color: "var(--text-secondary)" }} className="mt-1 text-xs sm:text-sm">
          Upload 1 clear photo for instant priority Legal Metrology checks (&lt;2s target).
        </p>
      </motion.div>

      {/* Upload Area */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-2xl"
      >
        <AnimatePresence mode="wait">
          {!preview ? (
            /* Mobile Bug 1 Fixed: Button wrapper + user-select: none prevents text selection / callout popups */
            <button
              type="button"
              key="dropzone"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full rounded-2xl border-2 border-dashed p-6 sm:p-10 text-center cursor-pointer transition-all duration-200 select-none ${
                isDragOver ? "drop-zone-active" : ""
              }`}
              style={{
                borderColor: isDragOver ? "var(--accent)" : "var(--bg-card-hover)",
                background: isDragOver ? "var(--accent-glow)" : "var(--bg-card)",
                userSelect: "none",
                WebkitUserSelect: "none",
                WebkitTouchCallout: "none",
              }}
            >
              <div className="pointer-events-none select-none">
                <Upload
                  className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4"
                  style={{ color: isDragOver ? "var(--accent)" : "var(--text-muted)" }}
                />
                <p className="text-base sm:text-lg font-medium mb-1 text-white select-none">
                  {isDragOver ? "Drop it here!" : "Drop a label photo here"}
                </p>
                <p className="text-xs text-zinc-400 select-none">
                  or tap to browse / take photo · JPG, PNG, WebP
                </p>
              </div>
            </button>
          ) : (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="rounded-2xl overflow-hidden"
              style={{ background: "var(--bg-card)" }}
            >
              {/* Image Preview */}
              <div className="relative">
                <img
                  src={preview}
                  alt="Label preview"
                  className="w-full max-h-80 sm:max-h-96 object-contain"
                  style={{ background: "var(--bg-secondary)" }}
                />
                {!isAnalyzing && (
                  <button
                    onClick={clearImage}
                    className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer"
                    style={{ background: "rgba(0,0,0,0.65)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--red)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.65)")}
                    title="Remove photo"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                )}
              </div>

              {/* File info + Analyze button */}
              <div className="p-4 sm:p-6">
                <div className="flex items-center gap-2.5 mb-4">
                  <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400 flex-shrink-0" />
                  <span className="text-xs sm:text-sm truncate text-zinc-300">
                    {fileName}
                  </span>
                </div>

                <motion.button
                  whileHover={{ scale: isAnalyzing ? 1 : 1.01 }}
                  whileTap={{ scale: isAnalyzing ? 1 : 0.99 }}
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="w-full py-3.5 sm:py-4 rounded-xl font-semibold text-base flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:cursor-wait text-white min-h-[52px]"
                  style={{
                    background: isAnalyzing ? "var(--bg-card-hover)" : "var(--accent)",
                    boxShadow: isAnalyzing ? "none" : "0 0 30px var(--accent-glow)",
                  }}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Analyzing label…</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      <span>Analyze Label</span>
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4 p-3.5 sm:p-4 rounded-xl text-xs sm:text-sm"
              style={{ background: "var(--red-bg)", color: "var(--red)" }}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
