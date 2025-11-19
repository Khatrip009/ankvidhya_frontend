// src/pages/AdminDashboard.jsx
import React, { useEffect, useState } from "react";
import KPIGrid from "../components/KPI.jsx";
import DashboardCharts, { OrdersTrendChart, InquiriesPie, PaymentsExpensesChart, GeoStrengthPanel } from "../components/Charts.jsx";
import ERPIcons from "../components/icons.jsx";
import api from "../lib/api";

/**
 * AdminDashboard.jsx (production-ready)
 *
 * Changes:
 * - Fetches summary once (and auto-refreshes every 2 minutes)
 * - Passes the fetched summary into KPIGrid to avoid duplicate KPI network calls
 * - Provides an onRefresh prop to KPIGrid so parent can be invoked to refresh data.
 */

export default function AdminDashboard() {
  const [summaryRaw, setSummaryRaw] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [errorSummary, setErrorSummary] = useState(null);

  // Fetch summary from backend
  async function loadSummary() {
    setLoadingSummary(true);
    setErrorSummary(null);
    try {
      const res = await api.get("/api/dashboard/summary");
      // backend sometimes returns { ok:true, data: {...} } or { data: {...} }
      const data = res?.data?.data ? res.data.data : res?.data || {};
      setSummaryRaw(data || {});
    } catch (err) {
      console.error("loadSummary", err);
      setErrorSummary(err?.message || "Failed to load summary");
      setSummaryRaw(null);
    } finally {
      setLoadingSummary(false);
    }
  }

  useEffect(() => {
    loadSummary();
    const id = setInterval(loadSummary, 120000); // 2 minutes
    return () => clearInterval(id);
  }, []);

  // Expose a parent-level refresh handler we can pass into KPIGrid (KPIGrid may use or ignore it).
  // When KPIGrid receives summary prop it won't re-fetch, so parent refresh is the right way to update.
  const handleRefreshForChild = async () => {
    await loadSummary();
  };

  // local alias for easier templating
  const s = summaryRaw || {};

  return (
    <main className="max-w-7xl mx-auto px-4 py-10">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Admin Dashboard</h1>
          <div className="text-sm text-slate-500 mt-1">Overview — inquiries, orders, strength, catalogue & finance.</div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadSummary}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border bg-white text-sm text-slate-700 shadow-sm"
            title="Refresh dashboard summary"
          >
            {ERPIcons.Refresh ? <ERPIcons.Refresh style={{ width: 16, height: 16 }} /> : null}
            Refresh
          </button>
        </div>
      </div>

      {/* KPI grid: re-used component, driven by parent's summaryRaw to avoid duplicate calls */}
      <div className="mb-6">
        <KPIGrid summary={summaryRaw} onRefresh={handleRefreshForChild} />
      </div>

      {/* Charts area (charts themselves have responsive heights) */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2"><OrdersTrendChart days={30} /></div>
          <div><InquiriesPie /></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2"><PaymentsExpensesChart /></div>
          <div><GeoStrengthPanel level="state" /></div>
        </div>

        <div>
          <DashboardCharts />
        </div>
      </div>

      {errorSummary && (
        <div className="mt-4 p-3 rounded bg-rose-50 border border-rose-100 text-rose-700">
          Dashboard summary failed to load: {errorSummary}
        </div>
      )}

      <div className="mt-8 text-xs text-slate-400">
        Tip: charts are responsive. If any chart warns about size, check parent container CSS (ensure no `display:none` or collapsed height when rendering).
      </div>
    </main>
  );
}
