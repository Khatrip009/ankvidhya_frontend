// src/main.jsx
import "./index.css";
import React, { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary";
import { registerServiceWorker } from "./utils/registerServiceWorker";
import { ToastProvider } from "./hooks/useToast.jsx";

// Root element
const container = document.getElementById("root");
if (!container) throw new Error("Root element (#root) not found");

const root = createRoot(container);

root.render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center">
              Loading…
            </div>
          }
        >
          <App />
        </Suspense>
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>
);

// Register service worker only in production builds and when supported.
// This is optional; it helps with offline caching & faster repeat loads.
if (import.meta.env.PROD) {
  registerServiceWorker().catch((err) => {
    // do not break the app if SW registration fails
    // eslint-disable-next-line no-console
    console.warn("Service worker registration failed:", err);
  });
}
