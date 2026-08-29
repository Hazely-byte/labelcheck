"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, Building2, Scan, ChevronRight, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      const supabase = createClient();
      
      // Dynamic origin determination
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const redirectTo = `${origin}/auth/callback`;

      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      });

      if (authError) {
        throw authError;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to initiate Google sign-in";
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 sm:py-12 w-full max-w-full">
      {/* Logo / Title */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="text-center mb-8 sm:mb-10 w-full max-w-md"
      >
        <div
          className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl mb-3 sm:mb-4 text-white shadow-lg"
          style={{ background: "var(--accent)" }}
        >
          <Scan className="w-7 h-7 sm:w-8 sm:h-8" />
        </div>
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold mb-2 tracking-tight">
          Label<span style={{ color: "var(--accent)" }}>Check</span>
        </h1>
        <p style={{ color: "var(--text-secondary)" }} className="text-sm sm:text-base leading-relaxed px-2">
          Instant compliance flagging for Indian retail product labels under Legal Metrology Rules, 2011
        </p>
      </motion.div>

      {/* Login Cards */}
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 w-full max-w-xl">
        {/* Inspector Login — Google OAuth */}
        <motion.button
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35, ease: "easeOut" }}
          whileTap={{ scale: 0.98 }}
          onClick={handleGoogleLogin}
          disabled={loading}
          className="flex-1 rounded-2xl p-5 sm:p-7 text-left cursor-pointer border-2 transition-transform duration-150 group disabled:cursor-wait active:scale-[0.98] min-h-[52px]"
          style={{
            background: "var(--bg-card)",
            borderColor: "var(--accent)",
          }}
        >
          <div
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-3 sm:mb-4"
            style={{ background: "rgba(124, 92, 252, 0.15)" }}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" style={{ color: "var(--accent)" }} />
            ) : (
              <Shield className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: "var(--accent)" }} />
            )}
          </div>
          <h2 className="text-base sm:text-lg font-bold mb-1 flex items-center gap-2 text-white">
            {loading ? "Connecting to Google…" : "Continue with Google"}
            {!loading && (
              <ChevronRight
                className="w-4 h-4 transition-transform group-hover:translate-x-1"
                style={{ color: "var(--accent)" }}
              />
            )}
          </h2>
          <p style={{ color: "var(--text-secondary)" }} className="text-xs leading-normal">
            Sign in as an Inspector to scan labels and save your inspection history.
          </p>
        </motion.button>

        {/* Company Login — Disabled Stub */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 0.45, y: 0 }}
          transition={{ delay: 0.15, duration: 0.35, ease: "easeOut" }}
          className="flex-1 rounded-2xl p-5 sm:p-7 text-left border-2 select-none min-h-[52px]"
          style={{
            background: "var(--bg-secondary)",
            borderColor: "var(--grey)",
            cursor: "not-allowed",
          }}
        >
          <div
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-3 sm:mb-4"
            style={{ background: "var(--grey-bg)" }}
          >
            <Building2 className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: "var(--grey)" }} />
          </div>
          <h2 className="text-base sm:text-lg font-bold mb-1" style={{ color: "var(--grey)" }}>
            Company / Manufacturer Login
          </h2>
          <p className="text-xs leading-normal" style={{ color: "var(--text-muted)" }}>
            Coming soon — not available in this version.
          </p>
        </motion.div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-3.5 sm:p-4 rounded-xl text-xs max-w-md text-center w-full"
          style={{ background: "var(--red-bg)", color: "var(--red)" }}
        >
          {error}
        </motion.div>
      )}
    </div>
  );
}
