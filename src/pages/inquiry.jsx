// src/pages/inquiry.jsx
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../lib/api";
import { ServerDataTable } from "../components/table.jsx";
import {
  PrimaryBtn,
  SecondaryBtn,
  OutlineBtn,
  DangerBtn,
  IconBtn,
} from "../components/buttons.jsx";
import {
  FormField,
  TextInput,
  TextArea,
  Select,
  ToggleSwitch,
} from "../components/input.jsx";
import ERPIcons from "../components/icons.jsx";
import { useToast } from "../hooks/useToast.jsx";

// ---------- Constants ----------
const DEFAULT_PAGE_SIZE = 20;
const STATUS_OPTIONS = ["", "new", "contacted", "qualified", "converted", "lost"];
const DEFAULT_LOGO = "/images/Ank_Logo.png";

function StatusBadge({ status }) {
  const s = (status || "").toLowerCase();
  const map = {
    new: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-400",
    contacted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400",
    qualified: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-400",
    converted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400",
    lost: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-400",
  };
  return (
    <span className={`inline-flex text-sm font-medium px-2 py-1 rounded ${map[s] || "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300"}`}>
      {s || "—"}
    </span>
  );
}

function fmtDateShort(s) {
  if (!s) return "—";
  try { return new Date(s).toLocaleString(); } catch { return s; }
}

export default function InquiryPage() {
  const toast = useToast();

  // Filters & pagination
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Table data (handled by ServerDataTable's onFetch)
  const [tableKey, setTableKey] = useState(0);

  // Lookups
  const [mediums, setMediums] = useState([]);
  const [standards, setStandards] = useState([]);
  const [employees, setEmployees] = useState([]);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(getDefaultForm());
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // View modal
  const [viewOpen, setViewOpen] = useState(false);
  const [viewData, setViewData] = useState(null);

  // Import progress
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ processed: 0, total: 0, errors: [] });

  // Hidden file input for import
  const fileInputRef = useRef(null);

  // Load lookups on mount
  useEffect(() => {
    (async () => {
      try {
        const [medRes, stdRes, empRes] = await Promise.all([
          api.get("/api/master/lookups", { query: { type: "mediums,standards" } }),
          api.get("/api/master/lookups", { query: { type: "standards" } }),
          api.get("/api/employees", { query: { pageSize: 500 } }),
        ]);
        setMediums(medRes?.data?.mediums || medRes?.mediums || []);
        setStandards(stdRes?.data?.standards || stdRes?.standards || []);
        setEmployees(empRes?.data || []);
      } catch (err) {
        console.error("Lookup load failed", err);
        toast.error("Failed to load dropdown data");
      }
    })();
  }, []);

  function getDefaultForm() {
    return {
      school_name: "",
      contact_name: "",
      phone: "",
      email: "",
      city: "",
      state: "",
      pincode: "",
      students_count: "",
      medium_id: "",
      medium_name: "",
      std_from_id: "",
      std_from_name: "",
      std_to_id: "",
      std_to_name: "",
      message: "",
      source: "website",
      consent: true,
      assigned_to_employee_id: "",
      status: "new",
    };
  }

  // ---------- Modal handlers ----------
  const openCreate = () => {
    setIsEditing(false);
    setEditingId(null);
    setForm(getDefaultForm());
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = async (id) => {
    try {
      const res = await api.get(`/api/leads/${id}`);
      const d = res?.data || res;
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
          medium_name: d.medium || d.medium_name || "",
          std_from_id: d.std_from_id || "",
          std_from_name: d.std_from || d.std_from_name || "",
          std_to_id: d.std_to_id || "",
          std_to_name: d.std_to || d.std_to_name || "",
          message: d.message || "",
          source: d.source || "website",
          consent: d.consent !== false,
          assigned_to_employee_id: d.assigned_to_employee_id || "",
          status: d.status || "new",
        });
        setIsEditing(true);
        setEditingId(id);
        setFormError("");
        setModalOpen(true);
      }
    } catch (err) {
      console.error("Failed to load lead", err);
      toast.error("Failed to load record for edit");
    }
  };

  const openView = async (id) => {
    try {
      const res = await api.get(`/api/leads/${id}`);
      const d = res?.data || res;
      if (d) {
        setViewData(d);
        setViewOpen(true);
      }
    } catch (err) {
      console.error("Failed to load lead", err);
      toast.error("Failed to load record");
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setFormError("");
  };

  // ---------- Form submit ----------
  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setFormSubmitting(true);
    setFormError("");

    if (!form.school_name?.trim() || !form.contact_name?.trim()) {
      setFormError("School name and contact name are required.");
      setFormSubmitting(false);
      return;
    }

    const payload = {
      school_name: form.school_name.trim(),
      contact_name: form.contact_name.trim(),
      phone: form.phone || null,
      email: form.email || null,
      city: form.city || null,
      state: form.state || null,
      pincode: form.pincode || null,
      students_count: form.students_count || null,
      medium_id: form.medium_id || undefined,
      medium_name: form.medium_name || undefined,
      std_from_id: form.std_from_id || undefined,
      std_from_name: form.std_from_name || undefined,
      std_to_id: form.std_to_id || undefined,
      std_to_name: form.std_to_name || undefined,
      message: form.message || null,
      source: form.source || "website",
      consent: !!form.consent,
      assigned_to_employee_id: form.assigned_to_employee_id || undefined,
      status: form.status || "new",
    };

    try {
      if (isEditing && editingId) {
        await api.put(`/api/leads/${editingId}`, payload);
        toast.success("Inquiry updated");
      } else {
        await api.post("/api/leads", payload);
        toast.success("Inquiry created");
      }
      closeModal();
      setTableKey(k => k + 1);
    } catch (err) {
      console.error("Save error", err);
      setFormError(err?.response?.data?.message || err?.message || "Save failed");
      toast.error(err?.response?.data?.message || "Failed to save inquiry");
    } finally {
      setFormSubmitting(false);
    }
  };

  // ---------- Delete ----------
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this inquiry?")) return;
    try {
      await api.delete(`/api/leads/${id}`);
      toast.success("Inquiry deleted");
      setTableKey(k => k + 1);
    } catch (err) {
      console.error("Delete error", err);
      toast.error(err?.response?.data?.message || "Delete failed");
    }
  };

  // ---------- Export CSV ----------
  const handleExportCsv = async () => {
    try {
      // Fetch all data for export (simplified: get a larger page)
      const res = await api.get("/api/leads", {
        query: { page: 1, pageSize: 10000, search, status, from: fromDate, to: toDate }
      });
      const rows = res?.data || [];
      const csv = convertToCsv(rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inquiries_export_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error", err);
      toast.error("Export failed");
    }
  };

  // ---------- Import CSV ----------
  const handleImportCsv = async (file) => {
    if (!file) return;
    const txt = await file.text();
    const rows = parseCsv(txt);
    if (!rows.length) {
      toast.warning("No rows found in CSV.");
      return;
    }

    setImporting(true);
    setImportProgress({ processed: 0, total: rows.length, errors: [] });
    let errors = [];
    let processed = 0;

    for (const r of rows) {
      try {
        await api.post("/api/leads", {
          school_name: r.school_name || r.school || "",
          contact_name: r.contact_name || r.contact || "",
          phone: r.phone || r.mobile || "",
          email: r.email || "",
          city: r.city || "",
          state: r.state || "",
          pincode: r.pincode || r.pin || "",
          students_count: r.students_count || r.students || "",
          medium_name: r.medium || r.medium_name || "",
          std_from_name: r.std_from || r.std_from_name || "",
          std_to_name: r.std_to || r.std_to_name || "",
          message: r.message || r.notes || "",
          source: r.source || "csv-import",
          consent: !(r.consent === "false" || r.consent === "0"),
        });
      } catch (err) {
        errors.push({ row: processed + 1, err: err?.response?.data?.message || err?.message || "error" });
      }
      processed++;
      setImportProgress(prev => ({ ...prev, processed }));
    }

    setImportProgress(prev => ({ ...prev, errors }));
    setImporting(false);
    setTableKey(k => k + 1);

    if (errors.length) {
      toast.error(`Import completed with ${errors.length} errors. Check console.`);
      console.error("Import errors:", errors);
    } else {
      toast.success("Import completed successfully.");
    }

    // Clear file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ---------- CSV helpers ----------
  function convertToCsv(rows) {
    if (!rows?.length) return "";
    const headers = ["lead_id", "school_name", "contact_name", "phone", "email", "city", "state", "pincode", "students_count", "medium", "std_from", "std_to", "message", "status", "created_at"];
    const escape = (v) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    return [
      headers.join(","),
      ...rows.map(r => headers.map(h => escape(r[h] || "")).join(","))
    ].join("\n");
  }

  function parseCsv(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return [];
    const header = lines.shift().split(",").map(h => h.trim());
    return lines.map(line => {
      const values = [];
      let cur = "", inQuote = false;
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
      header.forEach((h, i) => { obj[h] = values[i] !== undefined ? values[i] : ""; });
      return obj;
    }).filter(r => r.school_name || r.contact_name);
  }

  // ---------- Table columns & onFetch ----------
  const columns = [
    {
      Header: "ID",
      accessor: "lead_id",
      width: 80,
    },
    {
      Header: "School",
      accessor: "school_name",
      Cell: (r) => <span className="font-medium">{r.school_name}</span>,
    },
    {
      Header: "Contact",
      accessor: r => (
        <div>
          <div className="font-medium">{r.contact_name}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">{r.phone}</div>
        </div>
      ),
      id: "contact",
    },
    { Header: "Email", accessor: "email" },
    { Header: "City", accessor: "city" },
    { Header: "Medium", accessor: r => r.medium || r.medium_name || "—" },
    {
      Header: "Status",
      accessor: r => <StatusBadge status={r.status} />,
    },
    {
      Header: "Created",
      accessor: r => fmtDateShort(r.created_at),
    },
    {
      Header: "Actions",
      accessor: r => (
        <div className="flex gap-1">
          <IconBtn icon={ERPIcons.Eye} label="View" size="sm" onClick={() => openView(r.lead_id)} />
          <IconBtn icon={ERPIcons.Edit} label="Edit" size="sm" onClick={() => openEdit(r.lead_id)} />
          <IconBtn icon={ERPIcons.Delete} label="Delete" size="sm" onClick={() => handleDelete(r.lead_id)} className="hover:bg-rose-50 dark:hover:bg-rose-900/20" />
        </div>
      ),
    },
  ];

  const onFetch = useCallback(async ({ page, pageSize, sortBy, sortDir }) => {
    try {
      const query = {
        page,
        pageSize,
        search: search || undefined,
        status: status || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        sortBy: sortBy || undefined,
        sortDir: sortDir || undefined,
      };
      const res = await api.get("/api/leads", { query });
      const rows = res?.data || [];
      const total = res?.pagination?.total || rows.length || 0;
      return { data: rows, total };
    } catch (err) {
      console.error("Fetch leads error", err);
      return { data: [], total: 0 };
    }
  }, [search, status, fromDate, toDate]);

  // Force table reload when filters change
  useEffect(() => {
    setTableKey(k => k + 1);
  }, [search, status, fromDate, toDate]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-3 sm:p-5 lg:p-6 transition-colors">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4 sm:mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Inquiries</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage lead inquiries from schools</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer">
                <OutlineBtn onClick={() => fileInputRef.current?.click()} leftIcon={ERPIcons.Upload}>
                  Import CSV
                </OutlineBtn>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => handleImportCsv(e.target.files?.[0])}
                />
              </label>
              <OutlineBtn onClick={handleExportCsv} leftIcon={ERPIcons.Download}>
                Export CSV
              </OutlineBtn>
              <PrimaryBtn onClick={openCreate} leftIcon={ERPIcons.Plus}>
                New Inquiry
              </PrimaryBtn>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 sm:p-5 shadow-sm mb-4 sm:mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <FormField label="Search">
                <TextInput
                  placeholder="Search school, contact, phone..."
                  value={search}
                  onChange={setSearch}
                />
              </FormField>
            </div>
            <FormField label="Status">
              <Select
                value={status}
                onChange={setStatus}
                options={STATUS_OPTIONS.map(s => ({ value: s, label: s || "Any" }))}
              />
            </FormField>
            <div>
              <FormField label="From">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </FormField>
            </div>
            <div>
              <FormField label="To">
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </FormField>
            </div>
            <div className="flex items-end gap-2 lg:col-start-3">
              <SecondaryBtn onClick={() => setTableKey(k => k + 1)}>Filter</SecondaryBtn>
              <OutlineBtn onClick={() => { setSearch(""); setStatus(""); setFromDate(""); setToDate(""); setTableKey(k => k + 1); }}>Clear</OutlineBtn>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <ServerDataTable
            key={tableKey}
            columns={columns}
            onFetch={onFetch}
            initialPageSize={pageSize}
            selectable={false}
          />
        </div>

        {/* Import progress toast */}
        {importing && (
          <div className="fixed bottom-4 right-4 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-4 w-80">
            <div className="flex justify-between text-sm font-medium mb-2">
              <span>Importing CSV</span>
              <span>{importProgress.processed}/{importProgress.total}</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
              <div
                className="h-2 bg-indigo-500 transition-all duration-300"
                style={{ width: `${(importProgress.processed / importProgress.total) * 100 || 0}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={closeModal}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="relative w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-2xl bg-white dark:bg-slate-800 rounded-none sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
                <img
                  src={DEFAULT_LOGO}
                  alt="Logo"
                  className="h-10 sm:h-12 w-auto rounded"
                />
                <div className="flex-1">
                  <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white">
                    {isEditing ? "Edit Inquiry" : "New Inquiry"}
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Fill in the inquiry details
                  </p>
                </div>
                <IconBtn icon={ERPIcons.Close} onClick={closeModal} />
              </div>

              {/* Scrollable form */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
                {formError && (
                  <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm">
                    {formError}
                  </div>
                )}

                <FormField label="School Name *" required>
                  <TextInput
                    value={form.school_name}
                    onChange={(v) => setForm(f => ({ ...f, school_name: v }))}
                    placeholder="School name"
                  />
                </FormField>

                <FormField label="Contact Name *" required>
                  <TextInput
                    value={form.contact_name}
                    onChange={(v) => setForm(f => ({ ...f, contact_name: v }))}
                    placeholder="Contact person"
                  />
                </FormField>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Phone">
                    <TextInput value={form.phone} onChange={(v) => setForm(f => ({ ...f, phone: v }))} placeholder="Phone" />
                  </FormField>
                  <FormField label="Email">
                    <TextInput value={form.email} onChange={(v) => setForm(f => ({ ...f, email: v }))} placeholder="Email" />
                  </FormField>
                  <FormField label="City">
                    <TextInput value={form.city} onChange={(v) => setForm(f => ({ ...f, city: v }))} />
                  </FormField>
                  <FormField label="State">
                    <TextInput value={form.state} onChange={(v) => setForm(f => ({ ...f, state: v }))} />
                  </FormField>
                  <FormField label="Pincode">
                    <TextInput value={form.pincode} onChange={(v) => setForm(f => ({ ...f, pincode: v }))} />
                  </FormField>
                  <FormField label="Students">
                    <TextInput value={form.students_count} onChange={(v) => setForm(f => ({ ...f, students_count: v }))} />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Assigned to">
                    <Select
                      value={form.assigned_to_employee_id || ""}
                      onChange={(v) => setForm(f => ({ ...f, assigned_to_employee_id: v }))}
                      options={[
                        { value: "", label: "Unassigned" },
                        ...employees.map(e => ({ value: e.employee_id, label: e.full_name || e.username })),
                      ]}
                    />
                  </FormField>
                  <FormField label="Status">
                    <Select
                      value={form.status}
                      onChange={(v) => setForm(f => ({ ...f, status: v }))}
                      options={STATUS_OPTIONS.filter(Boolean).map(s => ({ value: s, label: s }))}
                    />
                  </FormField>
                </div>

                <FormField label="Medium">
                  <div className="space-y-2">
                    <Select
                      value={form.medium_id || ""}
                      onChange={(v) => setForm(f => ({ ...f, medium_id: v, medium_name: "" }))}
                      options={[
                        { value: "", label: "Choose medium" },
                        ...mediums.map(m => ({ value: m.medium_id, label: m.medium_name })),
                      ]}
                    />
                    <TextInput
                      value={form.medium_name}
                      onChange={(v) => setForm(f => ({ ...f, medium_name: v, medium_id: "" }))}
                      placeholder="Or type medium name"
                    />
                  </div>
                </FormField>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Std. From">
                    <div className="space-y-2">
                      <Select
                        value={form.std_from_id || ""}
                        onChange={(v) => setForm(f => ({ ...f, std_from_id: v, std_from_name: "" }))}
                        options={[
                          { value: "", label: "Choose standard" },
                          ...standards.map(s => ({ value: s.std_id, label: s.std_name })),
                        ]}
                      />
                      <TextInput
                        value={form.std_from_name}
                        onChange={(v) => setForm(f => ({ ...f, std_from_name: v, std_from_id: "" }))}
                        placeholder="Or type standard"
                      />
                    </div>
                  </FormField>
                  <FormField label="Std. To">
                    <div className="space-y-2">
                      <Select
                        value={form.std_to_id || ""}
                        onChange={(v) => setForm(f => ({ ...f, std_to_id: v, std_to_name: "" }))}
                        options={[
                          { value: "", label: "Choose standard" },
                          ...standards.map(s => ({ value: s.std_id, label: s.std_name })),
                        ]}
                      />
                      <TextInput
                        value={form.std_to_name}
                        onChange={(v) => setForm(f => ({ ...f, std_to_name: v, std_to_id: "" }))}
                        placeholder="Or type standard"
                      />
                    </div>
                  </FormField>
                </div>

                <FormField label="Message">
                  <TextArea
                    value={form.message}
                    onChange={(v) => setForm(f => ({ ...f, message: v }))}
                    rows={4}
                  />
                </FormField>

                <div className="flex items-center gap-3">
                  <ToggleSwitch
                    checked={form.consent}
                    onChange={(v) => setForm(f => ({ ...f, consent: v }))}
                  />
                  <label className="text-sm text-slate-700 dark:text-slate-300">Consent to be contacted</label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <OutlineBtn onClick={closeModal} disabled={formSubmitting}>Cancel</OutlineBtn>
                  <PrimaryBtn type="submit" loading={formSubmitting}>
                    {isEditing ? "Update" : "Create"}
                  </PrimaryBtn>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Modal */}
      <AnimatePresence>
        {viewOpen && viewData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setViewOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="relative w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-xl bg-white dark:bg-slate-800 rounded-none sm:rounded-2xl shadow-2xl overflow-y-auto"
            >
              <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Inquiry #{viewData.lead_id}</h2>
                </div>
                <IconBtn icon={ERPIcons.Close} onClick={() => setViewOpen(false)} />
              </div>

              <div className="p-4 sm:p-6 space-y-3 text-sm text-slate-700 dark:text-slate-300">
                <div><span className="font-medium">School:</span> {viewData.school_name}</div>
                <div><span className="font-medium">Contact:</span> {viewData.contact_name} — {viewData.phone}</div>
                <div><span className="font-medium">Email:</span> {viewData.email || "—"}</div>
                <div><span className="font-medium">City / State:</span> {viewData.city || "—"} / {viewData.state || "—"}</div>
                <div><span className="font-medium">Pincode:</span> {viewData.pincode || "—"}</div>
                <div><span className="font-medium">Students:</span> {viewData.students_count || "—"}</div>
                <div><span className="font-medium">Medium:</span> {viewData.medium || viewData.medium_name || "—"}</div>
                <div><span className="font-medium">Std Range:</span> {viewData.std_from || "—"} → {viewData.std_to || "—"}</div>
                <div><span className="font-medium">Message:</span><div className="mt-1 p-2 bg-slate-100 dark:bg-slate-700 rounded">{viewData.message || "—"}</div></div>
                <div><span className="font-medium">Status:</span> <StatusBadge status={viewData.status} /></div>
                <div><span className="font-medium">Assigned to:</span> {viewData.assigned_to_employee_id || "—"}</div>
                <div><span className="font-medium">Created:</span> {fmtDateShort(viewData.created_at)}</div>
                <div><span className="font-medium">Updated:</span> {fmtDateShort(viewData.updated_at)}</div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}