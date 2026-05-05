// src/components/Charts.jsx
import React, { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import api from "../lib/api";
import ERPIcons from "./icons.jsx";

// ---------- Colour palette ----------
const palette = {
  primary: "#0ea5a4",
  accent: "#6366f1",
  danger: "#ef4444",
  gold: "#f59e0b",
  slate: "#64748b",
  green: "#10b981",
};

// ---------- Safe chart wrapper ----------
/**
 * ChartWrapper ensures Recharts always receives a valid container size.
 * It also prevents the "width/height = -1" warnings by mounting children
 * after the first render.
 */
function ChartWrapper({ children, className = "" }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div
      className={`chart-wrapper ${className} w-full h-[280px] sm:h-[320px] lg:h-[380px]`}
      style={{ minHeight: 280 }}
    >
      {mounted ? (
        children
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-400">
          <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}
    </div>
  );
}

// ---------- Loading / Error helpers ----------
function LoadingMessage() {
  return (
    <div className="flex items-center justify-center h-full text-sm text-gray-500">
      Loading…
    </div>
  );
}

function ErrorMessage({ onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-sm text-rose-500 gap-2">
      <span>Failed to load chart data.</span>
      <button
        onClick={onRetry}
        className="text-xs underline hover:text-rose-700"
      >
        Retry
      </button>
    </div>
  );
}

// ---------- Orders Trend (Line + Area) ----------
export function OrdersTrendChart({ days = 30 }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get("/api/dashboard/orders/trends", {
        params: { days },
      });
      const data = res?.data?.data ?? res?.data ?? [];
      setRows(
        data.map((r) => ({
          ...r,
          date: r.date || r.year_month || r.od || Object.values(r)[0],
        }))
      );
    } catch (e) {
      console.error("OrdersTrendChart load error", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [days]);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm transition-colors">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Orders (last {days} days)
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Daily orders — animated trend
          </p>
        </div>
        {loading ? (
          <span className="text-xs text-slate-400">Loading…</span>
        ) : (
          <span className="text-xs text-slate-400">{rows.length} points</span>
        )}
      </div>

      <ChartWrapper>
        {error ? (
          <ErrorMessage onRetry={load} />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="orders"
                stroke={palette.primary}
                strokeWidth={2}
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="orders"
                fill={palette.primary}
                fillOpacity={0.08}
                stroke="transparent"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartWrapper>
    </div>
  );
}

// ---------- Inquiries & Orders Pie ----------
export function InquiriesPie() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get("/api/dashboard/summary");
      const data = res?.data?.data ?? res?.data ?? {};
      setSummary(data);
    } catch (e) {
      console.error("InquiriesPie load error", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const inq = summary?.inquiries || {};
  const ord = summary?.orders || {};

  const pieData = [
    { name: "New", value: inq.total_new || 0, color: palette.primary },
    { name: "Contacted", value: inq.total_contacted || 0, color: palette.accent },
    { name: "Converted", value: inq.total_converted || 0, color: palette.gold },
  ];

  const orderData = [
    { name: "Draft", value: ord.total_draft || 0, color: palette.slate },
    { name: "Confirmed", value: ord.total_confirmed || 0, color: palette.green },
  ];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm transition-colors">
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Inquiries & Orders Breakdown
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Donut for inquiries, compact donut for orders
        </p>
      </div>

      {loading ? (
        <LoadingMessage />
      ) : error ? (
        <ErrorMessage onRetry={load} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <ChartWrapper>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={36}
                  outerRadius={80}
                  paddingAngle={4}
                  label
                >
                  {pieData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartWrapper>
          <ChartWrapper>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={orderData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={20}
                  outerRadius={54}
                >
                  {orderData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartWrapper>
        </div>
      )}
    </div>
  );
}

// ---------- Payments vs Expenses ----------
export function PaymentsExpensesChart() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get("/api/dashboard/cashflow", {
        params: { from: null, to: null },
      });
      const data = res?.data?.data ?? res?.data ?? [];
      setRows(data.slice(-12)); // last 12 months
    } catch (e) {
      console.error("PaymentsExpensesChart load error", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm transition-colors">
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Payments vs Expenses (monthly)
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Last 12 months
        </p>
      </div>

      <ChartWrapper>
        {error ? (
          <ErrorMessage onRetry={load} />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="year_month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="payments" name="Payments" fill={palette.primary} />
              <Bar dataKey="expenses" name="Expenses" fill={palette.danger} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartWrapper>
    </div>
  );
}

// ---------- Geo Strength Panel ----------
export function GeoStrengthPanel({ level = "state", limit = 8 }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get("/api/dashboard/geo-strength", {
        params: { level },
      });
      const data = res?.data?.data ?? res?.data ?? [];
      setRows(data.slice(0, limit));
    } catch (e) {
      console.error("GeoStrengthPanel load error", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [level, limit]);

  const max = Math.max(...rows.map((r) => r.students || 0), 1);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm transition-colors">
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Top {level === "district" ? "Districts" : "States"} by Strength
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Schools & students distribution
        </p>
      </div>

      {loading ? (
        <LoadingMessage />
      ) : error ? (
        <ErrorMessage onRetry={load} />
      ) : rows.length === 0 ? (
        <div className="text-sm text-slate-500 dark:text-slate-400 py-4">
          No data available.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r, idx) => {
            const name = r.state_name || r.district_name || r.city || `#${idx + 1}`;
            const students = r.students || 0;
            const pct = Math.round((students / max) * 100);
            return (
              <li key={idx} className="flex items-center gap-3">
                <span className="w-6 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between truncate">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      {name}
                    </span>
                    <span className="text-sm text-slate-500 dark:text-slate-400 ml-2">
                      {students}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: "linear-gradient(90deg,#0ea5a4,#6366f1)",
                      }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------- Composed default export ----------
export default function DashboardCharts() {
  return (
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
    </div>
  );
}