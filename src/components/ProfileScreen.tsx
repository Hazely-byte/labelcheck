"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  FileX2,
  LogOut,
  Zap,
  Package,
  Layers,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Share2,
  Check,
  ExternalLink,
  FolderTree,
} from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { isCertifiedInspector } from "@/lib/certifiedInspectors";
import type { User } from "@supabase/supabase-js";

interface ProfileScreenProps {
  user: User;
  onSignOut: () => Promise<void>;
}

interface UserStats {
  quickScansCount: number;
  fullScansCount: number;
  productsCount: number;
}

export default function ProfileScreen({ user, onSignOut }: ProfileScreenProps) {
  const [stats, setStats] = useState<UserStats>({
    quickScansCount: 0,
    fullScansCount: 0,
    productsCount: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const isCertified = isCertifiedInspector(user.email);

  const fullName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    (isCertified ? "Certified Inspector" : "Inspector");
  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;

  useEffect(() => {
    let isMounted = true;

    async function loadStats() {
      try {
        const supabase = createClient();

        // 1. Count quick scans
        const { count: qCount } = await supabase
          .from("scans")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);

        // 2. Count full scans
        const { count: fCount } = await supabase
          .from("product_scans")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);

        // 3. Count unique products catalogued
        const { count: pCount } = await supabase
          .from("products")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);

        if (isMounted) {
          setStats({
            quickScansCount: qCount ?? 0,
            fullScansCount: fCount ?? 0,
            productsCount: pCount ?? 0,
          });
        }
      } catch (err) {
        console.warn("Error loading user stats:", err);
      } finally {
        if (isMounted) setLoadingStats(false);
      }
    }

    loadStats();

    return () => {
      isMounted = false;
    };
  }, [user.id]);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await onSignOut();
    } catch (err) {
      console.error("Logout error:", err);
      setIsLoggingOut(false);
    }
  };

  const handleCopyPublicLink = () => {
    if (typeof window !== "undefined") {
      const publicUrl = `${window.location.origin}/inspector/${user.id}`;
      navigator.clipboard.writeText(publicUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  return (
    <div className="min-h-screen px-4 pt-6 pb-36 w-full max-w-full">
      <div className="max-w-2xl mx-auto w-full space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">Inspector Profile</h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Account credentials, scan activity, and statutory role disclosures.
          </p>
        </motion.div>

        {/* 1. Account Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="p-5 sm:p-6 rounded-2xl border"
          style={{ background: "var(--bg-card)", borderColor: "var(--bg-card-hover)" }}
        >
          <div className="flex items-center gap-4">
            {/* Avatar */}
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={fullName}
                className={`w-16 h-16 rounded-2xl object-cover border-2 shadow-md flex-shrink-0 ${
                  isCertified ? "border-emerald-500/60" : "border-purple-500/40"
                }`}
              />
            ) : (
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold border-2 flex-shrink-0 ${
                  isCertified ? "border-emerald-500/60 bg-emerald-700" : "border-purple-500/40"
                }`}
                style={{ background: isCertified ? undefined : "var(--accent)" }}
              >
                {fullName.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-white truncate">{fullName}</h2>
                {isCertified ? (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Certified Inspector
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Google Verified
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 font-mono truncate">{user.email}</p>
              <p className="text-[11px] text-zinc-500 mt-1">User ID: {user.id.slice(0, 13)}…</p>
            </div>
          </div>
        </motion.div>

        {/* 2. Real Scan Statistics */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-3"
        >
          {/* Quick Scans */}
          <div
            className="p-4 rounded-2xl border text-center flex flex-col items-center justify-center"
            style={{ background: "var(--bg-card)", borderColor: "var(--bg-card-hover)" }}
          >
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center mb-2">
              <Zap className="w-4 h-4" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white font-mono">
              {loadingStats ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : stats.quickScansCount}
            </div>
            <span className="text-[11px] text-zinc-400 mt-0.5">Quick Scans</span>
          </div>

          {/* Full Product Scans */}
          <div
            className="p-4 rounded-2xl border text-center flex flex-col items-center justify-center"
            style={{ background: "var(--bg-card)", borderColor: "var(--bg-card-hover)" }}
          >
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center mb-2">
              <Layers className="w-4 h-4" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white font-mono">
              {loadingStats ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : stats.fullScansCount}
            </div>
            <span className="text-[11px] text-zinc-400 mt-0.5">Full Scans</span>
          </div>

          {/* Catalogued Products */}
          <div
            className="p-4 rounded-2xl border text-center flex flex-col items-center justify-center"
            style={{ background: "var(--bg-card)", borderColor: "var(--bg-card-hover)" }}
          >
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center mb-2">
              <Package className="w-4 h-4" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white font-mono">
              {loadingStats ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : stats.productsCount}
            </div>
            <span className="text-[11px] text-zinc-400 mt-0.5">Products</span>
          </div>
        </motion.div>

        {/* 3. Conditional Certification Section vs Disclaimers */}
        {isCertified ? (
          /* ========================================================================= */
          /* CERTIFIED INSPECTOR VIEW: Status badge & Registered Products Access       */
          /* ========================================================================= */
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="space-y-4"
          >
            {/* Certification Status Card */}
            <div className="p-5 rounded-2xl border bg-emerald-500/10 border-emerald-500/30 text-emerald-200">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <h3 className="font-bold text-sm text-emerald-300">
                    Certified Legal Metrology Inspector
                  </h3>
                  <p className="text-emerald-200/90 leading-relaxed">
                    This account is verified and authorized to register and publish inspection compliance records for pre-packaged commodities under India&apos;s Legal Metrology Rules, 2011.
                  </p>
                </div>
              </div>
            </div>

            {/* Registered Products (Public Catalog) Card */}
            <div className="p-5 rounded-2xl border bg-zinc-900/90 border-zinc-800 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <FolderTree className="w-4 h-4 text-purple-400" />
                  <span>Registered Products (Public Catalog)</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono">
                  Publicly Available
                </span>
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed">
                As a Certified Inspector, your product inspection records are accessible via your official public registry link. Anyone can view your catalog without logging in.
              </p>

              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                <Link
                  href={`/inspector/${user.id}`}
                  className="flex-1 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>View Registered Products</span>
                </Link>

                <button
                  onClick={handleCopyPublicLink}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Link Copied!</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5 text-purple-400" />
                      <span>Copy Public Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          /* ========================================================================= */
          /* NON-CERTIFIED USER VIEW: Retain original disclaimers and notices          */
          /* ========================================================================= */
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="space-y-4"
          >
            {/* Mandatory Statutory Disclaimer */}
            <div className="p-5 rounded-2xl border bg-amber-500/10 border-amber-500/30 text-amber-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1.5 text-xs">
                  <h3 className="font-bold text-sm text-amber-300">
                    Informational Self-Check Tool Only
                  </h3>
                  <p className="text-amber-200/90 leading-relaxed">
                    You are not logged in as a certified or verified Legal Metrology officer. This application provides automated OCR-assisted label screening under India&apos;s Legal Metrology (Packaged Commodities) Rules, 2011 for internal compliance checks.
                  </p>
                </div>
              </div>
            </div>

            {/* Report Generation Restriction Notice */}
            <div className="p-5 rounded-2xl border bg-zinc-900/80 border-zinc-800 text-zinc-300">
              <div className="flex items-start gap-3">
                <FileX2 className="w-5 h-5 text-zinc-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <h3 className="font-semibold text-zinc-200">
                    Official Compliance Reports Unavailable
                  </h3>
                  <p className="text-zinc-400 leading-relaxed">
                    Official legal seizure memos, statutory notices, and certified inspection reports cannot be generated from this session, as this account is not registered as an authorized enforcement officer.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* 4. Logout Button (Sole place to log out) */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="pt-2"
        >
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-300 disabled:opacity-50 min-h-[52px]"
          >
            {isLoggingOut ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing out…</span>
              </>
            ) : (
              <>
                <LogOut className="w-4 h-4" />
                <span>Sign Out of Account</span>
              </>
            )}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
