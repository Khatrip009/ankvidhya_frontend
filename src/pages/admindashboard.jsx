// src/pages/AdminDashboard.jsx
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import KPIGrid from "../components/KPI.jsx";
import DashboardCharts, {
  OrdersTrendChart,
  InquiriesPie,
  PaymentsExpensesChart,
  GeoStrengthPanel,
} from "../components/Charts.jsx";
import ERPIcons from "../components/icons.jsx";
import api from "../lib/api";
import { StatCard, LoadingCard, DashboardGrid } from "../components/cards.jsx";

// ==================== Custom Hooks ====================

/** Hook: online/offline status */
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return isOnline;
}

/** Hook: fetch dashboard summary with caching, retry, and refresh logic */
function useDashboardSummary() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const isMounted = useRef(true);
  const retryTimer = useRef(null);

  const CACHE_KEY = "dashboard_summary_cache";
  const TIMESTAMP_KEY = "dashboard_summary_timestamp";
  const CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes

  const loadFromCache = useCallback(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      const ts = localStorage.getItem(TIMESTAMP_KEY);
      if (cached && ts && Date.now() - parseInt(ts, 10) < CACHE_MAX_AGE) {
        return JSON.parse(cached);
      }
    } catch (err) {
      // Ignore corrupt cache
    }
    return null;
  }, []);

  const saveToCache = useCallback((payload) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
      localStorage.setItem(TIMESTAMP_KEY, Date.now().toString());
    } catch (err) {
      // Storage full or disabled
    }
  }, []);

  const fetchData = useCallback(
    async (skipCache = false) => {
      // Immediately try cache if not skipping
      if (!skipCache) {
        const cachedData = loadFromCache();
        if (cachedData) {
          setData(cachedData);
          setLastUpdated(new Date(parseInt(localStorage.getItem(TIMESTAMP_KEY), 10)));
          setLoading(false);
        }
      }

      try {
        setError(null);
        // Don't set loading true if we already showed cached data (smooth transition)
        if (!data) setLoading(true);

        const res = await api.get("/api/dashboard/summary", {
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
          timeout: 10000,
        });

        // Extract data based on API wrapper
        const newData = res?.data?.data ? res.data.data : res?.data || {};

        if (isMounted.current) {
          setData(newData);
          setLastUpdated(new Date());
          setRetryCount(0);
          saveToCache(newData);
        }
      } catch (err) {
        console.error("Dashboard fetch error:", err);

        let message = "Unable to load dashboard data.";
        if (err.response) {
          const status = err.response.status;
          switch (status) {
            case 401:
              message = "Session expired. Please log in again.";
              break;
            case 403:
              message = "You don’t have access to this dashboard.";
              break;
            case 404:
              message = "Dashboard data not found.";
              break;
            case 429:
              message = "Too many requests. Please wait a moment.";
              break;
            case 500:
            default:
              message = "A server error occurred. Our team has been notified.";
              break;
          }
        } else if (err.request) {
          message = "Network error. Check your internet connection.";
        }

        if (isMounted.current) {
          setError(message);
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    },
    [data, loadFromCache, saveToCache]
  );

  // Auto-retry on error
  useEffect(() => {
    if (error && retryCount < 3) {
      retryTimer.current = setTimeout(() => {
        setRetryCount((prev) => prev + 1);
        fetchData(true);
      }, 5000);
    }
    return () => clearTimeout(retryTimer.current);
  }, [error, retryCount, fetchData]);

  // Refresh data periodically when tab is visible and online
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        fetchData(true);
      }
    }, 120000); // 2 minutes

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const ts = localStorage.getItem(TIMESTAMP_KEY);
        if (ts && Date.now() - parseInt(ts, 10) > 30000) {
          fetchData(true);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchData]);

  // Initial load
  useEffect(() => {
    fetchData(false);
    return () => {
      isMounted.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh callback for manual use
  const refresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  // Clear cache helper
  const clearCache = useCallback(() => {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(TIMESTAMP_KEY);
    refresh();
  }, [refresh]);

  return { data, loading, error, lastUpdated, refresh, clearCache };
}

// ==================== Main Component ====================

const TABS = [
  { id: "overview", label: "Overview", icon: "Dashboard" },
  { id: "analytics", label: "Analytics", icon: "Chart" },
  { id: "reports", label: "Reports", icon: "Document" },
  { id: "settings", label: "Settings", icon: "Settings" },
];

export default function AdminDashboard() {
  const isOnline = useOnlineStatus();
  const {
    data: summaryRaw,
    loading: loadingSummary,
    error: errorSummary,
    lastUpdated,
    refresh,
    clearCache,
  } = useDashboardSummary();

  const [activeTab, setActiveTab] = useState("overview");
  const [isExporting, setIsExporting] = useState(false);

  // Performance metrics derived from data
  const performanceMetrics = useMemo(() => {
    if (!summaryRaw) return null;
    const totalInquiries = summaryRaw.totalInquiries || 0;
    const totalOrders = summaryRaw.totalOrders || 0;
    const conversionRate =
      totalInquiries > 0 ? ((totalOrders / totalInquiries) * 100).toFixed(1) : 0;
    const totalRevenue = summaryRaw.totalRevenue || 0;
    const avgOrderValue =
      totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(0) : 0;
    return {
      conversionRate,
      avgOrderValue,
      customerSatisfaction: summaryRaw.customerSatisfaction || "N/A",
    };
  }, [summaryRaw]);

  // Export data as JSON file
  const handleExport = () => {
    if (!summaryRaw) return;
    setIsExporting(true);
    try {
      const json = JSON.stringify(summaryRaw, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dashboard-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed", err);
    } finally {
      setIsExporting(false);
    }
  };

  // Mobile pull-to-refresh (simplified button) – we rely on manual button
  const scrollRef = useRef(null);

  // Render loading skeleton
  if (loadingSummary && !summaryRaw) {
    return (
      <LoadingSkeleton />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-white p-4 sm:p-6 lg:p-8 flex flex-col"
      ref={scrollRef}
    >
      <div className="max-w-7xl mx-auto w-full flex-1">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Admin Dashboard
            </h1>
            <div className="text-sm text-gray-500 mt-1 flex flex-wrap items-center gap-2">
              <span>Overview — inquiries, orders, finance & more</span>
              {lastUpdated && (
                <span
                  className="inline-flex items-center gap-1 bg-gray-100 rounded-full px-2.5 py-0.5 text-xs font-medium"
                  aria-live="polite"
                >
                  Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Online/Offline badge */}
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                isOnline
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20"
                  : "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20"
              }`}
            >
              {isOnline ? "Online" : "Offline"}
            </span>

            {/* Export button */}
            <button
              onClick={handleExport}
              disabled={isExporting || !summaryRaw}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border bg-white shadow-sm hover:bg-gray-50 transition disabled:opacity-50"
              aria-label="Export dashboard data"
            >
              <ERPIcons.Download className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Export</span>
            </button>

            {/* Refresh button */}
            <button
              onClick={refresh}
              disabled={loadingSummary}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-gray-900 text-white shadow-sm hover:bg-gray-800 transition disabled:opacity-50"
              aria-label="Refresh dashboard data"
            >
              {loadingSummary ? (
                <svg
                  className="animate-spin w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="opacity-25"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : (
                <ERPIcons.Refresh className="w-4 h-4" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">
                {loadingSummary ? "Refreshing" : "Refresh"}
              </span>
            </button>
          </div>
        </header>

        {/* Tabs – horizontal scrollable on mobile */}
        <nav className="flex overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 border-b border-gray-200 mb-6 gap-1" aria-label="Dashboard sections">
          {TABS.map((tab) => {
            const Icon = ERPIcons[tab.icon];
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded-t-md ${
                  isActive
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
              >
                {Icon && <Icon className="w-4 h-4" aria-hidden="true" />}
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Tab panels */}
        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.section
              key="overview"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              id="panel-overview"
              role="tabpanel"
              aria-labelledby="tab-overview"
            >
              {/* KPI Grid */}
              <div className="mb-8">
                <KPIGrid
                  summary={summaryRaw}
                  onRefresh={refresh}
                  loading={loadingSummary && !summaryRaw}
                />
              </div>

              {/* Derived metrics (mobile: single column, sm: two, md: three) */}
              {performanceMetrics && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                  <StatCard
                    label="Conversion Rate"
                    value={`${performanceMetrics.conversionRate}%`}
                    trend={
                      parseFloat(performanceMetrics.conversionRate) > 15
                        ? "up"
                        : "neutral"
                    }
                    icon={ERPIcons.TrendUp}
                  />
                  <StatCard
                    label="Avg Order Value"
                    value={`$${performanceMetrics.avgOrderValue}`}
                    icon={ERPIcons.Currency}
                  />
                  <StatCard
                    label="Customer Satisfaction"
                    value={performanceMetrics.customerSatisfaction}
                    icon={ERPIcons.Star}
                  />
                </div>
              )}

              {/* Charts – responsive columns */}
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <OrdersTrendChart days={30} />
                  </div>
                  <div>
                    <InquiriesPie />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <PaymentsExpensesChart />
                  </div>
                  <div>
                    <GeoStrengthPanel level="state" />
                  </div>
                </div>

                <div>
                  <DashboardCharts />
                </div>
              </div>
            </motion.section>
          )}

          {activeTab === "analytics" && (
            <motion.section
              key="analytics"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              id="panel-analytics"
              role="tabpanel"
              aria-labelledby="tab-analytics"
              className="bg-white rounded-2xl shadow-sm p-6"
            >
              <h2 className="text-lg font-semibold mb-2">Advanced Analytics</h2>
              <p className="text-gray-500">
                Predictive insights, segmentation, and trend forecasting will appear here.
              </p>
            </motion.section>
          )}

          {activeTab === "reports" && (
            <motion.section
              key="reports"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              id="panel-reports"
              role="tabpanel"
              aria-labelledby="tab-reports"
              className="bg-white rounded-2xl shadow-sm p-6"
            >
              <h2 className="text-lg font-semibold mb-2">Reports</h2>
              <p className="text-gray-500">Custom report builder coming soon.</p>
            </motion.section>
          )}

          {activeTab === "settings" && (
            <motion.section
              key="settings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              id="panel-settings"
              role="tabpanel"
              aria-labelledby="tab-settings"
              className="bg-white rounded-2xl shadow-sm p-6"
            >
              <h2 className="text-lg font-semibold mb-2">Dashboard Settings</h2>
              <p className="text-gray-500">Widget configuration and display options.</p>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Error message */}
        {errorSummary && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 p-4 rounded-xl border border-rose-200 bg-rose-50"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <ERPIcons.Warning className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-rose-800">Data Load Error</h3>
                <p className="text-sm text-rose-600 mt-1">{errorSummary}</p>
                <button
                  onClick={refresh}
                  className="mt-3 text-sm font-medium text-rose-700 underline hover:text-rose-800"
                >
                  Retry now
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Footer with cache info and help */}
        {lastUpdated && !errorSummary && (
          <div className="mt-8 pt-6 border-t border-gray-100 text-sm text-gray-500 flex flex-col sm:flex-row justify-between gap-2">
            <span>
              Data last updated: {lastUpdated.toLocaleDateString()} at{" "}
              {lastUpdated.toLocaleTimeString()}
            </span>
            <div className="flex gap-4">
              <button
                onClick={clearCache}
                className="hover:text-gray-900 underline"
              >
                Clear cache
              </button>
              <span>Auto‑refresh: 2 min</span>
            </div>
          </div>
        )}

        {/* Quick tip */}
        <div className="mt-6 p-3 bg-gray-50 rounded-lg text-sm text-gray-600 flex items-start gap-3">
          <ERPIcons.Info className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            <strong>Tip:</strong> This dashboard is fully responsive. On mobile, scroll charts horizontally
            for best viewing. Data is cached for faster loads.
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ==================== Loading Skeleton (Mobile‑first) ====================

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto animate-pulse">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row justify-between gap-3 mb-6">
          <div className="space-y-2">
            <div className="h-7 w-48 bg-gray-200 rounded" />
            <div className="h-4 w-72 bg-gray-200 rounded" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-20 bg-gray-200 rounded-lg" />
            <div className="h-9 w-24 bg-gray-200 rounded-lg" />
          </div>
        </div>

        {/* Tab skeleton */}
        <div className="flex gap-1 border-b border-gray-200 mb-6 pb-3 overflow-hidden">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-8 w-24 bg-gray-200 rounded-t-md" />
          ))}
        </div>

        {/* KPI skeleton cards – mobile: stack, sm: 2 col, lg: 4 col */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((n) => (
            <LoadingCard key={n} variant="detailed" lines={2} />
          ))}
        </div>

        {/* Derived metrics skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-20 bg-gray-100 rounded-xl" />
          ))}
        </div>

        {/* Charts skeleton */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-64 bg-gray-100 rounded-2xl" />
            <div className="h-64 bg-gray-100 rounded-2xl" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-64 bg-gray-100 rounded-2xl" />
            <div className="h-64 bg-gray-100 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}