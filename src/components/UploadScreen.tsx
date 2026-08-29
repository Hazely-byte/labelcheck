"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Image as ImageIcon, Loader2, Zap, ArrowLeft, X } from "lucide-react";
import imageCompression from "browser-image-compression";
import type { AnalysisResponse } from "@/lib/types";

interface UploadScreenProps {
  onResults: (response: AnalysisResponse) => void;
  onBack: () => void;
}

export default function UploadScreen({ onResults, onBack }: UploadScreenProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    setError(null);
    setFileName(file.name);

    // Compress image client-side
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
      // Extract base64 data from data URL
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
    <div className="min-h-screen flex flex-col items-center p-4 pt-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl mb-8"
      >
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm mb-6 transition-colors cursor-pointer"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Login
        </button>
        <h1 className="text-2xl md:text-3xl font-bold">
          Scan Product Label
        </h1>
        <p style={{ color: "var(--text-secondary)" }} className="mt-2">
          Upload a clear photo of the product label for compliance flagging.
        </p>
      </motion.div>

      {/* Upload Area */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-2xl"
      >
        <AnimatePresence mode="wait">
          {!preview ? (
            <motion.div
              key="dropzone"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all duration-200 ${
                isDragOver ? "drop-zone-active" : ""
              }`}
              style={{
                borderColor: isDragOver ? "var(--accent)" : "var(--bg-card-hover)",
                background: isDragOver ? "var(--accent-glow)" : "var(--bg-card)",
              }}
            >
              <motion.div
                animate={{ y: isDragOver ? -8 : 0 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Upload
                  className="w-12 h-12 mx-auto mb-4"
                  style={{ color: isDragOver ? "var(--accent)" : "var(--text-muted)" }}
                />
                <p className="text-lg font-medium mb-2">
                  {isDragOver ? "Drop it here!" : "Drop a label photo here"}
                </p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  or click to browse · JPG, PNG, WebP
                </p>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="rounded-2xl overflow-hidden"
              style={{ background: "var(--bg-card)" }}
            >
              {/* Image Preview */}
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="Label preview"
                  className="w-full max-h-96 object-contain"
                  style={{ background: "var(--bg-secondary)" }}
                />
                {!isAnalyzing && (
                  <button
                    onClick={clearImage}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer"
                    style={{ background: "rgba(0,0,0,0.6)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--red)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.6)")}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* File info + Analyze button */}
              <div className="p-6">
                <div className="flex items-center gap-3 mb-5">
                  <ImageIcon className="w-5 h-5" style={{ color: "var(--accent)" }} />
                  <span className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>
                    {fileName}
                  </span>
                </div>

                <motion.button
                  whileHover={{ scale: isAnalyzing ? 1 : 0.98 }}
                  whileTap={{ scale: isAnalyzing ? 1 : 0.98 }}
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="w-full py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-3 transition-all cursor-pointer disabled:cursor-wait"
                  style={{
                    background: isAnalyzing ? "var(--bg-card-hover)" : "var(--accent)",
                    color: "white",
                    boxShadow: isAnalyzing ? "none" : "0 0 30px var(--accent-glow)",
                  }}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Analyzing label…
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      Analyze Label
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
              className="mt-4 p-4 rounded-xl text-sm"
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
