import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useInstallPrompt } from "../hooks/useInstallPrompt";

const isIOS = () => {
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
};

export default function InstallBanner() {
  const { deferredPrompt, isInstalled, promptInstall } = useInstallPrompt();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show banner if not installed and not dismissed
    if (isInstalled || dismissed) {
      setVisible(false);
      return;
    }

    if (deferredPrompt) {
      setVisible(true);
      setShowIOSGuide(false);
    } else if (isIOS()) {
      setVisible(true);
      setShowIOSGuide(true);
    }
  }, [deferredPrompt, isInstalled, dismissed]);

  if (!visible) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-50 bg-indigo-600 px-4 py-3 shadow-md"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-white font-medium text-sm sm:text-base">
                {showIOSGuide
                  ? "Add this app to your Home Screen for a better experience."
                  : "Install AnkVidhya ERP for quick access."}
              </p>
              {showIOSGuide && (
                <p className="text-indigo-200 text-xs mt-1 hidden sm:block">
                  Tap the Share button <span className="font-bold">↑</span> then “Add to Home Screen”
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!showIOSGuide && (
                <button
                  onClick={promptInstall}
                  className="bg-white text-indigo-700 px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-indigo-100 transition"
                >
                  Install
                </button>
              )}
              <button
                onClick={() => {
                  setDismissed(true);
                  setVisible(false);
                }}
                className="text-white/80 hover:text-white text-sm underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}