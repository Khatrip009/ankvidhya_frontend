// src/components/KPI.jsx
import React, { useEffect, useState, useCallback } from "react";
import * as ERPIcons from "./icons.jsx";
import { StatCard, LoadingCard } from "./cards.jsx";
import { motion } from "framer-motion";

// ---------- Fallback icon ----------
function FallbackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect width="24" height="24" rx="4" fill="#e6eef8" />
      <path d="M7 12h10" stroke="#8b9bb0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 8h10" stroke="#8b9bb0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Safe icon resolver
function resolveIcon(iconName) {
  if (iconName && ERPIcons && ERPIcons[iconName]) {
    const Comp = ERPIcons[iconName];
    try {
      return <Comp style={{ width: 18, height: 18 }} />;
    } catch {
      return <FallbackIcon />;
    }
  }
  return <FallbackIcon />;
}

// ---------- Single KPI card ----------
function KPICard({ title, value, hint, iconName, index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: "easeOut" }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-start gap-4 dark:bg-gray-800 dark:border-gray-700"
      role="group"
      aria-label={`KPI ${title}`}
    >
      <div className="w-11 h-11 flex items-center justify-center rounded-lg shrink-0 bg-gradient-to-br from-blue-50 to-orange-50 dark:from-blue-900/30 dark:to-orange-900/30">
        {resolveIcon(iconName)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{title}</p>
        <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate mt-0.5">
          {value}
        </p>
        {hint && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate">{hint}</p>
        )}
      </div>
    </motion.div>
  );
}

// ---------- KPI Grid (main component) ----------
export default function KPIGrid({
  summary: summaryProp = null,
  onRefresh = null,
  loading: externalLoading = false,
  className = "",
}) {
  const [summary, setSummary] = useState(summaryProp || null);
  const [loading, setLoading] = useState(externalLoading || !summaryProp);
  const [error, setError] = useState(null);

  // internal fetch function
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/api/dashboard/summary", { timeout: 10000 });
      const data = res?.data?.data ? res.data.data : res?.data || {};
      setSummary(data || {});
    } catch (e) {
      console.error("KPIGrid load error:", e);
      setError(e?.message || "Failed to load KPIs");
    } finally {
      setLoading(false);
    }
  }, []);

  // when external summary changes
  useEffect(() => {
    if (summaryProp) {
      setSummary(summaryProp);
      setLoading(false);
      setError(null);
    }
  }, [summaryProp]);

  // auto-fetch if no external data
  useEffect(() => {
    if (summaryProp) return;
    const timer = setInterval(load, 120_000);
    load();
    return () => clearInterval(timer);
  }, [summaryProp, load]);

  // update loading state when external loading flag changes
  useEffect(() => {
    if (externalLoading) setLoading(true);
  }, [externalLoading]);

  // manual refresh
  const handleRefresh = async () => {
    if (typeof onRefresh === "function") {
      try {
        await onRefresh();
      } catch {
        await load();
      }
    } else {
      await load();
    }
  };

  return (
    <div className={`kpi-grid ${className}`}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-300">Overview</h2>
        <button
          onClick={handleRefresh}
          disabled={loading && !summary}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border bg-white shadow-sm hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700 transition disabled:opacity-50"
          title="Refresh KPIs"
        >
          {loading && !summary ? (
            <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : (
            resolveIcon("Refresh")
          )}
          <span>Refresh</span>
        </button>
      </div>

      {/* Loading state */}
      {loading && !summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <LoadingCard key={i} variant="detailed" lines={2} />
          ))}
        </div>
      )}

      {/* KPI cards */}
      {summary && (
        <>
          {/* First row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              index={0}
              title="Inquiries"
              value={summary.inquiries?.total ?? summary.totalInquiries ?? 0}
              hint={`New ${summary.inquiries?.total_new ?? 0} · Contacted ${summary.inquiries?.total_contacted ?? 0} · Converted ${summary.inquiries?.total_converted ?? 0}`}
              iconName="Message"
            />
            <KPICard
              index={1}
              title="Orders"
              value={summary.orders?.total ?? summary.totalOrders ?? 0}
              hint={`Draft ${summary.orders?.total_draft ?? 0} · Confirmed ${summary.orders?.total_confirmed ?? 0}`}
              iconName="Order"
            />
            <KPICard
              index={2}
              title="Total Strength"
              value={summary.strength?.total_students ?? summary.strength_total_students ?? summary.totalStrength ?? 0}
              hint={`${summary.strength?.total_schools ?? summary.strength_total_schools ?? 0} schools`}
              iconName="Analytics"
            />
            <KPICard
              index={3}
              title="Faculties"
              value={summary.faculties ?? summary.totalFaculties ?? 0}
              hint={`Present today: ${summary.faculty_attendance_today ?? summary.presentToday ?? 0}`}
              iconName="Users"
            />
          </div>

          {/* Second row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <KPICard
              index={4}
              title="Courses"
              value={summary.courses ?? summary.totalCourses ?? 0}
              hint="Active courses"
              iconName="File"
            />
            <KPICard
              index={5}
              title="Books"
              value={summary.books ?? summary.totalBooks ?? 0}
              hint="Catalogue books"
              iconName="File"
            />
            <KPICard
              index={6}
              title="Videos"
              value={summary.videos ?? summary.totalVideos ?? 0}
              hint="Uploaded videos"
              iconName="Play"
            />
            <KPICard
              index={7}
              title="Payments Received"
              value={summary.payments?.total ?? summary.total_payments ?? summary.totalPayments ?? 0}
              hint={`This month: ${summary.payments?.this_month ?? summary.payments_this_month ?? 0}`}
              iconName="Coin"
            />
          </div>
        </>
      )}

      {/* Error message */}
      {error && !summary && !loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-700 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-300"
          role="alert"
        >
          <div className="flex items-center gap-2">
            <span className="font-medium">Error loading KPIs:</span>
            {error}
            <button onClick={handleRefresh} className="ml-2 underline text-rose-700 hover:text-rose-800 dark:text-rose-300">
              Retry
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}