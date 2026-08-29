"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  X,
  UploadCloud,
  Zap,
  RotateCcw,
  Loader2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import {
  startBackgroundPhotoAnalysis,
  consolidateAndMergeFullScanResults,
} from "@/lib/fullScanEngine";
import type { InFlightCapturedPhoto, FullScanMergedResult } from "@/lib/types";

interface FullScanCameraProps {
  onResultsReady: (mergedResult: FullScanMergedResult) => void;
  onBackToQuickScan: () => void;
}

const MAX_PHOTOS = 6;

export default function FullScanCamera({
  onResultsReady,
  onBackToQuickScan,
}: FullScanCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<InFlightCapturedPhoto[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [sessionStartTime] = useState<number>(() => Date.now());

  // Initialize in-page camera viewfinder
  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      setCameraError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Camera access denied or unavailable";
      console.warn("Camera initialization notice:", msg);
      setCameraError("Camera unavailable or permission denied. You can select photos from your files below.");
      setCameraActive(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraActive(true);
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : "Camera access denied";
          console.warn("Camera init warning:", msg);
          setCameraError("Camera unavailable or permission denied. You can select photos from your files below.");
          setCameraActive(false);
        }
      }
    }

    init();

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Capture still frame from live video
  const handleSnapPhoto = async () => {
    if (!videoRef.current || photos.length >= MAX_PHOTOS) return;

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

    const photoId = crypto.randomUUID();
    const photoIndex = photos.length + 1;

    // Immediately start background parallel processing
    const inFlightPromise = startBackgroundPhotoAnalysis(dataUrl, photoIndex, photoId);
    const inFlightItem = await inFlightPromise;

    setPhotos((prev) => [...prev, inFlightItem]);
  };

  // Handle multi-file selection fallback
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = MAX_PHOTOS - photos.length;
    const filesToProcess = files.slice(0, remainingSlots);

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const photoId = crypto.randomUUID();
      const photoIndex = photos.length + i + 1;

      const inFlightItem = await startBackgroundPhotoAnalysis(dataUrl, photoIndex, photoId);
      setPhotos((prev) => [...prev, inFlightItem]);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Delete individual photo mid-session
  const handleDeletePhoto = (id: string) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isDeleted: true } : p)).filter((p) => p.id !== id)
    );
  };

  // Final Merge & Consolidation
  const handleAnalyzeAll = async () => {
    if (photos.length === 0 || isMerging) return;

    try {
      setIsMerging(true);
      setMergeError(null);

      // Stop camera stream before navigating away
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const totalTimeMs = Date.now() - sessionStartTime;
      const mergedResult = await consolidateAndMergeFullScanResults(photos, totalTimeMs);

      onResultsReady(mergedResult);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to consolidate product scan results.";
      setMergeError(msg);
      setIsMerging(false);
      // Restart camera if merge failed
      startCamera();
    }
  };

  const activePhotoCount = photos.filter((p) => !p.isDeleted).length;
  const isCapReached = activePhotoCount >= MAX_PHOTOS;

  return (
    <div className="min-h-screen flex flex-col items-center p-4 pt-6 pb-24">
      <div className="w-full max-w-2xl">
        {/* Top Bar with Mode Switcher */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <button
            onClick={onBackToQuickScan}
            className="text-xs px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer"
            style={{
              background: "var(--bg-card)",
              borderColor: "var(--bg-card-hover)",
              color: "var(--text-secondary)",
            }}
          >
            ← Switch to Quick Scan
          </button>

          <div
            className="text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-1.5"
            style={{ background: "rgba(124, 92, 252, 0.15)", color: "var(--accent-light)" }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Full 10-Field Product Scan
          </div>
        </div>

        {/* Viewfinder / Capture Box */}
        <div
          className="relative w-full rounded-2xl overflow-hidden border-2 aspect-[4/3] sm:aspect-[16/10] flex items-center justify-center"
          style={{
            background: "var(--bg-card)",
            borderColor: cameraActive ? "var(--accent)" : "var(--bg-card-hover)",
            boxShadow: cameraActive ? "0 0 30px var(--accent-glow)" : "none",
          }}
        >
          {cameraActive ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Viewfinder Target Reticle */}
              <div className="absolute inset-6 border border-white/25 rounded-xl pointer-events-none flex items-center justify-center">
                <div className="text-[11px] text-white/70 bg-black/50 px-2.5 py-1 rounded-full backdrop-blur-sm">
                  Align product label panel
                </div>
              </div>

              {/* In-viewfinder Running Badge */}
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-mono text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {activePhotoCount}/{MAX_PHOTOS} Photos
              </div>
            </>
          ) : (
            <div className="p-8 text-center max-w-md">
              <Camera className="w-12 h-12 mx-auto mb-3 text-zinc-500" />
              <p className="text-sm font-medium mb-2 text-white">
                {cameraError ? "Camera Offline" : "Starting camera viewfinder…"}
              </p>
              <p className="text-xs text-zinc-400 mb-5">
                {cameraError || "Please allow camera permissions when prompted."}
              </p>

              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <button
                  onClick={startCamera}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Retry Camera
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1.5 cursor-pointer"
                  style={{ background: "var(--accent)" }}
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  Upload Photo Files
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Shutter Button & Controls */}
        <div className="mt-4 flex flex-col items-center gap-3">
          {cameraActive && (
            <div className="flex items-center gap-4">
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={handleSnapPhoto}
                disabled={isCapReached || isMerging}
                className="w-16 h-16 rounded-full border-4 flex items-center justify-center transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
                style={{
                  borderColor: "white",
                  background: isCapReached ? "#555" : "var(--accent)",
                  boxShadow: "0 0 25px var(--accent-glow)",
                }}
                title={isCapReached ? "Max 6 photos reached" : "Capture photo"}
              >
                <div className="w-12 h-12 rounded-full bg-white/20 border border-white/60 flex items-center justify-center">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              </motion.button>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isCapReached || isMerging}
                className="text-xs px-3 py-2 rounded-xl border flex items-center gap-1 text-zinc-300 hover:text-white cursor-pointer disabled:opacity-40"
                style={{ background: "var(--bg-card)", borderColor: "var(--bg-card-hover)" }}
              >
                <UploadCloud className="w-3.5 h-3.5" />
                Add Files
              </button>
            </div>
          )}

          {isCapReached && (
            <div className="text-xs text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20 text-center">
              Photo limit reached ({MAX_PHOTOS}/{MAX_PHOTOS}). Delete a photo to capture more, or tap Analyze All.
            </div>
          )}
        </div>

        {/* Thumbnail Strip */}
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-zinc-300">
              Captured Angles ({activePhotoCount}/{MAX_PHOTOS})
            </span>
            <span className="text-zinc-500">
              Front, Back, Sides, MRP & Mfg panels
            </span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
            <AnimatePresence>
              {photos
                .filter((p) => !p.isDeleted)
                .map((photo, index) => (
                  <motion.div
                    key={photo.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    className="relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900 group"
                  >
                    <img
                      src={photo.dataUrl}
                      alt={`Angle ${index + 1}`}
                      className="w-full h-full object-cover"
                    />

                    {/* Delete button */}
                    <button
                      onClick={() => handleDeletePhoto(photo.id)}
                      disabled={isMerging}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600/90 text-white flex items-center justify-center cursor-pointer opacity-90 hover:opacity-100 transition-opacity"
                      title="Remove this photo"
                    >
                      <X className="w-3 h-3" />
                    </button>

                    <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-black/70 text-white">
                      #{index + 1}
                    </div>
                  </motion.div>
                ))}
            </AnimatePresence>

            {activePhotoCount === 0 && (
              <div className="w-full py-6 rounded-xl border border-dashed border-zinc-800 text-center text-xs text-zinc-500">
                No angles captured yet. Tap the shutter button or upload files to begin.
              </div>
            )}
          </div>
        </div>

        {/* Analyze All Action Button */}
        <div className="mt-6">
          <motion.button
            whileHover={{ scale: activePhotoCount > 0 && !isMerging ? 1.02 : 1 }}
            whileTap={{ scale: activePhotoCount > 0 && !isMerging ? 0.98 : 1 }}
            onClick={handleAnalyzeAll}
            disabled={activePhotoCount === 0 || isMerging}
            className="w-full py-4 rounded-xl font-semibold text-base flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-white"
            style={{
              background: activePhotoCount > 0 ? "var(--accent)" : "var(--bg-card)",
              boxShadow: activePhotoCount > 0 ? "0 0 25px var(--accent-glow)" : "none",
            }}
          >
            {isMerging ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Consolidating 10-Field Compliance Report…
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                Analyze All ({activePhotoCount} {activePhotoCount === 1 ? "Angle" : "Angles"})
              </>
            )}
          </motion.button>
        </div>

        {mergeError && (
          <div className="mt-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{mergeError}</span>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </div>
  );
}
