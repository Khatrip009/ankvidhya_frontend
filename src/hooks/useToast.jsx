// src/hooks/useToast.jsx
import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const show = useCallback(({ type, message, duration = 4000 }) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ type, message });
    timerRef.current = setTimeout(() => {
      setToast(null);
      timerRef.current = null;
    }, duration);
  }, []);

  const success = useCallback((msg) => show({ type: "success", message: msg }), []);
  const error   = useCallback((msg) => show({ type: "error", message: msg }), []);
  const warning = useCallback((msg) => show({ type: "warning", message: msg }), []);

  return (
    <ToastContext.Provider value={{ success, error, warning }}>
      {children}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-3
              ${toast.type === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-900/40 dark:border-emerald-800 dark:text-emerald-200" :
                toast.type === "warning" ? "bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-900/40 dark:border-amber-800 dark:text-amber-200" :
                "bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-900/40 dark:border-rose-800 dark:text-rose-200"}
            `}
            role="alert"
          >
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M6 18L18 6M6 6l12 12" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </ToastContext.Provider>
  );
}