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
  const watchdogTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [cameraLoading, setCameraLoading] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<InFlightCapturedPhoto[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [sessionStartTime] = useState<number>(() => Date.now());

  // Attach and play stream on video element
  const bindStreamToVideo = useCallback((stream: MediaStream) => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    video.srcObject = stream;

    const playVideo = async () => {
      try {
        await video.play();
        console.log(
          `[Camera Diagnostic] Playback active! Resolution: ${video.videoWidth}x${video.videoHeight}`
        );
        setCameraActive(true);
        setCameraLoading(false);
        setCameraError(null);

        if (watchdogTimerRef.current) {
          clearTimeout(watchdogTimerRef.current);
        }
      } catch (playErr: unknown) {
        const msg = playErr instanceof Error ? playErr.message : String(playErr);
        console.error("[Camera Diagnostic] video.play() error:", msg);
        setCameraError("Autoplay blocked by browser. Tap 'Retry Camera' to start video.");
        setCameraActive(false);
        setCameraLoading(false);
      }
    };

    video.onloadedmetadata = () => {
      console.log("[Camera Diagnostic] onloadedmetadata fired.");
      playVideo();
    };

    playVideo();
  }, []);

  // Manual retry handler
  const startCamera = useCallback(async () => {
    setCameraLoading(true);
    setCameraError(null);
    setCameraActive(false);

    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
    }

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("getUserMedia is not supported on this browser.");
      }

      console.log("[Camera Diagnostic] Requesting camera stream...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });

      const tracks = stream.getVideoTracks();
      if (tracks.length === 0 || tracks[0].readyState !== "live") {
        throw new Error("No live video tracks found.");
      }

      streamRef.current = stream;
      bindStreamToVideo(stream);

      watchdogTimerRef.current = setTimeout(() => {
        const video = videoRef.current;
        if (!video || !video.videoWidth || video.videoWidth === 0) {
          console.warn("[Camera Diagnostic] Watchdog: Video stream still 0px width after 3.5s.");
          setCameraError(
            "Camera stream is taking longer than expected. You can tap 'Retry Camera' or choose photo files below."
          );
          setCameraLoading(false);
        }
      }, 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Camera Diagnostic] Camera initialization failed:", msg);
      setCameraError(
        "Camera permission denied or unavailable. You can select photos from your files below."
      );
      setCameraActive(false);
      setCameraLoading(false);
    }
  }, [bindStreamToVideo]);

  // Initial mount lifecycle
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("getUserMedia is not supported on this browser.");
        }

        console.log("[Camera Mount] Requesting getUserMedia stream...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const tracks = stream.getVideoTracks();
        console.log("[Camera Mount] Received stream tracks count:", tracks.length);

        if (tracks.length === 0 || tracks[0].readyState !== "live") {
          throw new Error("No live video track found in stream.");
        }

        streamRef.current = stream;
        bindStreamToVideo(stream);

        watchdogTimerRef.current = setTimeout(() => {
          if (!isMounted) return;
          const video = videoRef.current;
          if (!video || !video.videoWidth || video.videoWidth === 0) {
            console.warn("[Camera Mount] Watchdog: Video stream still 0px width after 3.5s.");
            setCameraError(
              "Camera stream is taking longer than expected. You can tap 'Retry Camera' or choose photo files below."
            );
            setCameraLoading(false);
          }
        }, 3500);
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[Camera Mount] Init failed:", msg);
          setCameraError(
            "Camera permission denied or unavailable. You can select photos from your files below."
          );
          setCameraActive(false);
          setCameraLoading(false);
        }
      }
    }

    init();

    return () => {
      isMounted = false;
      if (watchdogTimerRef.current) {
        clearTimeout(watchdogTimerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [bindStreamToVideo]);

  // Capture still frame from live video
  const handleSnapPhoto = async () => {
    if (!videoRef.current || photos.length >= MAX_PHOTOS) return;

    const video = videoRef.current;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    if (width === 0 || height === 0) {
      setCameraError("Camera frame not ready yet. Please wait a moment.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

    const photoId = crypto.randomUUID();
    const photoIndex = photos.length + 1;

    console.log(`[Camera Snap] Captured frame #${photoIndex} (${width}x${height})`);

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
          className="relative w-full rounded-2xl overflow-hidden border-2 aspect-[4/3] sm:aspect-[16/10] flex items-center justify-center bg-black"
          style={{
            borderColor: cameraActive ? "var(--accent)" : "var(--bg-card-hover)",
            boxShadow: cameraActive ? "0 0 30px var(--accent-glow)" : "none",
          }}
        >
          {/* PERMANENTLY MOUNTED VIDEO ELEMENT (Eliminates conditional ref-timing null issues) */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              cameraActive ? "opacity-100" : "opacity-0 pointer-events-none absolute"
            }`}
          />

          {/* Viewfinder Reticle & Running Badge (Active State) */}
          {cameraActive && (
            <>
              <div className="absolute inset-6 border border-white/30 rounded-xl pointer-events-none flex items-center justify-center">
                <div className="text-[11px] text-white/80 bg-black/60 px-3 py-1 rounded-full backdrop-blur-md">
                  Align product label panel
                </div>
              </div>

              <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full text-xs font-mono text-white flex items-center gap-1.5 shadow-md">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {activePhotoCount}/{MAX_PHOTOS} Photos
              </div>
            </>
          )}

          {/* Fallback / Loading Box when video is not actively streaming */}
          {!cameraActive && (
            <div className="p-8 text-center max-w-md z-10">
              {cameraLoading ? (
                <>
                  <Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin text-purple-400" />
                  <p className="text-sm font-semibold mb-1 text-white">
                    Connecting camera viewfinder…
                  </p>
                  <p className="text-xs text-zinc-400">
                    Requesting video stream from device camera
                  </p>
                </>
              ) : (
                <>
                  <Camera className="w-10 h-10 mx-auto mb-3 text-zinc-500" />
                  <p className="text-sm font-semibold mb-1 text-white">Camera Viewfinder Offline</p>
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
                </>
              )}
            </div>
          )}
        </div>

        {/* Shutter Button & Controls */}
        <div className="mt-4 flex flex-col items-center gap-3">
          <div className="flex items-center gap-4">
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={handleSnapPhoto}
              disabled={!cameraActive || isCapReached || isMerging}
              className="w-16 h-16 rounded-full border-4 flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
              style={{
                borderColor: "white",
                background: isCapReached ? "#555" : "var(--accent)",
                boxShadow: cameraActive ? "0 0 25px var(--accent-glow)" : "none",
              }}
              title={
                !cameraActive
                  ? "Camera connecting…"
                  : isCapReached
                  ? "Max 6 photos reached"
                  : "Capture photo"
              }
            >
              <div className="w-12 h-12 rounded-full bg-white/20 border border-white/60 flex items-center justify-center">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </motion.button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isCapReached || isMerging}
              className="text-xs px-3.5 py-2 rounded-xl border flex items-center gap-1.5 text-zinc-300 hover:text-white cursor-pointer disabled:opacity-40"
              style={{ background: "var(--bg-card)", borderColor: "var(--bg-card-hover)" }}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              Choose Files
            </button>
          </div>

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
