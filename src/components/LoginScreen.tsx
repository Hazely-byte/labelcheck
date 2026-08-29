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
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
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
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {/* Logo / Title */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="text-center mb-12"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6"
          style={{ background: "var(--accent)", boxShadow: "0 0 40px var(--accent-glow)" }}
        >
          <Scan className="w-10 h-10 text-white" />
        </motion.div>
        <h1 className="text-4xl md:text-5xl font-bold mb-3">
          Label<span style={{ color: "var(--accent)" }}>Check</span>
        </h1>
        <p style={{ color: "var(--text-secondary)" }} className="text-lg max-w-md mx-auto">
          Instant compliance flagging for Indian retail product labels under Legal Metrology Rules, 2011
        </p>
      </motion.div>

      {/* Login Cards */}
      <div className="flex flex-col sm:flex-row gap-6 w-full max-w-2xl">
        {/* Inspector Login — Google OAuth */}
        <motion.button
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          whileHover={{ scale: loading ? 1 : 1.03, y: loading ? 0 : -4 }}
          whileTap={{ scale: loading ? 1 : 0.97 }}
          onClick={handleGoogleLogin}
          disabled={loading}
          className="flex-1 rounded-2xl p-8 text-left cursor-pointer border-2 transition-all duration-200 group disabled:cursor-wait"
          style={{
            background: "var(--bg-card)",
            borderColor: "var(--accent)",
            boxShadow: "0 0 20px var(--accent-glow)",
          }}
        >
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center mb-5"
            style={{ background: "rgba(124, 92, 252, 0.15)" }}
          >
            {loading ? (
              <Loader2 className="w-7 h-7 animate-spin" style={{ color: "var(--accent)" }} />
            ) : (
              <Shield className="w-7 h-7" style={{ color: "var(--accent)" }} />
            )}
          </div>
          <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
            {loading ? "Connecting to Google…" : "Continue with Google"}
            {!loading && (
              <ChevronRight
                className="w-5 h-5 transition-transform group-hover:translate-x-1"
                style={{ color: "var(--accent)" }}
              />
            )}
          </h2>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm">
            Sign in as an Inspector to scan labels and save your inspection history.
          </p>
        </motion.button>

        {/* Company Login — Disabled */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 0.5, x: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="flex-1 rounded-2xl p-8 text-left border-2 select-none"
          style={{
            background: "var(--bg-secondary)",
            borderColor: "var(--grey)",
            opacity: 0.45,
            cursor: "not-allowed",
          }}
        >
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center mb-5"
            style={{ background: "var(--grey-bg)" }}
          >
            <Building2 className="w-7 h-7" style={{ color: "var(--grey)" }} />
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: "var(--grey)" }}>
            Company / Manufacturer Login
          </h2>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Coming soon — not available in this version.
          </p>
        </motion.div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-4 rounded-xl text-sm max-w-md text-center"
          style={{ background: "var(--red-bg)", color: "var(--red)" }}
        >
          {error}
        </motion.div>
      )}
    </div>
  );
}
