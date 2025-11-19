// src/main.jsx
import './index.css';
import React, { Suspense } from 'react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary';
import { registerServiceWorker } from './utils/registerServiceWorker';

// Root element
const container = document.getElementById('root');
if (!container) throw new Error('Root element (#root) not found');

const root = createRoot(container);

root.render(
  <StrictMode>
    <ErrorBoundary>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading…</div>}>
        <App />
      </Suspense>
    </ErrorBoundary>
  </StrictMode>
);

// Register service worker only in production builds and when supported.
// This is optional; it helps with offline caching & faster repeat loads.
// It uses a very small, safe register helper that checks for support.
if (import.meta.env.PROD) {
  registerServiceWorker().catch((err) => {
    // do not break the app if SW registration fails
    // eslint-disable-next-line no-console
    console.warn('Service worker registration failed:', err);
  });
}
