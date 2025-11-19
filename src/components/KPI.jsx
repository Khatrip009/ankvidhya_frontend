// src/components/KPI.jsx
import React, { useEffect, useState, useCallback } from "react";
import * as ERPIcons from "./icons.jsx"; // import everything so we can check what's available
import api from "../lib/api";
import { motion } from "framer-motion";

/* fallback icon (small neutral SVG) */
function FallbackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect width="24" height="24" rx="4" fill="#e6eef8" />
      <path d="M7 12h10" stroke="#8b9bb0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 8h10" stroke="#8b9bb0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* Single KPI card with animation */
function KPICard({ title, value, hint, iconName, iconElement, index = 0 }) {
  // iconElement takes precedence; otherwise resolve iconName from ERPIcons safely
  let iconNode = null;
  if (iconElement) {
    iconNode = iconElement;
  } else if (iconName && ERPIcons && ERPIcons[iconName]) {
    const Comp = ERPIcons[iconName];
    try {
      iconNode = <Comp style={{ width: 18, height: 18 }} />;
    } catch (e) {
      iconNode = <FallbackIcon />;
    }
  } else {
    iconNode = <FallbackIcon />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: "easeOut" }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.995 }}
      className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-start gap-4"
      role="group"
      aria-label={`KPI ${title}`}
    >
      <div
        className="w-12 h-12 flex items-center justify-center rounded-md shrink-0"
        style={{ background: "linear-gradient(135deg,#f0f9ff,#fff7ed)" }}
      >
        {iconNode}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-xs text-slate-500">{title}</div>
        <div className="text-2xl font-semibold text-slate-900 truncate">{value}</div>
        {hint && <div className="text-xs text-slate-400 mt-1 truncate">{hint}</div>}
      </div>
    </motion.div>
  );
}

/**
 * KPIGrid
 *
 * Props:
 *   - summary: optional object with summary data (if provided, KPIGrid will NOT fetch)
 *   - onRefresh: optional function; called when user clicks the small refresh button.
 *   - className: optional extra classes
 */
export default function KPIGrid({ summary: summaryProp = null, onRefresh = null, className = "" }) {
  const [summary, setSummary] = useState(summaryProp || null);
  const [loading, setLoading] = useState(!summaryProp); // if parent passed summary, not loading
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await api.get("/api/dashboard/summary");
      const data = res?.data?.data ? res.data.data : res?.data || {};
      setSummary(data || {});
    } catch (e) {
      console.error("KPIGrid load", e);
      setErr(e?.message || "Failed to load KPIs");
    } finally {
      setLoading(false);
    }
  }, []);

  // If parent passes a summary prop later (after async load), reflect it.
  useEffect(() => {
    if (summaryProp) {
      setSummary(summaryProp);
      setLoading(false);
      setErr(null);
    }
  }, [summaryProp]);

  // If parent didn't pass a summary prop, fetch initially and set interval
  useEffect(() => {
    if (summaryProp) return; // parent drives data, don't fetch
    let timer = null;
    // initial load
    load();
    // auto-refresh every 2 minutes
    timer = setInterval(load, 120000);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [summaryProp, load]);

  // Button handler: prefer parent-provided onRefresh, else call internal load
  const handleRefreshClick = async () => {
    if (typeof onRefresh === "function") {
      try {
        // allow parent to control refresh; parent may call its own load and pass new summary prop
        await onRefresh();
      } catch (e) {
        // fallback to internal load if parent's onRefresh fails
        console.warn("parent onRefresh failed, falling back to internal load", e);
        await load();
      }
    } else {
      await load();
    }
  };

  const s = summary || {};

  return (
    <div className={`kpi-grid ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-slate-600">Overview</div>
        <div>
          <button
            onClick={handleRefreshClick}
            title="Refresh KPIs"
            className="inline-flex items-center gap-2 px-2 py-1 text-xs rounded border bg-white shadow-sm"
          >
            {ERPIcons.Refresh ? <ERPIcons.Refresh style={{ width: 14, height: 14 }} /> : "↻"}
            <span className="sr-only">Refresh</span>
          </button>
        </div>
      </div>

      {/* If completely loading and parent didn't provide data show centered loader */}
      {loading && !summaryProp && (
        <div className="w-full py-10 text-center text-slate-500">Loading…</div>
      )}

      {/* Grid */}
      {!loading && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              index={0}
              title="Inquiries"
              value={s.inquiries?.total ?? 0}
              hint={`New ${s.inquiries?.total_new ?? 0} · Contacted ${s.inquiries?.total_contacted ?? 0} · Converted ${s.inquiries?.total_converted ?? 0}`}
              iconName="Message"
            />

            <KPICard
              index={1}
              title="Orders"
              value={s.orders?.total ?? 0}
              hint={`Draft ${s.orders?.total_draft ?? 0} · Confirmed ${s.orders?.total_confirmed ?? 0}`}
              iconName="Order"
            />

            <KPICard
              index={2}
              title="Total Strength"
              value={s.strength?.total_students ?? s.strength_total_students ?? 0}
              hint={`${s.strength?.total_schools ?? s.strength_total_schools ?? 0} schools`}
              iconName="Analytics"
            />

            <KPICard
              index={3}
              title="Faculties"
              value={s.faculties ?? 0}
              hint={`Present today: ${s.faculty_attendance_today ?? 0}`}
              iconName="Users"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <KPICard index={4} title="Courses" value={s.courses ?? 0} hint="Active courses" iconName="File" />
            <KPICard index={5} title="Books" value={s.books ?? 0} hint="Catalogue books" iconName="File" />
            <KPICard index={6} title="Videos" value={s.videos ?? 0} hint="Uploaded videos" iconName="Play" />
            <KPICard
              index={7}
              title="Payments Received"
              value={s.payments?.total ?? s.total_payments ?? 0}
              hint={`This month: ${s.payments?.this_month ?? s.payments_this_month ?? 0}`}
              iconName="Coin"
            />
          </div>
        </>
      )}

      {err && <div className="mt-3 text-sm text-rose-600">KPI load error: {err}</div>}
    </div>
  );
}
