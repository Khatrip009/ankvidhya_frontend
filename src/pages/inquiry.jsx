// src/pages/inquiry.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import api from "../lib/api";
import { ServerDataTable } from "../components/table.jsx";
import {
  CreateBtn,
  PrimaryBtn,
  SecondaryBtn,
  FileUploadBtn,
  SaveBtn,
  CancelBtn,
  DeleteBtn,
} from "../components/buttons.jsx";
import {
  FormField,
  TextInput,
  TextArea,
  Select,
  FileInput,
  ToggleSwitch,
} from "../components/input.jsx";

/*
  Inquiry page (modal form + table) — upgraded to use shared components
*/

const DEFAULT_PAGE_SIZE = 20;
const STATUS_OPTIONS = ["", "new", "contacted", "qualified", "converted", "lost"];

function Icon({ name, className = "h-4 w-4 inline-block mr-2" }) {
  const common = { className, "aria-hidden": true };
  switch (name) {
    case "search":
      return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 21l-4.35-4.35" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="11" cy="11" r="6" strokeWidth="1.5"/></svg>;
    case "download": return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3v12" strokeWidth="1.5"/><path d="M8 11l4 4 4-4" strokeWidth="1.5"/><path d="M5 21h14" strokeWidth="1.5"/></svg>;
    case "upload": return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 21V7" strokeWidth="1.5"/><path d="M7 11l5-5 5 5" strokeWidth="1.5"/><path d="M5 21h14" strokeWidth="1.5"/></svg>;
    case "plus": return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 5v14M5 12h14" strokeWidth="1.5" strokeLinecap="round"/></svg>;
    case "view": return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" strokeWidth="1.4"/><circle cx="12" cy="12" r="3" strokeWidth="1.4"/></svg>;
    case "edit": return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 21v-3.75L14.06 6.19a2 2 0 0 1 2.83 0l1.92 1.92a2 2 0 0 1 0 2.83L7.77 21H3z" strokeWidth="1.3"/><path d="M14 7l3 3" strokeWidth="1.3" strokeLinecap="round"/></svg>;
    case "delete": return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 6h18M8 6v14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6" strokeWidth="1.3"/><path d="M10 11v6M14 11v6" strokeWidth="1.3" strokeLinecap="round"/></svg>;
    default: return null;
  }
}

/* ---------- Utilities ---------- */

function fmtDateShort(s) {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return d.toLocaleString();
  } catch (e) { return s; }
}

function toCsv(rows = []) {
  if (!rows || !rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map(h => escape(r[h])).join(","));
  }
  return lines.join("\n");
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (!lines.length) return [];
  const header = lines.shift().split(",").map(h => h.trim());
  const rows = [];
  for (const line of lines) {
    const values = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i+1] === '"') { cur += '"'; i++; continue; }
        inQuote = !inQuote;
        continue;
      }
      if (!inQuote && ch === ",") { values.push(cur); cur = ""; continue; }
      cur += ch;
    }
    values.push(cur);
    const obj = {};
    for (let i = 0; i < header.length; i++) {
      obj[header[i]] = values[i] !== undefined ? values[i] : "";
    }
    rows.push(obj);
  }
  return rows;
}

function StatusBadge({ status }) {
  const s = (status || "").toString().toLowerCase();
  const map = {
    new: "bg-indigo-100 text-indigo-800",
    contacted: "bg-yellow-100 text-yellow-800",
    qualified: "bg-sky-100 text-sky-800",
    converted: "bg-emerald-100 text-emerald-800",
    lost: "bg-rose-100 text-rose-800"
  };
  const cls = map[s] || "bg-slate-100 text-slate-800";
  return <span className={`inline-flex items-center text-sm font-medium px-2 py-1 rounded ${cls}`}>{s || "—"}</span>;
}

/* ---------- Page Component ---------- */

export default function InquiryPage() {
  // filters & pagination
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: DEFAULT_PAGE_SIZE, total: 0 });

  // lookups
  const [lookups, setLookups] = useState({ mediums: [], standards: [] });
  const [employees, setEmployees] = useState([]);

  // modal form state
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    school_name: "", contact_name: "", phone: "", email: "",
    city: "", state: "", pincode: "", students_count: "", medium_id: "", medium_name: "",
    std_from_id: "", std_from_name: "", std_to_id: "", std_to_name: "",
    message: "", source: "website", consent: true, assigned_to_employee_id: "", status: "new"
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState(null);
  const [formError, setFormError] = useState("");

  // view-only modal
  const [viewOpen, setViewOpen] = useState(false);
  const [viewData, setViewData] = useState(null);

  // import state
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ processed: 0, total: 0, errors: [] });

  const fileInputRef = useRef(null);

  // table reload key — increment to force remount / reload
  const [tableKey, setTableKey] = useState(0);

  useEffect(() => {
    loadLookups();
    loadEmployees();
    fetchPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // filters change -> reset page
    setPage(1);
    fetchPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, fromDate, toDate, pageSize]);

  async function loadLookups() {
    try {
      const r = await api.leads.lookups();
      if (r) { setLookups({ mediums: r.media || [], standards: r.standards || [] }); return; }
    } catch (e) {}
    try {
      const res = await api.get("/api/master/lookups", { background: true });
      if (res) setLookups({ mediums: res.mediums || [], standards: res.standards || [] });
    } catch (e) {}
  }

  async function loadEmployees() {
    try {
      const r = await api.get("/api/employees", { query: { page: 1, pageSize: 500 }, background: true });
      if (r && r.data) setEmployees(r.data || []);
    } catch (e) {}
  }

  async function fetchPage(p = 1) {
    setLoading(true);
    try {
      const q = {
        page: p,
        pageSize,
        search: search || undefined,
        status: status || undefined,
        from: fromDate || undefined,
        to: toDate || undefined
      };
      const res = await api.get("/api/leads", { query: q });
      if (res) {
        setData(res.data || []);
        setPagination(res.pagination || { page: p, pageSize, total: (res.pagination && res.pagination.total) || 0 });
      } else {
        setData([]);
      }
    } catch (err) {
      console.error("Fetch leads error", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleExportCsv() {
    try {
      const rows = data.map(r => ({
        lead_id: r.lead_id,
        school_name: r.school_name,
        contact_name: r.contact_name,
        phone: r.phone,
        email: r.email,
        city: r.city,
        state: r.state,
        pincode: r.pincode,
        students_count: r.students_count,
        medium: r.medium || "",
        std_from: r.std_from || "",
        std_to: r.std_to || "",
        message: r.message || "",
        status: r.status || "",
        created_at: r.created_at || ""
      }));
      const csv = toCsv(rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inquiries_page${pagination.page || 1}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Export failed.");
    }
  }

  async function openCreateModal() {
    setIsEditing(false);
    setEditingId(null);
    setForm({
      school_name: "", contact_name: "", phone: "", email: "",
      city: "", state: "", pincode: "", students_count: "", medium_id: "", medium_name: "",
      std_from_id: "", std_from_name: "", std_to_id: "", std_to_name: "",
      message: "", source: "website", consent: true, assigned_to_employee_id: "", status: "new"
    });
    setFormError("");
    setFormSuccess(null);
    setModalOpen(true);
  }

  async function openEditModal(id) {
    setFormError("");
    setFormSuccess(null);
    setFormSubmitting(false);
    setIsEditing(true);
    setEditingId(id);
    setModalOpen(true);
    try {
      const res = await api.get(`/api/leads/${id}`);
      const d = (res && res.data) ? res.data : null;
      if (d) {
        setForm({
          school_name: d.school_name || "",
          contact_name: d.contact_name || "",
          phone: d.phone || "",
          email: d.email || "",
          city: d.city || "",
          state: d.state || "",
          pincode: d.pincode || "",
          students_count: d.students_count || "",
          medium_id: d.medium_id || "",
          medium_name: d.medium || "",
          std_from_id: d.std_from_id || "",
          std_from_name: d.std_from || "",
          std_to_id: d.std_to_id || "",
          std_to_name: d.std_to || "",
          message: d.message || "",
          source: d.source || "website",
          consent: d.consent === true,
          assigned_to_employee_id: d.assigned_to_employee_id || "",
          status: d.status || "new"
        });
      }
    } catch (err) {
      console.error("Failed to load lead", err);
      setModalOpen(false);
      alert("Failed to load record for edit.");
    }
  }

  async function openViewModal(id) {
    try {
      const res = await api.get(`/api/leads/${id}`);
      const d = (res && res.data) ? res.data : null;
      if (d) {
        setViewData(d);
        setViewOpen(true);
      }
    } catch (err) {
      console.error("Failed to load lead", err);
      alert("Failed to load record.");
    }
  }

  async function submitForm(e) {
    e && e.preventDefault();
    setFormSubmitting(true);
    setFormError("");
    setFormSuccess(null);

    const payload = {
      school_name: form.school_name,
      contact_name: form.contact_name,
      phone: form.phone || "",
      email: form.email || "",
      city: form.city || "",
      state: form.state || "",
      pincode: form.pincode || "",
      students_count: form.students_count || "",
      medium_id: form.medium_id || undefined,
      medium_name: form.medium_name || undefined,
      std_from_id: form.std_from_id || undefined,
      std_from_name: form.std_from_name || undefined,
      std_to_id: form.std_to_id || undefined,
      std_to_name: form.std_to_name || undefined,
      message: form.message || "",
      source: form.source || "website",
      consent: !!form.consent,
      assigned_to_employee_id: form.assigned_to_employee_id || undefined,
      status: form.status || undefined
    };

    try {
      if (isEditing && editingId) {
        await api.request(`/api/leads/${editingId}`, { method: "PATCH", body: payload });
        setFormSuccess({ updated: editingId });
      } else {
        await api.leads.publicSubmit(payload);
        setFormSuccess({ created: true });
      }

      setModalOpen(false);
      // refresh table
      setTableKey(k => k + 1);
      fetchPage(1);
    } catch (err) {
      console.error(err);
      setFormError(err?.data?.message || err?.message || "Submission failed");
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Are you sure you want to delete this inquiry? This action cannot be undone.")) return;
    try {
      if (api.leads && api.leads.remove) await api.leads.remove(id);
      else await api.del(`/api/leads/${id}`);
      // refresh
      setTableKey(k => k + 1);
      fetchPage(1);
    } catch (err) {
      console.error(err);
      alert(err?.data?.message || err?.message || "Delete failed");
    }
  }

  async function handleCsvFile(file) {
    if (!file) return;
    const txt = await file.text();
    const rows = parseCsv(txt);
    if (!rows.length) return alert("No rows found in CSV.");

    const total = rows.length;
    setImporting(true);
    setImportProgress({ processed: 0, total, errors: [] });

    const errors = [];
    let processed = 0;
    for (const [i, r] of rows.entries()) {
      const payload = {
        school_name: r.school_name || r.school || r.schoolname || "",
        contact_name: r.contact_name || r.contact|| r.contactname || "",
        phone: r.phone || r.mobile || "",
        email: r.email || "",
        city: r.city || "",
        state: r.state || "",
        pincode: r.pincode || r.pin || "",
        students_count: r.students_count || r.students || r.students_count || "",
        medium_name: r.medium || r.medium_name || "",
        std_from_name: r.std_from || r.std_from_name || r.std_from_name || "",
        std_to_name: r.std_to || r.std_to_name || r.std_to_name || "",
        message: r.message || r.notes || r.msg || "",
        source: r.source || "csv-import",
        consent: (r.consent === "false" || r.consent === "0") ? false : true
      };
      try {
        const res = await api.leads.publicSubmit(payload);
        if (!(res && res.ok)) {
          errors.push({ row: i + 1, err: res?.message || "unknown" });
        }
      } catch (err) {
        errors.push({ row: i + 1, err: err?.data?.message || err?.message || "error" });
      }
      processed++;
      setImportProgress(prev => ({ ...prev, processed }));
    }

    setImportProgress(prev => ({ ...prev, errors }));
    setImporting(false);
    // refresh UI
    setTableKey(k => k + 1);
    fetchPage(1);
    if (errors.length) {
      alert(`Import completed with ${errors.length} errors. See console for details.`);
      console.error("Import errors:", errors);
    } else {
      alert("Import completed successfully.");
    }
  }

  const totalPages = useMemo(() => {
    const t = (pagination && pagination.total) || 0;
    return Math.max(1, Math.ceil(t / (pagination.pageSize || pageSize)));
  }, [pagination, pageSize]);

  function Row({ r }) {
    return (
      <tr className="odd:bg-white even:bg-slate-50 align-top">
        <td className="px-4 py-3 text-base text-slate-700 font-medium">{r.lead_id}</td>
        <td className="px-4 py-3 text-base font-medium">{r.school_name}</td>

        <td className="px-4 py-3 text-sm">
          <div className="text-base font-medium">{r.contact_name}</div>
          <div className="text-sm text-slate-500">{r.phone}</div>
        </td>

        <td className="px-4 py-3 text-base">{r.email || "—"}</td>
        <td className="px-4 py-3 text-base">{r.city || "—"}</td>
        <td className="px-4 py-3 text-base">{r.medium || "—"}</td>
        <td className="px-4 py-3 text-base"><StatusBadge status={r.status} /></td>

        <td className="px-4 py-3 text-base">{fmtDateShort(r.created_at)}</td>

        <td className="px-4 py-3 text-base">
          <div className="flex items-center gap-2">
            <PrimaryBtn size="sm" onClick={()=>openViewModal(r.lead_id)}>View</PrimaryBtn>
            <SecondaryBtn size="sm" onClick={()=>openEditModal(r.lead_id)}>Edit</SecondaryBtn>
            <DeleteBtn size="sm" onClick={()=>handleDelete(r.lead_id)} />
          </div>
        </td>
      </tr>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Inquiries</h1>
          <nav className="text-sm text-slate-500 mt-1">
            <ol className="list-reset flex">
              <li><a className="hover:text-slate-700 text-slate-500">Dashboard</a></li>
              <li className="mx-2">/</li>
              <li className="text-slate-700 font-medium">Inquiry Management</li>
            </ol>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <FileUploadBtn onChange={(e) => {
            const f = e.target?.files && e.target.files[0];
            if (f) handleCsvFile(f);
          }}>
            <Icon name="upload" /> Import CSV
          </FileUploadBtn>

          <SecondaryBtn onClick={handleExportCsv}><Icon name="download" /> Export CSV</SecondaryBtn>

          <CreateBtn onClick={openCreateModal}><Icon name="plus" /> Create New</CreateBtn>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-lg p-4 shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="col-span-2">
            <FormField label="Search">
              <div className="mt-1 flex items-center">
                <Icon name="search" />
                <TextInput
                  value={search}
                  onChange={(v) => setSearch(v)}
                  placeholder="Search school, contact, phone, city..."
                />
              </div>
            </FormField>
          </div>

          <div>
            <FormField label="Status">
              <Select
                value={status}
                onChange={(v) => setStatus(v)}
                options={STATUS_OPTIONS.map(s => ({ value: s, label: s || "Any" }))}
              />
            </FormField>
          </div>

          <div>
            <FormField label="Date range">
              <div className="flex gap-2">
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="border rounded px-2 py-2 text-base w-1/2" />
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="border rounded px-2 py-2 text-base w-1/2" />
              </div>
            </FormField>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-lg shadow-sm overflow-hidden" key={tableKey}>
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="text-sm text-slate-600">Showing page {pagination.page || 1} — {pagination.total || 0} results</div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-500">Page size</label>
            <select value={pageSize} onChange={(e)=>{ setPageSize(Number(e.target.value)); setPage(1); }} className="border rounded px-3 py-2 text-sm">
              {[10,20,50,100].map(n=> <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="px-4 py-3 text-base font-medium">ID</th>
                <th className="px-4 py-3 text-base font-medium">School</th>
                <th className="px-4 py-3 text-base font-medium">Contact</th>
                <th className="px-4 py-3 text-base font-medium">Email</th>
                <th className="px-4 py-3 text-base font-medium">City</th>
                <th className="px-4 py-3 text-base font-medium">Medium</th>
                <th className="px-4 py-3 text-base font-medium">Status</th>
                <th className="px-4 py-3 text-base font-medium">Created</th>
                <th className="px-4 py-3 text-base font-medium">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr><td colSpan="9" className="p-12 text-center text-slate-500 text-lg">Loading…</td></tr>
              ) : data.length ? data.map(r => <Row key={r.lead_id} r={r} />) : (
                <tr><td colSpan="9" className="p-12 text-center text-slate-500 text-lg">No results</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t flex items-center justify-between">
          <div className="text-sm text-slate-600">
            {pagination.total ? `Showing ${(pagination.page-1)*pagination.pageSize + 1} - ${Math.min(pagination.page*pagination.pageSize, pagination.total)} of ${pagination.total}` : "—"}
          </div>
          <div className="flex items-center gap-2">
            <button disabled={pagination.page <= 1} onClick={() => { const next = Math.max(1, pagination.page-1); setPage(next); fetchPage(next); }} className="px-3 py-1 border rounded bg-white text-sm disabled:opacity-50">Prev</button>
            <div className="text-sm">Page</div>
            <input type="number" min="1" max={totalPages} value={page} onChange={(e) => { const v = Math.max(1, Number(e.target.value || 1)); setPage(v); fetchPage(v); }} className="w-16 border rounded px-2 py-1 text-sm" />
            <div className="text-sm">/ {totalPages}</div>
            <button disabled={page >= totalPages} onClick={() => { const next = Math.min(totalPages, page+1); setPage(next); fetchPage(next); }} className="px-3 py-1 border rounded bg-white text-sm disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>

      {/* Hidden file input for CSV import (fallback) */}
      <input type="file" accept=".csv" ref={fileInputRef} style={{ display: "none" }} onChange={(e) => {
        const f = e.target.files && e.target.files[0];
        if (f) handleCsvFile(f);
        e.target.value = "";
      }} />

      {/* Import progress */}
      {importing && (
        <div className="fixed bottom-6 right-6 bg-white border rounded-lg p-3 shadow flex flex-col gap-2 w-80">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Importing CSV</div>
            <div className="text-xs text-slate-500">{importProgress.processed}/{importProgress.total}</div>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded overflow-hidden">
            <div style={{ width: `${(importProgress.processed/importProgress.total)*100 || 0}%` }} className="h-2 bg-indigo-500"></div>
          </div>
          {importProgress.errors && importProgress.errors.length > 0 && (
            <div className="text-xs text-rose-600">Errors: {importProgress.errors.length} (see console)</div>
          )}
        </div>
      )}

      {/* Modal: Create/Edit Inquiry */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30" onClick={() => setModalOpen(false)} />

          <div className="relative z-10 w-full max-w-2xl bg-white rounded-lg shadow-lg overflow-auto max-h-[90vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="flex items-center gap-3">
                <img src="/images/Ank_Logo.png" alt="logo" className="h-10 w-10 object-contain" />
                <div>
                  <div className="text-lg font-semibold">{isEditing ? "Edit Inquiry" : "New Inquiry"}</div>
                  <div className="text-xs text-slate-400">One-page form</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setModalOpen(false)} className="text-sm text-slate-500 hover:text-slate-700">Close</button>
              </div>
            </div>

            <form onSubmit={submitForm} className="p-4 space-y-3" autoComplete="off">
              <FormField label="School name *" required error={!form.school_name && formSubmitting ? "Required" : undefined}>
                <TextInput
                  value={form.school_name}
                  onChange={(v) => setForm(s=>({...s, school_name: v}))}
                  placeholder="School name"
                />
              </FormField>

              <FormField label="Contact name *" required error={!form.contact_name && formSubmitting ? "Required" : undefined}>
                <TextInput
                  value={form.contact_name}
                  onChange={(v) => setForm(s=>({...s, contact_name: v}))}
                  placeholder="Contact name"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-2">
                <FormField label="Phone">
                  <TextInput value={form.phone} onChange={(v) => setForm(s=>({...s, phone: v}))} placeholder="Phone" />
                </FormField>

                <FormField label="Email">
                  <TextInput value={form.email} onChange={(v) => setForm(s=>({...s, email: v}))} placeholder="Email" />
                </FormField>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <FormField label="City"><TextInput value={form.city} onChange={(v) => setForm(s=>({...s, city: v}))} /></FormField>
                <FormField label="State"><TextInput value={form.state} onChange={(v) => setForm(s=>({...s, state: v}))} /></FormField>
                <FormField label="Pincode"><TextInput value={form.pincode} onChange={(v) => setForm(s=>({...s, pincode: v}))} /></FormField>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <FormField label="Students"><TextInput value={form.students_count} onChange={(v) => setForm(s=>({...s, students_count: v}))} /></FormField>

                <FormField label="Assigned to (optional)">
                  <Select
                    value={form.assigned_to_employee_id || ""}
                    onChange={(v) => setForm(s=>({...s, assigned_to_employee_id: v || ""}))}
                    options={[{ value: "", label: "Unassigned" }].concat((employees || []).map(emp => ({ value: emp.employee_id, label: emp.full_name || emp.username })))}
                  />
                </FormField>

                <FormField label="Status">
                  <Select
                    value={form.status || "new"}
                    onChange={(v) => setForm(s=>({...s, status: v || "new"}))}
                    options={[{ value: "new", label: "new" }].concat(["contacted","qualified","converted","lost"].map(s => ({ value: s, label: s })))}
                  />
                </FormField>
              </div>

              <FormField label="Medium">
                <Select value={form.medium_id || ""} onChange={(v) => setForm(s=>({...s, medium_id: v || "", medium_name: ""}))} options={[{value:"",label:"— choose —"}].concat((lookups.mediums || []).map(m => ({ value: m.medium_id, label: m.medium_name })))} />
                <div className="text-xs text-slate-400 mt-1">Or type medium name</div>
                <TextInput value={form.medium_name} onChange={(v) => setForm(s=>({...s, medium_name: v, medium_id: ""}))} placeholder="e.g. English" />
              </FormField>

              <div className="grid grid-cols-2 gap-2">
                <FormField label="Std. from">
                  <Select value={form.std_from_id || ""} onChange={(v) => setForm(s=>({...s, std_from_id: v || "", std_from_name: ""}))} options={[{value:"",label:"—"}].concat((lookups.standards || []).map(s => ({ value: s.std_id, label: s.std_name })))} />
                  <TextInput value={form.std_from_name} onChange={(v) => setForm(s=>({...s, std_from_name: v, std_from_id: ""}))} placeholder="Or type standard name" />
                </FormField>

                <FormField label="Std. to">
                  <Select value={form.std_to_id || ""} onChange={(v) => setForm(s=>({...s, std_to_id: v || "", std_to_name: ""}))} options={[{value:"",label:"—"}].concat((lookups.standards || []).map(s => ({ value: s.std_id, label: s.std_name })))} />
                  <TextInput value={form.std_to_name} onChange={(v) => setForm(s=>({...s, std_to_name: v, std_to_id: ""}))} placeholder="Or type standard name" />
                </FormField>
              </div>

              <FormField label="Message">
                <TextArea value={form.message} onChange={(v) => setForm(s=>({...s, message: v}))} rows={4} />
              </FormField>

              <div className="flex items-center gap-3">
                <ToggleSwitch checked={!!form.consent} onChange={(val) => setForm(s => ({ ...s, consent: val }))} />
                <div className="text-sm">Consent to be contacted</div>
              </div>

              <div className="flex items-center gap-2">
                <SaveBtn type="submit" loading={formSubmitting} />
                <CancelBtn onClick={() => setModalOpen(false)} />
                {formSuccess && <div className="text-sm text-emerald-600">{isEditing ? "Updated" : "Created"}</div>}
                {formError && <div className="text-sm text-rose-600">{formError}</div>}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View-only modal */}
      {viewOpen && viewData && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30" onClick={() => setViewOpen(false)} />
          <div className="relative z-10 w-full max-w-xl bg-white rounded-lg shadow-lg overflow-auto max-h-[90vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div>
                <div className="text-lg font-semibold">Inquiry #{viewData.lead_id}</div>
                <div className="text-xs text-slate-400">View details</div>
              </div>
              <div>
                <button onClick={() => setViewOpen(false)} className="text-sm text-slate-500">Close</button>
              </div>
            </div>

            <div className="p-4 space-y-3 text-base">
              <div><span className="font-medium">School:</span> {viewData.school_name}</div>
              <div><span className="font-medium">Contact:</span> {viewData.contact_name} — {viewData.phone}</div>
              <div><span className="font-medium">Email:</span> {viewData.email || "—"}</div>
              <div><span className="font-medium">City / State:</span> {viewData.city || "—"} / {viewData.state || "—"}</div>
              <div><span className="font-medium">Pincode:</span> {viewData.pincode || "—"}</div>
              <div><span className="font-medium">Students:</span> {viewData.students_count || "—"}</div>
              <div><span className="font-medium">Medium:</span> {viewData.medium || viewData.medium_name || "—"}</div>
              <div><span className="font-medium">Std range:</span> {viewData.std_from || viewData.std_from_name || "—"} — {viewData.std_to || viewData.std_to_name || "—"}</div>
              <div><span className="font-medium">Message:</span><div className="mt-2 text-sm text-slate-700 p-2 bg-slate-50 rounded">{viewData.message || "—"}</div></div>
              <div><span className="font-medium">Status:</span> <StatusBadge status={viewData.status} /></div>
              <div><span className="font-medium">Assigned to:</span> {viewData.assigned_to_employee_id || "—"}</div>
              <div><span className="font-medium">Created:</span> {fmtDateShort(viewData.created_at)}</div>
              <div><span className="font-medium">Updated:</span> {fmtDateShort(viewData.updated_at)}</div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
