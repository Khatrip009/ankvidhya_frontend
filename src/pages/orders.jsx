// src/pages/orders.jsx
import React, { useEffect, useState, useCallback } from "react";
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
  Select,
} from "../components/input.jsx";
import ERPIcons from "../components/icons.jsx";
import { useToast } from "../hooks/useToast.jsx";

const DEFAULT_PAGE_SIZE = 25;
const STATUS_OPTIONS = ["", "draft", "submitted", "confirmed", "cancelled"];
const DEFAULT_LOGO = "/images/Ank_Logo.png";

function StatusBadge({ status }) {
  const s = (status || "").toLowerCase();
  const map = {
    draft: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
    submitted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400",
    confirmed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400",
    cancelled: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-400",
  };
  return (
    <span className={`inline-flex text-sm font-medium px-2 py-1 rounded ${map[s] || map.draft}`}>
      {s || "draft"}
    </span>
  );
}

export default function OrdersPage() {
  const toast = useToast();

  // Filters
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [schoolIdFilter, setSchoolIdFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Table refresh key
  const [tableKey, setTableKey] = useState(0);

  // Lookups
  const [mediums, setMediums] = useState([]);
  const [standards, setStandards] = useState([]);
  const [convertedLeads, setConvertedLeads] = useState([]);

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewData, setViewData] = useState(null);
  const [strengthsOpen, setStrengthsOpen] = useState(false);
  const [strengthsOrderId, setStrengthsOrderId] = useState(null);
  const [strengthsRows, setStrengthsRows] = useState([]);

  // Create form
  const [form, setForm] = useState(getDefaultForm());
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Invoice state
  const [orderInvoiceMap, setOrderInvoiceMap] = useState({});

  useEffect(() => { loadLookups(); }, []);

  // Refetch table on filter change
  useEffect(() => {
    setTableKey(k => k + 1);
  }, [search, status, schoolIdFilter, fromDate, toDate]);

  function getDefaultForm() {
    return {
      lead_id: "",
      school_id: "",
      contact_name: "",
      phone: "",
      email: "",
      billing_name: "",
      billing_address: "",
      billing_city: "",
      billing_state: "",
      billing_pincode: "",
      shipping_address: "",
      shipping_city: "",
      shipping_state: "",
      shipping_pincode: "",
      strengths: [],
      notes: "",
      discount_amount: 0,
      tax_percent: 0,
    };
  }

  // -------------------------------------------------------------------------
  // Lookups – try leads/lookups first, fallback to master endpoints
  // -------------------------------------------------------------------------
  async function loadLookups() {
    try {
      let lookupsRes = null;
      try {
        lookupsRes = await api.get("/api/leads/lookups");
      } catch { /* fallback */ }
      if (lookupsRes) {
        setMediums(lookupsRes.media || lookupsRes.mediums || []);
        setStandards(lookupsRes.standards || []);
      } else {
        const [mRes, sRes] = await Promise.all([
          api.get("/api/master/mediums"),
          api.get("/api/master/standards"),
        ]);
        setMediums(mRes?.data || []);
        setStandards(sRes?.data || []);
      }
    } catch (err) {
      console.error("Lookup load failed", err);
      toast.error("Failed to load dropdown data");
    }

    try {
      const leadsRes = await api.get("/api/leads", {
        query: { status: "converted", page: 1, pageSize: 500 },
      });
      setConvertedLeads((leadsRes?.data || []).map(r => ({
        lead_id: r.lead_id,
        school_id: r.school_id || null,
        school_name: r.school_name || r.billing_name || "",
      })));
    } catch (err) {
      console.error("Converted leads load failed", err);
      toast.error("Failed to load converted leads");
    }
  }

  // -------------------------------------------------------------------------
  // Table columns & fetch callback
  // -------------------------------------------------------------------------
  const columns = [
    { Header: "Order ID", accessor: "order_id", width: 80 },
    {
      Header: "School",
      accessor: (r) => r.school_name || r.billing_name || "—",
      Cell: ({ value }) => <span className="font-medium">{value}</span>,
    },
    {
      Header: "Contact",
      id: "contact",
      accessor: (r) => (
        <div>
          <div className="font-medium">{r.contact_name || "—"}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">{r.phone}</div>
        </div>
      ),
    },
    { Header: "Status", accessor: (r) => <StatusBadge status={r.status} /> },
    { Header: "Order Date", accessor: (r) => new Date(r.order_date || r.created_at).toLocaleDateString() },
    { Header: "Total", accessor: (r) => r.total_amount != null ? `₹${r.total_amount}` : "—" },
    {
      Header: "Actions",
      accessor: (r) => (
        <div className="flex flex-wrap gap-1">
          <IconBtn icon={ERPIcons.Eye} label="View" size="sm" onClick={() => openView(r.order_id)} />
          <IconBtn icon={ERPIcons.Play} label="Generate" size="sm" onClick={() => handleGenerate(r.order_id)} />
          <IconBtn icon={ERPIcons.Refresh} label="Reprice" size="sm" onClick={() => handleReprice(r.order_id)} />
          <IconBtn icon={ERPIcons.Save} label="Confirm" size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => handleConfirm(r)} />
          <IconBtn icon={ERPIcons.Delete} label="Delete" size="sm" onClick={() => handleDeleteOrder(r.order_id)} className="hover:bg-rose-50 dark:hover:bg-rose-900/20" />
        </div>
      ),
    },
  ];

  const onFetch = useCallback(async ({ page = 1, pageSize = DEFAULT_PAGE_SIZE, sortBy, sortDir }) => {
    try {
      const res = await api.get("/api/orders", {
        query: {
          page,
          pageSize,
          search: search || undefined,
          status: status || undefined,
          school_id: schoolIdFilter || undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
          sortBy: sortBy || undefined,
          sortDir: sortDir || undefined,
        },
      });
      return {
        data: res?.data || [],
        total: res?.pagination?.total || 0,
      };
    } catch (err) {
      console.error("Fetch orders error", err);
      toast.error("Failed to load orders");
      return { data: [], total: 0 };
    }
  }, [search, status, schoolIdFilter, fromDate, toDate, toast]);

  // -------------------------------------------------------------------------
  // Create / Edit logic
  // -------------------------------------------------------------------------
  const openCreateModal = () => {
    setForm(getDefaultForm());
    setFormError("");
    setCreateOpen(true);
  };

  const onSelectLead = async (leadId) => {
    if (!leadId) {
      setForm(f => ({ ...f, lead_id: null, school_id: null, billing_name: "" }));
      return;
    }
    const lead = convertedLeads.find(c => String(c.lead_id) === String(leadId));
    setForm(f => ({
      ...f,
      lead_id: leadId,
      school_id: lead?.school_id || "",
      billing_name: lead?.school_name || "",
    }));
    try {
      const { data } = await api.get(`/api/leads/${leadId}`);
      if (data) {
        setForm(f => ({
          ...f,
          contact_name: data.contact_name || f.contact_name,
          phone: data.phone || f.phone,
          email: data.email || f.email,
          billing_name: data.school_name || f.billing_name,
          billing_city: data.city || f.billing_city,
          billing_state: data.state || f.billing_state,
          billing_pincode: data.pincode || f.billing_pincode,
          shipping_city: data.city || f.shipping_city,
          shipping_state: data.state || f.shipping_state,
          shipping_pincode: data.pincode || f.shipping_pincode,
        }));
      }
    } catch { /* non-critical */ }
  };

  const addStrengthRow = () => setForm(f => ({ ...f, strengths: [...f.strengths, { medium_id: "", std_id: "", students: 0 }] }));
  const removeStrengthRow = (i) => setForm(f => ({ ...f, strengths: f.strengths.filter((_, idx) => idx !== i) }));
  const updateStrength = (i, key, val) => setForm(f => {
    const strengths = f.strengths.map((s, idx) => idx === i ? { ...s, [key]: val } : s);
    return { ...f, strengths };
  });

  const submitOrder = async (e) => {
    e?.preventDefault?.();
    setFormSubmitting(true);
    setFormError("");
    try {
      if (!form.lead_id) throw new Error("Please select a converted lead.");
      const contactName = (form.contact_name || form.billing_name || "").trim();
      if (!contactName) throw new Error("Contact name is required.");

      const payload = {
        lead_id: Number(form.lead_id),
        school_id: form.school_id ? Number(form.school_id) : null,
        contact_name: contactName,
        phone: form.phone || null,
        email: form.email || null,
        billing_name: form.billing_name || null,
        billing_address: form.billing_address || null,
        billing_city: form.billing_city || null,
        billing_state: form.billing_state || null,
        billing_pincode: form.billing_pincode || null,
        shipping_address: form.shipping_address || form.billing_address || null,
        shipping_city: form.shipping_city || form.billing_city || null,
        shipping_state: form.shipping_state || form.billing_state || null,
        shipping_pincode: form.shipping_pincode || form.billing_pincode || null,
        items: [{ description: "AUTO: placeholder", qty: 1, unit_price: 0 }],
        notes: form.notes || null,
        discount_amount: Number(form.discount_amount) || 0,
        tax_percent: Number(form.tax_percent) || 0,
      };

      const res = await api.post("/api/orders", payload);
      const orderId = res?.order_id || res?.data?.order_id;
      if (!orderId) throw new Error("Order created but no ID returned.");

      const strengthsPayload = form.strengths
        .map(s => ({ medium_id: s.medium_id ? Number(s.medium_id) : null, std_id: s.std_id ? Number(s.std_id) : null, students_cnt: Number(s.students) || 0 }))
        .filter(s => s.medium_id || s.std_id || s.students_cnt > 0);

      if (strengthsPayload.length) {
        try {
          await api.post(`/api/orders/${orderId}/strengths`, { strengths: strengthsPayload });
        } catch { toast.warning("Strengths could not be saved; you can add them later."); }
      }

      // Auto‑generate + reprice
      try {
        await api.post(`/api/orders/${orderId}/generate`);
        await api.post(`/api/orders/${orderId}/reprice`);
      } catch { toast.warning("Auto‑generate/reprice failed; you can run them manually."); }

      toast.success("Order created successfully");
      setCreateOpen(false);
      setTableKey(k => k + 1);
      setTimeout(() => openView(orderId), 300);
    } catch (err) {
      console.error("Create order error", err);
      setFormError(err?.response?.data?.message || err?.message || "Failed to create order");
    } finally {
      setFormSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // View order & actions
  // -------------------------------------------------------------------------
  const openView = async (id) => {
    try {
      const res = await api.get(`/api/orders/${id}`, { query: { include: "items,strengths,requirements" } });
      if (res?.data) {
        setViewData(res.data);
        setViewOpen(true);
        // fetch invoice
        try {
          const invRes = await api.get(`/api/orders/${id}/invoice`);
          const inv = invRes?.data || {};
          if (inv.invoice_id) setOrderInvoiceMap(prev => ({ ...prev, [id]: inv }));
        } catch { /* no invoice yet */ }
      }
    } catch (err) {
      console.error("View order error", err);
      toast.error("Failed to load order details");
    }
  };

  const handleGenerate = async (orderId) => {
    if (!window.confirm("Generate requirements for this order?")) return;
    try {
      await api.post(`/api/orders/${orderId}/generate`);
      toast.success("Requirements generated");
      openView(orderId);
    } catch (err) {
      toast.error("Failed to generate requirements");
    }
  };

  const handleReprice = async (orderId) => {
    if (!window.confirm("Reprice this order?")) return;
    try {
      await api.post(`/api/orders/${orderId}/reprice`);
      toast.success("Reprice completed");
      openView(orderId);
    } catch (err) {
      toast.error("Failed to reprice");
    }
  };

  const handleConfirm = async (order) => {
    if (!window.confirm("Confirm this order? The linked lead will be removed.")) return;
    try {
      const res = await api.post(`/api/orders/${order.order_id}/confirm`);
      if (res?.invoice_id) setOrderInvoiceMap(prev => ({ ...prev, [order.order_id]: res }));
      if (order.lead_id) {
        try { await api.delete(`/api/leads/${order.lead_id}`); } catch {}
      }
      toast.success("Order confirmed");
      setTableKey(k => k + 1);
      openView(order.order_id);
    } catch (err) {
      toast.error("Failed to confirm order");
    }
  };

  const handleDeleteOrder = async (id) => {
    if (!window.confirm("Delete this order? This cannot be undone.")) return;
    try {
      await api.delete(`/api/orders/${id}`);
      toast.success("Order deleted");
      setTableKey(k => k + 1);
      setViewOpen(false);
    } catch (err) {
      toast.error("Failed to delete order");
    }
  };

  // -------------------------------------------------------------------------
  // Strengths modal (edit after creation)
  // -------------------------------------------------------------------------
  const openStrengthsModal = async (orderId) => {
    setStrengthsOrderId(orderId);
    try {
      const res = await api.get(`/api/orders/${orderId}/strengths`);
      setStrengthsRows(res?.data || []);
    } catch { setStrengthsRows([]); }
    setStrengthsOpen(true);
  };

  const addStrengthRowInModal = () => setStrengthsRows(s => [...s, { medium_id: "", std_id: "", students: 0 }]);
  const removeStrengthRowInModal = (i) => setStrengthsRows(s => s.filter((_, idx) => idx !== i));
  const updateStrengthRowInModal = (i, key, val) =>
    setStrengthsRows(s => s.map((r, idx) => idx === i ? { ...r, [key]: val } : r));

  const saveStrengthsModal = async () => {
    if (!strengthsOrderId) return;
    try {
      const payload = strengthsRows.map(s => ({
        medium_id: s.medium_id ? Number(s.medium_id) : null,
        std_id: s.std_id ? Number(s.std_id) : null,
        students_cnt: Number(s.students) || 0,
      }));
      await api.post(`/api/orders/${strengthsOrderId}/strengths`, { strengths: payload });
      toast.success("Strengths saved");
      setStrengthsOpen(false);
      openView(strengthsOrderId);
    } catch (err) {
      toast.error("Failed to save strengths");
    }
  };

  // -------------------------------------------------------------------------
  // Invoice helpers
  // -------------------------------------------------------------------------
  const ensureInvoiceForOrder = async (orderId) => {
    const existing = orderInvoiceMap[orderId];
    if (existing) return existing;
    // Try to create an invoice
    try {
      const res = await api.post(`/api/orders/${orderId}/invoice`);
      if (res?.invoice_id) {
        setOrderInvoiceMap(prev => ({ ...prev, [orderId]: res }));
        return res;
      }
    } catch { /* fallback to GET */ }
    try {
      const res = await api.get(`/api/orders/${orderId}/invoice`);
      const inv = res?.data;
      if (inv?.invoice_id) {
        setOrderInvoiceMap(prev => ({ ...prev, [orderId]: inv }));
        return inv;
      }
    } catch { /* no invoice */ }
    return null;
  };

  const handleInvoiceGenerate = async (orderId) => {
    const inv = await ensureInvoiceForOrder(orderId);
    if (inv) toast.success("Invoice already exists / created");
    else toast.error("Could not create invoice");
  };

  const handleInvoiceDownload = async (orderId) => {
    const inv = orderInvoiceMap[orderId];
    const invoiceId = inv?.invoice_id;
    if (!invoiceId) {
      toast.warning("Invoice not available");
      return;
    }
    try {
      // Use blob response for PDF download
      const blob = await api.get(`/api/invoices/${invoiceId}/pdf`, { expect: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice_${invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("Failed to download invoice");
    }
  };

  // -------------------------------------------------------------------------
  // CSV Export
  // -------------------------------------------------------------------------
  const handleExportCsv = async () => {
    try {
      const res = await api.get("/api/orders", { query: { page: 1, pageSize: 10000, search, status, school_id: schoolIdFilter, from: fromDate, to: toDate } });
      const rows = res?.data || [];
      const csv = convertToCsv(rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orders_export_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch { toast.error("Export failed"); }
  };

  function convertToCsv(rows) {
    if (!rows.length) return "";
    const header = ["order_id","school_name","contact_name","phone","status","order_date","total_amount"];
    return [
      header.join(","),
      ...rows.map(r => header.map(h => {
        let v = r[h] ?? "";
        v = String(v).replace(/"/g, '""');
        return `"${v}"`;
      }).join(","))
    ].join("\n");
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-3 sm:p-5 lg:p-6 transition-colors">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4 sm:mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Orders</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage orders from converted leads</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <OutlineBtn onClick={handleExportCsv} leftIcon={ERPIcons.Download}>Export CSV</OutlineBtn>
              <PrimaryBtn onClick={openCreateModal} leftIcon={ERPIcons.Plus}>Create Order</PrimaryBtn>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-5 shadow-sm mb-4 sm:mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <FormField label="Search">
                <TextInput
                  placeholder="Search by school, contact, phone..."
                  value={search}
                  onChange={setSearch}
                />
              </FormField>
            </div>
            <FormField label="Status">
              <Select value={status} onChange={setStatus} options={STATUS_OPTIONS.map(s => ({ value: s, label: s || "Any" }))} />
            </FormField>
            <FormField label="School">
              <Select
                value={schoolIdFilter}
                onChange={setSchoolIdFilter}
                options={[{ value: "", label: "Any" }, ...convertedLeads.map(c => ({ value: c.school_id, label: c.school_name }))]}
              />
            </FormField>
            <div className="flex gap-2">
              <FormField label="From">
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white" />
              </FormField>
              <FormField label="To">
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white" />
              </FormField>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <ServerDataTable
            key={tableKey}
            columns={columns}
            onFetch={onFetch}
            initialPageSize={DEFAULT_PAGE_SIZE}
          />
        </div>
      </div>

      {/* Create Order Modal */}
      <CreateOrderModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        form={form}
        formError={formError}
        formSubmitting={formSubmitting}
        mediums={mediums}
        standards={standards}
        convertedLeads={convertedLeads}
        onSelectLead={onSelectLead}
        onFieldChange={(field, value) => setForm(f => ({ ...f, [field]: value }))}
        addStrengthRow={addStrengthRow}
        removeStrengthRow={removeStrengthRow}
        updateStrength={updateStrength}
        onSubmit={submitOrder}
        onCancel={() => setCreateOpen(false)}
      />

      {/* View Order Modal */}
      <ViewOrderModal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        data={viewData}
        invoiceInfo={orderInvoiceMap[viewData?.order_id]}
        onGenerate={handleGenerate}
        onReprice={handleReprice}
        onConfirm={handleConfirm}
        onDelete={handleDeleteOrder}
        onEditStrengths={(orderId) => { setViewOpen(false); openStrengthsModal(orderId); }}
        onInvoiceCreate={handleInvoiceGenerate}
        onInvoiceDownload={handleInvoiceDownload}
      />

      {/* Strengths Modal */}
      <StrengthsModal
        open={strengthsOpen}
        onClose={() => setStrengthsOpen(false)}
        orderId={strengthsOrderId}
        rows={strengthsRows}
        mediums={mediums}
        standards={standards}
        onAddRow={addStrengthRowInModal}
        onRemoveRow={removeStrengthRowInModal}
        onUpdateRow={updateStrengthRowInModal}
        onSave={saveStrengthsModal}
      />
    </div>
  );
}

/* ==========================================================================
   Sub‑components (extracted for readability and mobile‑first responsiveness)
   ========================================================================== */

function CreateOrderModal({ open, onClose, form, formError, formSubmitting, mediums, standards, convertedLeads, onSelectLead, onFieldChange, addStrengthRow, removeStrengthRow, updateStrength, onSubmit, onCancel }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-4xl bg-white dark:bg-gray-800 rounded-none sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
              <img src={DEFAULT_LOGO} alt="Logo" className="h-10 sm:h-12 w-auto rounded" />
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">Create Order</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Create an order from a converted lead</p>
              </div>
              <IconBtn icon={ERPIcons.Close} onClick={onClose} />
            </div>
            <form onSubmit={onSubmit} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
              {formError && <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm">{formError}</div>}
              <FormField label="Converted Lead *" required>
                <Select value={form.lead_id} onChange={onSelectLead} options={[{ value: "", label: "— select converted lead —" }, ...convertedLeads.map(c => ({ value: c.lead_id, label: `${c.school_name} (Lead #${c.lead_id})` }))]} />
              </FormField>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Contact Name *" required>
                  <TextInput value={form.contact_name} onChange={v => onFieldChange("contact_name", v)} placeholder="Contact person" />
                </FormField>
                <FormField label="Phone">
                  <TextInput value={form.phone} onChange={v => onFieldChange("phone", v)} />
                </FormField>
                <FormField label="Email">
                  <TextInput value={form.email} onChange={v => onFieldChange("email", v)} />
                </FormField>
                <FormField label="School ID">
                  <TextInput value={form.school_id} disabled />
                </FormField>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Billing Name">
                  <TextInput value={form.billing_name} onChange={v => onFieldChange("billing_name", v)} />
                </FormField>
                <FormField label="Billing City">
                  <TextInput value={form.billing_city} onChange={v => onFieldChange("billing_city", v)} />
                </FormField>
                <FormField label="Billing State">
                  <TextInput value={form.billing_state} onChange={v => onFieldChange("billing_state", v)} />
                </FormField>
                <FormField label="Billing Pincode">
                  <TextInput value={form.billing_pincode} onChange={v => onFieldChange("billing_pincode", v)} />
                </FormField>
                <div className="sm:col-span-2">
                  <FormField label="Billing Address">
                    <TextInput value={form.billing_address} onChange={v => onFieldChange("billing_address", v)} />
                  </FormField>
                </div>
              </div>
              <hr className="border-gray-200 dark:border-gray-700" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Shipping Address">
                  <TextInput value={form.shipping_address} onChange={v => onFieldChange("shipping_address", v)} />
                </FormField>
                <FormField label="Shipping City">
                  <TextInput value={form.shipping_city} onChange={v => onFieldChange("shipping_city", v)} />
                </FormField>
                <FormField label="Shipping State">
                  <TextInput value={form.shipping_state} onChange={v => onFieldChange("shipping_state", v)} />
                </FormField>
                <FormField label="Shipping Pincode">
                  <TextInput value={form.shipping_pincode} onChange={v => onFieldChange("shipping_pincode", v)} />
                </FormField>
              </div>
              <hr className="border-gray-200 dark:border-gray-700" />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Strengths (per medium/std)</span>
                  <button type="button" onClick={addStrengthRow} className="text-sm text-indigo-600 dark:text-indigo-400">+ Add Strength</button>
                </div>
                <div className="space-y-3">
                  {form.strengths.map((s, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <Select value={s.medium_id} onChange={v => updateStrength(i, "medium_id", v)} options={[{ value: "", label: "Medium" }, ...mediums.map(m => ({ value: m.medium_id, label: m.medium_name }))]} />
                      </div>
                      <div className="col-span-5">
                        <Select value={s.std_id} onChange={v => updateStrength(i, "std_id", v)} options={[{ value: "", label: "Standard" }, ...standards.map(st => ({ value: st.std_id, label: st.std_name }))]} />
                      </div>
                      <div className="col-span-2">
                        <TextInput type="number" value={s.students} onChange={v => updateStrength(i, "students", Number(v))} placeholder="Students" />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <button type="button" onClick={() => removeStrengthRow(i)} className="text-rose-500 hover:text-rose-700"><ERPIcons.Close className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField label="Discount">
                  <TextInput type="number" value={form.discount_amount} onChange={v => onFieldChange("discount_amount", v)} />
                </FormField>
                <FormField label="Tax %">
                  <TextInput type="number" value={form.tax_percent} onChange={v => onFieldChange("tax_percent", v)} />
                </FormField>
                <FormField label="Notes">
                  <TextInput value={form.notes} onChange={v => onFieldChange("notes", v)} />
                </FormField>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <OutlineBtn onClick={onCancel}>Cancel</OutlineBtn>
                <PrimaryBtn type="submit" loading={formSubmitting}>Create Order</PrimaryBtn>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function ViewOrderModal({ open, onClose, data, invoiceInfo, onGenerate, onReprice, onConfirm, onDelete, onEditStrengths, onInvoiceCreate, onInvoiceDownload }) {
  if (!open || !data) return null;
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-3xl bg-white dark:bg-gray-800 rounded-none sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
              <img src={DEFAULT_LOGO} alt="Logo" className="h-10 sm:h-12 w-auto rounded" />
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Order #{data.order_id}</h2>
                <StatusBadge status={data.status} />
              </div>
              <IconBtn icon={ERPIcons.Close} onClick={onClose} />
            </div>
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div><span className="font-medium">School:</span> {data.school_name || data.billing_name}</div>
                <div><span className="font-medium">Contact:</span> {data.contact_name} — {data.phone}</div>
                <div><span className="font-medium">Email:</span> {data.email || "—"}</div>
                <div><span className="font-medium">Order Date:</span> {new Date(data.order_date || data.created_at).toLocaleDateString()}</div>
              </div>
              {/* Items */}
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Items</h3>
                {data.items?.length ? (
                  <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-100 dark:bg-gray-700">
                        <tr><th className="px-3 py-2 text-left">Description</th><th className="px-3 py-2 text-left">Qty</th><th className="px-3 py-2 text-left">Unit Price</th><th className="px-3 py-2 text-left">Total</th></tr>
                      </thead>
                      <tbody>
                        {data.items.map(it => (
                          <tr key={it.item_id} className="border-t border-gray-200 dark:border-gray-700">
                            <td className="px-3 py-2">{it.description}</td><td className="px-3 py-2">{it.qty}</td><td className="px-3 py-2">{it.unit_price}</td><td className="px-3 py-2">{it.line_total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="text-gray-500 dark:text-gray-400 text-sm">No items yet. Run Generate to create items.</p>}
              </div>
              {/* Strengths */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Strengths</h3>
                  <OutlineBtn size="sm" onClick={() => onEditStrengths(data.order_id)}>Edit Strengths</OutlineBtn>
                </div>
                {data.strengths?.length ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {data.strengths.map((s, i) => (
                      <div key={i} className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded text-sm">
                        <div className="font-medium">{s.medium_name || s.medium_id} / {s.std_name || s.std_id}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Students: {s.students}</div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-gray-500 dark:text-gray-400 text-sm">No strengths defined.</p>}
              </div>
              {/* Invoice */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Invoice</h3>
                  <div className="flex gap-2">
                    <OutlineBtn size="sm" onClick={() => onInvoiceCreate(data.order_id)}>Create Invoice</OutlineBtn>
                    <OutlineBtn size="sm" onClick={() => onInvoiceDownload(data.order_id)}>Download PDF</OutlineBtn>
                  </div>
                </div>
                {invoiceInfo ? (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Invoice #{invoiceInfo.invoice_number || "—"} | Status: {invoiceInfo.status || "—"} | Amount: ₹{invoiceInfo.total_amount ?? "—"}
                  </div>
                ) : <p className="text-sm text-gray-500 dark:text-gray-400">No invoice associated yet.</p>}
              </div>
              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <PrimaryBtn size="sm" onClick={() => onGenerate(data.order_id)}>Generate</PrimaryBtn>
                <SecondaryBtn size="sm" onClick={() => onReprice(data.order_id)}>Reprice</SecondaryBtn>
                <PrimaryBtn size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => onConfirm(data)}>Confirm</PrimaryBtn>
                <DangerBtn size="sm" onClick={() => onDelete(data.order_id)}>Delete</DangerBtn>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function StrengthsModal({ open, onClose, orderId, rows, mediums, standards, onAddRow, onRemoveRow, onUpdateRow, onSave }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full h-full sm:h-auto sm:max-h-[80vh] sm:max-w-xl bg-white dark:bg-gray-800 rounded-none sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="font-semibold text-gray-900 dark:text-white">Edit Strengths – Order #{orderId}</h2>
              <IconBtn icon={ERPIcons.Close} onClick={onClose} />
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <Select value={r.medium_id} onChange={v => onUpdateRow(i, "medium_id", v)} options={[{ value: "", label: "Medium" }, ...mediums.map(m => ({ value: m.medium_id, label: m.medium_name }))]} />
                  </div>
                  <div className="col-span-5">
                    <Select value={r.std_id} onChange={v => onUpdateRow(i, "std_id", v)} options={[{ value: "", label: "Standard" }, ...standards.map(s => ({ value: s.std_id, label: s.std_name }))]} />
                  </div>
                  <div className="col-span-1">
                    <TextInput type="number" value={r.students} onChange={v => onUpdateRow(i, "students", Number(v))} />
                  </div>
                  <div className="col-span-1 text-center">
                    <button onClick={() => onRemoveRow(i)} className="text-rose-500 hover:text-rose-700"><ERPIcons.Close className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
              <button onClick={onAddRow} className="text-sm text-indigo-600 dark:text-indigo-400">+ Add Strength</button>
            </div>
            <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <OutlineBtn onClick={onClose}>Cancel</OutlineBtn>
              <PrimaryBtn onClick={onSave}>Save</PrimaryBtn>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}