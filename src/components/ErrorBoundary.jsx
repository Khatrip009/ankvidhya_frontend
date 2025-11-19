// src/components/ErrorBoundary.jsx
import React from 'react';

/**
 * ErrorBoundary - basic error boundary that shows a friendly message in production.
 * In development it rethrows the error so React DevTools / overlay still show the stack.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Save to state and optionally send to telemetry here
    this.setState({ error, info });
    // Example: window.analytics?.captureException(error, { extra: info });
    try {
      // Non-blocking send to legacy analytics if present
      if (window && window.__SENTRY_HUB__ && typeof window.__SENTRY_HUB__.captureException === 'function') {
        window.__SENTRY_HUB__.captureException(error);
      }
    } catch (e) {
      // ignore telemetry errors
    }
  }

  render() {
    const { hasError, error } = this.state;

    if (hasError) {
      // Dev: rethrow to show React overlay / fast refresh stack traces
      if (import.meta.env.DEV) {
        throw error;
      }

      // Prod: show a friendly fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900 p-6">
          <div className="max-w-xl w-full bg-white border rounded-lg shadow p-6 text-center">
            <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
            <p className="text-sm text-slate-600 mb-4">
              Sorry — an unexpected error occurred. We're tracking this issue and will look into it.
            </p>
            <div className="flex justify-center gap-3">
              <button
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded"
                onClick={() => window.location.reload()}
              >
                Reload
              </button>
              <a
                className="px-4 py-2 border rounded text-sm text-slate-700 hover:bg-slate-50"
                href="mailto:admin@example.com"
                
                target="_blank"
                rel="noopener noreferrer"
              >
                Contact support
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
