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
  Legend
} from "recharts";
import api from "../lib/api";
import ERPIcons from "./icons.jsx";

/**
 * Charts.jsx
 * - Each chart has its own responsive wrapper with explicit heights:
 *   small: 300px, md: 350px, lg: 400px
 *
 * - Exports:
 *   default DashboardCharts
 *   named: OrdersTrendChart, InquiriesPie, PaymentsExpensesChart, GeoStrengthPanel
 */

const palette = {
  primary: "#0ea5a4",
  accent: "#6366f1",
  danger: "#ef4444",
  gold: "#f59e0b",
  slate: "#64748b",
  green: "#10b981"
};

/* Helper wrapper component used for each chart to ensure Recharts gets a valid size */
function ChartWrapper({ children, className = "" }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // mount after first render so measurements are stable (avoids -1 size warnings)
    setMounted(true);
  }, []);

  // keep same Tailwind responsive heights but ensure a pixel minHeight so Recharts can measure
  return (
    <div
      className={`w-full min-w-0 h-[300px] md:h-[350px] lg:h-[400px] ${className}`}
      style={{ minWidth: 0, minHeight: 300 }}
      role="region"
      aria-hidden={!mounted}
    >
      {mounted ? children : <div style={{ width: "100%", height: "100%" }} />}
    </div>
  );
}

/* Orders trend */
export function OrdersTrendChart({ days = 30, className = "" }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/api/dashboard/orders/trends", { query: { days } });
      const data = (res?.data?.data) ? res.data.data : res?.data || [];
      // ensure x axis friendly label (if backend returns date)
      setRows((data || []).map(r => ({ ...r, date: r.date || r.year_month || r.od || Object.values(r)[0] })));
    } catch (e) {
      console.error("orders trend load", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [days]);

  return (
    <div className={`panel bg-white rounded-xl border p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold">Orders (last {days} days)</h4>
          <div className="text-xs text-slate-400">Daily orders — animated trend</div>
        </div>
        <div className="text-xs text-slate-500">{loading ? "Loading…" : `${rows.length} points`}</div>
      </div>

      <ChartWrapper>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="orders" stroke={palette.primary} strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="orders" fill={palette.primary} fillOpacity={0.08} stroke="transparent" />
          </LineChart>
        </ResponsiveContainer>
      </ChartWrapper>
    </div>
  );
}

/* Inquiries + Orders pie/donuts */
export function InquiriesPie({ className = "" }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/api/dashboard/summary");
      const data = res?.data?.data ? res.data.data : res?.data || {};
      setSummary(data);
    } catch (e) {
      console.error("InquiriesPie load", e);
      setSummary({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const inq = summary?.inquiries || {};
  const ord = summary?.orders || {};

  const pieData = [
    { name: "New", value: inq.total_new || 0, color: palette.primary },
    { name: "Contacted", value: inq.total_contacted || 0, color: palette.accent },
    { name: "Converted", value: inq.total_converted || 0, color: palette.gold }
  ];

  const orderData = [
    { name: "Draft", value: ord.total_draft || 0, color: palette.slate },
    { name: "Confirmed", value: ord.total_confirmed || 0, color: palette.green }
  ];

  return (
    <div className={`panel bg-white rounded-xl border p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold">Inquiries & Orders Breakdown</h4>
          <div className="text-xs text-slate-400">Donut for inquiries and compact donut for orders</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 items-center">
        <ChartWrapper className="col-span-2 lg:col-span-1">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={36} outerRadius={80} paddingAngle={4} label>
                {pieData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartWrapper>

        <ChartWrapper className="col-span-2 lg:col-span-1">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={orderData} dataKey="value" nameKey="name" innerRadius={20} outerRadius={54}>
                {orderData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartWrapper>
      </div>
    </div>
  );
}

/* Payments vs Expenses (monthly bars) */
export function PaymentsExpensesChart({ className = "" }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/api/dashboard/cashflow", { query: { from: null, to: null } });
      const data = (res?.data?.data) ? res.data.data : res?.data || [];
      setRows((data || []).slice(-12));
    } catch (e) {
      console.error("PaymentsExpensesChart load", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className={`panel bg-white rounded-xl border p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold">Payments vs Expenses (monthly)</h4>
          <div className="text-xs text-slate-400">Last 12 months</div>
        </div>
      </div>

      <ChartWrapper>
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
      </ChartWrapper>
    </div>
  );
}

/* GeoStrengthPanel - simple bar/list view */
export function GeoStrengthPanel({ level = "state", limit = 8, className = "" }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/api/dashboard/geo-strength", { query: { level } });
      const data = (res?.data?.data) ? res.data.data : res?.data || [];
      setRows((data || []).slice(0, limit));
    } catch (e) {
      console.error("GeoStrengthPanel load", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [level]);

  const max = Math.max(...rows.map(r => r.students || 0), 1);

  return (
    <div className={`panel bg-white rounded-xl border p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold">Top {level === "district" ? "Districts" : "States"} by Strength</h4>
          <div className="text-xs text-slate-400">Schools & students distribution</div>
        </div>
      </div>

      <div className="space-y-3">
        {rows.length === 0 && <div className="text-sm text-slate-400">No data</div>}
        {rows.map((r, idx) => {
          const name = r.state_name || r.district_name || r.city || `#${idx + 1}`;
          const students = r.students || 0;
          const pct = Math.round((students / max) * 100);
          return (
            <div key={idx} className="flex items-center gap-3">
              <div className="w-8 text-sm text-slate-600">{idx + 1}</div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between">
                  <div className="text-sm font-medium text-slate-800 truncate">{name}</div>
                  <div className="text-sm text-slate-500">{students}</div>
                </div>
                <div className="mt-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,#0ea5a4,#6366f1)" }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Default composed charts section */
export default function DashboardCharts({ className = "" }) {
  return (
    <section className={`dashboard-charts space-y-4 ${className}`}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="col-span-2">
          <OrdersTrendChart days={30} />
        </div>
        <div>
          <InquiriesPie />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <PaymentsExpensesChart />
        </div>
        <div>
          <GeoStrengthPanel level="state" />
        </div>
      </div>
    </section>
  );
}
