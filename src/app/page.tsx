"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import LoginScreen from "@/components/LoginScreen";
import UploadScreen from "@/components/UploadScreen";
import ResultsScreen from "@/components/ResultsScreen";
import type { AnalysisResponse } from "@/lib/types";

type Screen = "login" | "scan" | "results";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("login");
  const [analysisData, setAnalysisData] = useState<AnalysisResponse | null>(null);

  const handleInspectorLogin = () => setScreen("scan");

  const handleResults = (data: AnalysisResponse) => {
    if (data && data.result) {
      setAnalysisData(data);
      setScreen("results");
    }
  };

  const handleReset = () => {
    setAnalysisData(null);
    setScreen("scan");
  };

  const handleBackToLogin = () => {
    setAnalysisData(null);
    setScreen("login");
  };

  return (
    <AnimatePresence mode="wait">
      {screen === "login" && (
        <motion.div
          key="login"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3 }}
        >
          <LoginScreen onInspectorLogin={handleInspectorLogin} />
        </motion.div>
      )}
      {screen === "scan" && (
        <motion.div
          key="scan"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3 }}
        >
          <UploadScreen onResults={handleResults} onBack={handleBackToLogin} />
        </motion.div>
      )}
      {screen === "results" && analysisData?.result && (
        <motion.div
          key="results"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3 }}
        >
          <ResultsScreen data={analysisData} onReset={handleReset} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
