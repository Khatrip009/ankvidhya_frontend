// src/pages/orders.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import api from "../lib/api";

/**
 * Orders page (Create modal auto-generate items from strengths)
 *
 * Notes about wired endpoints:
 * - lookups: GET /api/leads/lookups  -> returns { media, standards }
 * - converted leads: GET /api/leads?status=converted ...
 * - strengths: POST /api/orders/:orderId/strengths
 * - confirm: POST /api/orders/:orderId/confirm  -> returns { invoice_id }
 * - invoice generation endpoints: attempted in ensureInvoiceForOrder()
 */

const DEFAULT_PAGE_SIZE = 25;
const STATUS_OPTIONS = ["", "draft", "submitted", "confirmed", "cancelled"];

function Icon({ name, className = "h-4 w-4 inline-block mr-2" }) {
  const common = { className, "aria-hidden": true };
  switch (name) {
    case "search":
      return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 21l-4.35-4.35" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="11" cy="11" r="6" strokeWidth="1.5"/></svg>;
    case "plus":
      return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 5v14M5 12h14" strokeWidth="1.5" strokeLinecap="round"/></svg>;
    case "view":
      return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" strokeWidth="1.4"/><circle cx="12" cy="12" r="3" strokeWidth="1.4"/></svg>;
    case "delete":
      return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 6h18M8 6v14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6" strokeWidth="1.3"/><path d="M10 11v6M14 11v6" strokeWidth="1.3" strokeLinecap="round"/></svg>;
    case "generate":
      return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 12a9 9 0 1 1-9-9" strokeWidth="1.5"/><path d="M12 3v9l3 3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    case "confirm":
      return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 13l4 4L19 7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    case "reprice":
      return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 12v6a2 2 0 0 1-2 2H5" strokeWidth="1.5"/><path d="M7 7h10" strokeWidth="1.5"/><path d="M12 3v4" strokeWidth="1.5"/></svg>;
    default:
      return null;
  }
}

function fmtDateShort(s) {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return d.toLocaleString();
  } catch (e) { return s; }
}

export default function OrdersPage() {
  // filters & pagination
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [schoolIdFilter, setSchoolIdFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: DEFAULT_PAGE_SIZE, total: 0 });

  const [convertedLeads, setConvertedLeads] = useState([]);
  const [lookups, setLookups] = useState({ mediums: [], standards: [] });

  const [createOpen, setCreateOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewData, setViewData] = useState(null);

  const [strengthsOpen, setStrengthsOpen] = useState(false);
  const [strengthsOrderId, setStrengthsOrderId] = useState(null);
  const [strengthsRows, setStrengthsRows] = useState([]);

  const [requirementsPrices, setRequirementsPrices] = useState({}); // { req_id: { price, saving, loading } }

  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    lead_id: null,
    school_id: null,
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
    strengths: [], // { medium_id, std_id, students }
    notes: "",
    discount_amount: 0,
    tax_percent: 0,
  });

  // invoice-related state
  const [invoiceLoading, setInvoiceLoading] = useState(false); // for create/generate
  const [invoicePdfLoading, setInvoicePdfLoading] = useState(false);
  const [invoiceUrls, setInvoiceUrls] = useState({}); // invoice_id -> url (if server returned)
  // map order_id -> invoice info returned from server (invoice_id, invoice_number, status, total_amount)
  const [orderInvoiceMap, setOrderInvoiceMap] = useState({});

  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchFiltersLookups();
    fetchPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
    fetchPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, schoolIdFilter, fromDate, toDate, pageSize]);

  async function fetchFiltersLookups() {
    try {
      // new lookups endpoint in routes/leads.js
      const r2 = await api.get("/api/leads/lookups", { background: true });
      if (r2) {
        // server returns { media, standards } — map to UI-friendly keys
        setLookups({ mediums: r2.media || [], standards: r2.standards || [] });
      } else {
        setLookups({ mediums: [], standards: [] });
      }
    } catch (e) {
      console.warn("Failed to load lookups", e);
      setLookups({ mediums: [], standards: [] });
    }

    try {
      const res = await api.get("/api/leads", { query: { status: "converted", page: 1, pageSize: 500 }, background: true });
      if (res && res.data) {
        const mapped = res.data.map(r => ({
          lead_id: r.lead_id,
          school_id: r.school_id || null,
          school_name: r.school_name || (r.billing_name || "").slice(0, 80)
        }));
        setConvertedLeads(mapped);
      } else {
        setConvertedLeads([]);
      }
    } catch (err) {
      console.warn("Failed to load converted leads", err);
      setConvertedLeads([]);
    }
  }

  async function fetchPage(p = page) {
    setLoading(true);
    try {
      const q = {
        page: p,
        pageSize,
        search: search || undefined,
        status: status || undefined,
        school_id: schoolIdFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined
      };
      const res = await api.get("/api/orders", { query: q });
      if (res) {
        setData(res.data || []);
        setPagination(res.pagination || { page: p, pageSize, total: (res.pagination && res.pagination.total) || 0 });
      } else setData([]);
    } catch (err) {
      console.error("Fetch orders error", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  const totalPages = useMemo(() => {
    const t = (pagination && pagination.total) || 0;
    return Math.max(1, Math.ceil(t / (pagination.pageSize || pageSize)));
  }, [pagination, pageSize]);

  function openCreateModal(prefill = {}) {
    setForm({
      lead_id: prefill.lead_id || null,
      school_id: prefill.school_id || null,
      contact_name: prefill.contact_name || "",
      phone: prefill.phone || "",
      email: prefill.email || "",
      billing_name: prefill.school_name || "",
      billing_address: prefill.billing_address || "",
      billing_city: prefill.billing_city || "",
      billing_state: prefill.billing_state || "",
      billing_pincode: prefill.billing_pincode || "",
      shipping_address: prefill.shipping_address || "",
      shipping_city: prefill.shipping_city || "",
      shipping_state: prefill.shipping_state || "",
      shipping_pincode: prefill.shipping_pincode || "",
      strengths: [],
      notes: "",
      discount_amount: 0,
      tax_percent: 0,
    });
    setFormError("");
    setCreateOpen(true);
  }

  async function onSelectConvertedLead(leadId) {
    if (!leadId) {
      setForm(f => ({ ...f, lead_id: null, school_id: null }));
      return;
    }
    const mapped = convertedLeads.find(c => String(c.lead_id) === String(leadId));
    setForm(f => ({
      ...f,
      lead_id: leadId,
      school_id: mapped ? mapped.school_id : f.school_id,
      billing_name: mapped ? mapped.school_name : f.billing_name
    }));

    try {
      const res = await api.get(`/api/leads/${leadId}`);
      if (res && res.data) {
        const d = res.data;
        const billing_address = [d.city, d.state, d.pincode].filter(Boolean).join(", ");
        setForm(f => ({
          ...f,
          lead_id: d.lead_id,
          school_id: d.school_id || f.school_id,
          contact_name: d.contact_name || f.contact_name,
          phone: d.phone || f.phone,
          email: d.email || f.email,
          billing_name: d.school_name || f.billing_name,
          billing_address,
          billing_city: d.city || f.billing_city,
          billing_state: d.state || f.billing_state,
          billing_pincode: d.pincode || f.billing_pincode,
          shipping_address: f.shipping_address || billing_address,
          shipping_city: f.shipping_city || (d.city || f.shipping_city),
          shipping_state: f.shipping_state || (d.state || f.shipping_state),
          shipping_pincode: f.shipping_pincode || (d.pincode || f.shipping_pincode),
        }));
      }
    } catch (err) {
      console.warn("Failed to load lead detail for prefill", err);
    }
  }

  /* strengths helpers (create time) */
  function addStrengthRow() {
    setForm(f => ({ ...f, strengths: [...(f.strengths || []), { medium_id: "", std_id: "", students: 0 }] }));
  }
  function removeStrengthRow(i) {
    setForm(f => ({ ...f, strengths: f.strengths.filter((_, idx) => idx !== i) }));
  }
  function updateStrength(i, key, val) {
    setForm(f => {
      const strengths = f.strengths.map((s, idx) => idx === i ? { ...s, [key]: val } : s);
      return { ...f, strengths };
    });
  }

  /* ---------- Create order flow: (same as before) ---------- */
  async function submitOrder(e) {
    e && e.preventDefault();
    setFormSubmitting(true);
    setFormError("");

    try {
      // Validate lead selection
      if (!form.lead_id) throw new Error("Please select a converted lead (orders are created from converted leads).");

      const contactName = (form.contact_name || "").trim() || (form.billing_name || "").trim();
      if (!contactName) throw new Error("Contact name is required (provide contact name or billing name).");

      // Use placeholder to satisfy server constraint (qty>0 required)
      const itemsToSend = [{ description: "AUTO: placeholder (will be replaced by generated items)", qty: 1, unit_price: 0 }];

      const payload = {
        lead_id: form.lead_id ? Number(form.lead_id) : null,
        school_id: form.school_id ? Number(form.school_id) : null,
        contact_name: contactName,
        phone: form.phone || "",
        email: form.email || "",
        billing_name: form.billing_name || "",
        billing_address: form.billing_address || "",
        billing_city: form.billing_city || "",
        billing_state: form.billing_state || "",
        billing_pincode: form.billing_pincode || "",
        shipping_address: form.shipping_address || form.billing_address || "",
        shipping_city: form.shipping_city || form.billing_city || "",
        shipping_state: form.shipping_state || form.billing_state || "",
        shipping_pincode: form.shipping_pincode || form.billing_pincode || "",
        items: itemsToSend,
        notes: form.notes || "",
        discount_amount: Number(form.discount_amount) || 0,
        tax_percent: Number(form.tax_percent) || 0
      };

      const res = await api.post("/api/orders", payload);
      if (!(res && res.ok)) {
        throw new Error((res && (res.error || res.message || res.detail)) || "Failed to create order");
      }

      const createdOrderId = res.order_id || (res.data && res.data.order_id) || null;
      if (!createdOrderId) {
        // server returned ok but not order id — refresh list and exit
        setCreateOpen(false);
        fetchPage(1);
        alert("Order created.");
        return;
      }

      // Best-effort: upsert strengths if any were provided
      const strengthsPayload = (form.strengths || []).map(s => ({
        medium_id: s.medium_id ? Number(s.medium_id) : null,
        std_id: s.std_id ? Number(s.std_id) : null,
        students_cnt: Number(s.students) || 0
      })).filter(s => s.medium_id || s.std_id || s.students_cnt > 0);

      if (strengthsPayload.length) {
        try {
          await api.post(`/api/orders/${createdOrderId}/strengths`, { strengths: strengthsPayload });
        } catch (err) {
          console.warn("Failed to upsert strengths after create", err);
          // continue
          alert("Order created but failed to save strengths automatically. You can add strengths from the order view.");
        }
      }

      // Now call generate -> reprice to create requirements + auto items (best-effort)
      try {
        const g = await api.post(`/api/orders/${createdOrderId}/generate`);
        if (!(g && g.ok)) {
          console.warn("Generate returned non-ok", g);
          alert("Order created but generate failed. You can run Generate from the order view.");
        } else {
          const r = await api.post(`/api/orders/${createdOrderId}/reprice`);
          if (!(r && r.ok)) {
            console.warn("Reprice returned non-ok", r);
            alert("Requirements generated but reprice failed. Run Reprice from the order view.");
          }
        }
      } catch (err) {
        console.warn("Generate/Reprice error", err);
        alert("Order created but auto-generate/reprice failed. Check console and use Generate + Reprice from order view.");
      }

      // Success — close and refresh and open view for the new order
      setCreateOpen(false);
      fetchPage(1);
      // Open newly created order view
      setTimeout(() => openView(createdOrderId), 250);

      alert("Order created successfully. If you left Items blank, they were auto-generated from Strengths (attempted).");
    } catch (err) {
      console.error("Create order error", err);
      setFormError(err?.message || String(err));
    } finally {
      setFormSubmitting(false);
    }
  }

  /* ---------- Other actions (view/generate/reprice/confirm/delete, plus strengths modal) ---------- */
  async function openView(id) {
    try {
      const res = await api.get(`/api/orders/${id}`, { query: { include: "items,strengths,requirements" } });
      if (res && res.data) {
        setViewData(res.data);
        setViewOpen(true);

        // Try to fetch invoice info if a dedicated endpoint exists
        try {
          const invRes = await api.get(`/api/orders/${id}/invoice`, { background: true });
          if (invRes && invRes.data) {
            // normalize possible shapes
            const inv = invRes.data.invoice || invRes.data || {};
            const invoiceObj = {
              invoice_id: inv.invoice_id || inv.invoiceId || inv.id || invRes.data.invoice_id || invRes.data.invoice_id || null,
              invoice_number: inv.invoice_number || inv.invoice_number || null,
              status: inv.status || null,
              total_amount: inv.total_amount != null ? inv.total_amount : (inv.total || null)
            };
            if (invoiceObj.invoice_id) {
              setOrderInvoiceMap(prev => ({ ...(prev || {}), [id]: invoiceObj }));
            }
          }
        } catch (e) {
          // endpoint may not exist — ignore
        }

        // initialize requirement prices map (fetch book prices where applicable)
        if (res.data.requirements && res.data.requirements.length) {
          const map = {};
          for (const req of res.data.requirements) {
            const key = String(req.req_id || `${req.medium_id}-${req.std_id}-${req.item_type}-${req.book_id || ''}`);
            if (req.book_id) {
              // fetch book price
              try {
                const b = await api.get(`/api/books/${req.book_id}`, { background: true });
                map[req.req_id] = { price: (b && b.data && b.data.price != null) ? Number(b.data.price) : 100, loading: false, saving: false };
              } catch (e) {
                map[req.req_id] = { price: 100, loading: false, saving: false };
              }
            } else {
              // fallback: default 100
              map[req.req_id] = { price: 100, loading: false, saving: false };
            }
          }
          setRequirementsPrices(map);
        } else {
          setRequirementsPrices({});
        }
      } else alert("Failed to load order.");
    } catch (err) {
      console.error("Open view error", err);
      alert("Failed to load order.");
    }
  }

  async function reloadRequirements(orderId) {
    try {
      const r = await api.get(`/api/orders/${orderId}/requirements`, { background: true });
      if (r && r.data) {
        setViewData(prev => ({ ...(prev || {}), requirements: r.data }));
        // refresh prices for any book_ids present
        const map = { ...(requirementsPrices || {}) };
        for (const req of r.data) {
          if (!map[req.req_id]) {
            if (req.book_id) {
              try {
                const b = await api.get(`/api/books/${req.book_id}`, { background: true });
                map[req.req_id] = { price: (b && b.data && b.data.price != null) ? Number(b.data.price) : 100, loading: false, saving: false };
              } catch (e) {
                map[req.req_id] = { price: 100, loading: false, saving: false };
              }
            } else {
              map[req.req_id] = { price: 100, loading: false, saving: false };
            }
          }
        }
        setRequirementsPrices(map);
      }
    } catch (e) {
      console.warn("Reload requirements failed", e);
    }
  }

  async function handleGenerate(orderId) {
    if (!confirm("Generate requirements for this order?")) return;
    try {
      const res = await api.post(`/api/orders/${orderId}/generate`);
      if (res && res.ok) {
        alert("Requirements generated.");
        // explicitly reload requirements to pick up new rows
        await reloadRequirements(orderId);
        // also reload the full view if open
        if (viewOpen && viewData && viewData.order_id === orderId) openView(orderId);
      } else throw new Error((res && res.error) || "Generate failed");
    } catch (err) {
      console.error("Generate error", err);
      alert(err?.message || "Generate failed");
    }
  }

  async function handleReprice(orderId) {
    if (!confirm("Reprice this order? This will re-run pricing logic.")) return;
    try {
      const res = await api.post(`/api/orders/${orderId}/reprice`);
      if (res && res.ok) {
        alert("Reprice requested.");
        // reload view to reflect priced items
        if (viewOpen && viewData && viewData.order_id === orderId) openView(orderId);
      } else throw new Error((res && res.error) || "Reprice failed");
    } catch (err) {
      console.error("Reprice error", err);
      alert(err?.message || "Reprice failed");
    }
  }

  async function handleConfirm(order) {
    if (!confirm("Confirm this order? This will mark it confirmed on server and then delete the associated converted lead (if any).")) return;
    try {
      const res = await api.post(`/api/orders/${order.order_id}/confirm`);
      if (!(res && res.ok)) throw new Error(res?.error || "Confirm failed");

      // Server returns invoice_id for generate (per routes/leads.js). Normalize and store.
      const invoiceId = res.invoice_id || (res.invoice && (res.invoice.invoice_id || res.invoice.id)) || null;
      if (invoiceId) {
        const invObj = {
          invoice_id: invoiceId,
          invoice_number: res.invoice_number || (res.invoice && res.invoice.invoice_number) || null,
          status: res.status || (res.invoice && res.invoice.status) || 'draft',
          total_amount: res.total_amount != null ? res.total_amount : (res.invoice && res.invoice.total_amount) || null
        };
        setOrderInvoiceMap(prev => ({ ...(prev || {}), [order.order_id]: invObj }));
      }

      const leadId = Number(order.lead_id) || null;
      if (leadId) {
        try {
          await api.del(`/api/leads/${leadId}`);
        } catch (delErr) {
          console.warn("Failed to delete lead after confirm", delErr);
          alert("Order confirmed but failed to delete the linked lead. Please remove it manually.");
        }
      }

      alert("Order confirmed.");
      fetchPage(page);
      if (viewOpen && viewData && viewData.order_id === order.order_id) openView(order.order_id);
    } catch (err) {
      console.error("Confirm error", err);
      alert(err?.message || "Confirm failed");
    }
  }

  async function handleDeleteOrder(id) {
    if (!confirm("Delete this order? This cannot be undone.")) return;
    try {
      await api.del(`/api/orders/${id}`);
      fetchPage(1);
      setViewOpen(false);
    } catch (err) {
      console.error("Delete order error", err);
      alert(err?.message || "Delete failed");
    }
  }

  /* ---------- Strengths modal (edit after creation) ---------- */
  async function openStrengthsModal(orderId) {
    setStrengthsOrderId(orderId);
    setStrengthsOpen(true);
    try {
      const res = await api.get(`/api/orders/${orderId}/strengths`, { background: true });
      setStrengthsRows(res && res.data ? res.data.map(r => ({ medium_id: r.medium_id, std_id: r.std_id, students: r.students })) : []);
    } catch (e) {
      console.warn("Failed to load strengths", e);
      setStrengthsRows([]);
    }
  }

  function addStrengthRowInModal() {
    setStrengthsRows(s => [...(s || []), { medium_id: "", std_id: "", students: 0 }]);
  }
  function removeStrengthRowInModal(i) {
    setStrengthsRows(s => s.filter((_, idx) => idx !== i));
  }
  function updateStrengthRowInModal(i, key, val) {
    setStrengthsRows(s => s.map((r, idx) => idx === i ? { ...r, [key]: val } : r));
  }

  async function saveStrengthsModal() {
  if (!strengthsOrderId) return;
  const payload = strengthsRows.map(s => ({
    medium_id: s.medium_id ? Number(s.medium_id) : null,
    std_id: s.std_id ? Number(s.std_id) : null,
    students_cnt: Number(s.students) || 0
  }));

  try {
    await api.post(`/api/orders/${strengthsOrderId}/strengths`, { strengths: payload });
    alert("Strengths saved.");
    setStrengthsOpen(false);

    // Refresh requirements + view to show updated strengths (but do NOT auto-run generate)
    try {
      await reloadRequirements(strengthsOrderId);
    } catch (e) {
      console.warn("reloadRequirements after strengths save failed", e);
    }

    // refresh view if open
    if (viewOpen && viewData && viewData.order_id === strengthsOrderId) openView(strengthsOrderId);
  } catch (e) {
    console.error("Save strengths failed", e);
    alert("Failed to save strengths.");
  }
}


  /* ---------- Requirements inline price editing (client + book update) ---------- */
  function setReqPrice(reqId, price) {
    setRequirementsPrices(prev => ({ ...(prev || {}), [reqId]: { ...(prev[reqId] || {}), price } }));
  }

  async function saveReqPrice(req) {
    // req: a requirement row from viewData.requirements
    const rp = requirementsPrices[req.req_id];
    if (!rp) return;
    const newPrice = Number(rp.price || 0);
    if (isNaN(newPrice) || newPrice < 0) {
      alert("Enter a valid price >= 0");
      return;
    }

    // If req.book_id exists, update the book price globally using PUT /api/books/:id
    if (req.book_id) {
      setRequirementsPrices(prev => ({ ...(prev || {}), [req.req_id]: { ...(prev[req.req_id] || {}), saving: true } }));
      try {
        await api.put(`/api/books/${req.book_id}`, { price: newPrice });
        setRequirementsPrices(prev => ({ ...(prev || {}), [req.req_id]: { ...(prev[req.req_id] || {}), price: newPrice, saving: false } }));
        alert("Book price updated.");
        // optionally reload requirements or items / view
        if (viewData && viewData.order_id) {
          await reloadRequirements(viewData.order_id);
          openView(viewData.order_id);
        }
      } catch (e) {
        console.error("Failed to update book price", e);
        setRequirementsPrices(prev => ({ ...(prev || {}), [req.req_id]: { ...(prev[req.req_id] || {}), saving: false } }));
        alert("Failed to save price.");
      }
    } else {
      // No book_id — can't persist to backend with current endpoints.
      // Keep local price (user can run Reprice to incorporate prices if server supports).
      setRequirementsPrices(prev => ({ ...(prev || {}), [req.req_id]: { ...(prev[req.req_id] || {}), price: newPrice } }));
      alert("Price updated locally (no book_id to persist to). Use Reprice to compute items/prices server-side.");
    }
  }

  /* ---------- Invoice helpers (frontend) ---------- */

  // Try to create/fetch invoice for order. This function is defensive: it tries multiple server patterns and returns a normalized invoice object or null.
  async function ensureInvoiceForOrder(orderId) {
    // If we already have invoice info in map, return it
    const existing = orderInvoiceMap[orderId];
    if (existing) return existing;

    // Try 1: POST /api/orders/:orderId/invoice/generate (common pattern)
    try {
      const r = await api.post(`/api/orders/${orderId}/invoice/generate`);
      if (r && (r.ok || r.invoice_id || r.invoice)) {
        const inv = r.invoice || {
          invoice_id: r.invoice_id || r.invoiceId || null,
          invoice_number: r.invoice_number || null,
          status: r.status || 'draft',
          total_amount: r.total_amount != null ? r.total_amount : null
        };
        if (inv.invoice_id) {
          setOrderInvoiceMap(prev => ({ ...(prev || {}), [orderId]: inv }));
          return inv;
        }
      }
    } catch (e) {
      console.warn("/api/orders/:orderId/invoice/generate failed", e);
    }

    // Try 2: POST /api/invoices/generate-from-order (fallback)
    try {
      const r2 = await api.post(`/api/invoices/generate-from-order`, { order_id: orderId });
      if (r2 && (r2.ok || r2.invoice_id)) {
        const inv = {
          invoice_id: r2.invoice_id || r2.id || null,
          invoice_number: r2.invoice_number || null,
          status: r2.status || 'draft',
          total_amount: r2.total_amount != null ? r2.total_amount : null
        };
        if (inv.invoice_id) {
          setOrderInvoiceMap(prev => ({ ...(prev || {}), [orderId]: inv }));
          return inv;
        }
      }
    } catch (e) {
      console.warn("invoices/generate-from-order fallback failed", e);
    }

    // Try 3: GET /api/orders/:orderId/invoice  (if server exposes a read endpoint)
    try {
      const getInv = await api.get(`/api/orders/${orderId}/invoice`, { background: true });
      if (getInv && getInv.data) {
        const inv = getInv.data.invoice || getInv.data || {};
        const invoiceObj = {
          invoice_id: inv.invoice_id || inv.id || null,
          invoice_number: inv.invoice_number || null,
          status: inv.status || null,
          total_amount: inv.total_amount != null ? inv.total_amount : (inv.total || null)
        };
        if (invoiceObj.invoice_id) {
          setOrderInvoiceMap(prev => ({ ...(prev || {}), [orderId]: invoiceObj }));
          return invoiceObj;
        }
      }
    } catch (e) {
      console.warn("GET /api/orders/:orderId/invoice failed", e);
    }

    // Last resort: try POST /api/orders/:orderId/confirm but **do not** call it here automatically (confirm changes order status).
    // We'll not call confirm automatically from ensureInvoiceForOrder to avoid surprising side effects.

    return null;
  }

  // Ask server to generate PDF for an invoice; returns { ok, url, invoice_id } if server provides.
  async function generateInvoicePdf(invoiceId) {
    if (!invoiceId) throw new Error("Missing invoiceId");
    setInvoiceLoading(true);
    try {
      const res = await api.post(`/api/invoices/${invoiceId}/generate`);
      if (res && res.ok) {
        if (res.url) {
          setInvoiceUrls(prev => ({ ...(prev || {}), [invoiceId]: res.url }));
          return { ok: true, url: res.url };
        }
        return { ok: true };
      } else {
        throw new Error((res && (res.error || res.message)) || "Failed to generate PDF");
      }
    } catch (e) {
      console.error("generateInvoicePdf error", e);
      throw e;
    } finally {
      setInvoiceLoading(false);
    }
  }

  // Download invoice PDF from server; expects GET /api/invoices/:invoiceId/pdf returning application/pdf
  async function downloadInvoicePdf(invoiceId, filename = null) {
    if (!invoiceId) {
      alert("No invoiceId available to download PDF.");
      return;
    }
    setInvoicePdfLoading(true);
    try {
      // Use api.request to fetch blob (api.request supports expect:'blob')
      const blob = await api.request(`/api/invoices/${invoiceId}/pdf`, { method: 'GET', expect: 'blob' });
      if (!blob) throw new Error("No PDF returned");

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || `invoice_${invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("downloadInvoicePdf error", e);
      alert("Failed to download invoice PDF. Check server endpoint /api/invoices/:invoiceId/pdf");
    } finally {
      setInvoicePdfLoading(false);
    }
  }

  // Convenience: ensure invoice exists for order, then generate PDF and (optionally) return URL
  async function ensureInvoiceAndGeneratePdf(orderId) {
    try {
      const inv = await ensureInvoiceForOrder(orderId);
      if (!inv) throw new Error("Failed to create or fetch invoice for order");
      const invoiceId = inv.invoice_id || inv.invoiceId || null;
      if (!invoiceId) throw new Error("Invoice id missing");

      const gen = await generateInvoicePdf(invoiceId);
      if (gen && gen.url) {
        alert("Invoice PDF generated and available at: " + gen.url);
      } else {
        alert("Invoice PDF generation requested. It may be available shortly.");
      }
      // refresh view to show invoice status/number
      openView(orderId);
    } catch (e) {
      console.error("ensureInvoiceAndGeneratePdf error", e);
      alert(e?.message || "Failed to generate invoice PDF");
    }
  }

  /* ---------- CSV export ---------- */
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
    for (const r of rows) lines.push(headers.map(h => escape(r[h])).join(","));
    return lines.join("\n");
  }
  async function handleExportCsv() {
    try {
      const rows = data.map(r => ({
        order_id: r.order_id,
        lead_id: r.lead_id,
        school_name: r.school_name,
        contact_name: r.contact_name,
        phone: r.phone,
        email: r.email,
        status: r.status,
        order_date: r.order_date,
        total_amount: r.total_amount || ""
      }));
      const csv = toCsv(rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orders_page${pagination.page || 1}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Export failed.");
    }
  }

  /* ---------- Render ---------- */
  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Orders</h1>
          <nav className="text-sm text-slate-500 mt-1">
            <ol className="list-reset flex">
              <li><a className="hover:text-slate-700 text-slate-500">Dashboard</a></li>
              <li className="mx-2">/</li>
              <li className="text-slate-700 font-medium">Order Management</li>
            </ol>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleExportCsv} className="inline-flex items-center gap-2 px-3 py-2 bg-white border rounded shadow-sm text-sm hover:shadow-md">
            <Icon name="search" /> Export CSV
          </button>

          <button onClick={() => openCreateModal()} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded shadow-sm text-sm hover:bg-indigo-700">
            <Icon name="plus" /> Create Order
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-lg p-4 shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="col-span-2">
            <label className="block text-sm text-slate-500">Search</label>
            <div className="mt-1 flex items-center">
              <Icon name="search" />
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search order, billing name, contact, phone..." className="w-full border rounded px-3 py-3 text-base" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-500">Status</label>
            <select value={status} onChange={e=>setStatus(e.target.value)} className="w-full border rounded px-3 py-3 text-base">
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || "Any"}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-500">School (converted leads only)</label>
            <select value={schoolIdFilter} onChange={e=>setSchoolIdFilter(e.target.value)} className="w-full border rounded px-3 py-3 text-base">
              <option value="">Any</option>
              {convertedLeads.map(c => (
                <option key={c.lead_id} value={c.school_id || ""}>{c.school_name} {c.school_id ? ` (id:${c.school_id})` : ""}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-500">Date range</label>
            <div className="flex gap-2">
              <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} className="border rounded px-2 py-3 text-base w-1/2" />
              <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)} className="border rounded px-2 py-3 text-base w-1/2" />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-lg shadow-sm overflow-hidden mb-8">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="text-sm text-slate-600">Showing page {pagination.page || 1} — {pagination.total || 0} results</div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-500">Page size</label>
            <select value={pageSize} onChange={(e)=>{ setPageSize(Number(e.target.value)); setPage(1); }} className="border rounded px-3 py-2 text-sm">
              {[10,25,50,100].map(n=> <option key={n} value={n}>{n}</option>)}
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
                <th className="px-4 py-3 text-base font-medium">Status</th>
                <th className="px-4 py-3 text-base font-medium">Order Date</th>
                <th className="px-4 py-3 text-base font-medium">Total</th>
                <th className="px-4 py-3 text-base font-medium">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="p-12 text-center text-slate-500 text-lg">Loading…</td></tr>
              ) : data.length ? data.map(r => (
                <tr key={r.order_id} className="odd:bg-white even:bg-slate-50 align-top">
                  <td className="px-4 py-3 text-base text-slate-700 font-medium">{r.order_id}</td>
                  <td className="px-4 py-3 text-base font-medium">{r.school_name || r.billing_name || "—"}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="text-base font-medium">{r.contact_name || "—"}</div>
                    <div className="text-sm text-slate-500">{r.phone}</div>
                  </td>
                  <td className="px-4 py-3 text-base">{r.status || "—"}</td>
                  <td className="px-4 py-3 text-base">{fmtDateShort(r.order_date || r.created_at)}</td>
                  <td className="px-4 py-3 text-base">{r.total_amount != null ? String(r.total_amount) : "—"}</td>
                  <td className="px-4 py-3 text-base">
                    <div className="flex items-center gap-2">
                      <button onClick={()=>openView(r.order_id)} className="inline-flex items-center gap-2 px-2 py-1 text-sm rounded hover:bg-slate-100">
                        <Icon name="view" /> <span className="hidden md:inline">View</span>
                      </button>

                      <button onClick={()=>handleGenerate(r.order_id)} className="inline-flex items-center gap-2 px-2 py-1 text-sm rounded hover:bg-slate-100">
                        <Icon name="generate" /> <span className="hidden md:inline">Generate</span>
                      </button>

                      <button onClick={()=>handleReprice(r.order_id)} className="inline-flex items-center gap-2 px-2 py-1 text-sm rounded hover:bg-slate-100">
                        <Icon name="reprice" /> <span className="hidden md:inline">Reprice</span>
                      </button>

                      <button onClick={()=>handleConfirm(r)} className="inline-flex items-center gap-2 px-2 py-1 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-700">
                        <Icon name="confirm" /> <span className="hidden md:inline">Confirm</span>
                      </button>

                      <button onClick={()=>handleDeleteOrder(r.order_id)} className="inline-flex items-center gap-2 px-2 py-1 text-sm rounded text-rose-600 hover:bg-rose-50">
                        <Icon name="delete" /> <span className="hidden md:inline">Delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="7" className="p-12 text-center text-slate-500 text-lg">No results</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t flex items-center justify-between">
          <div className="text-sm text-slate-600">
            {pagination.total ? `Showing ${(pagination.page-1)*pagination.pageSize + 1} - ${Math.min(pagination.page*pagination.pageSize, pagination.total)} of ${pagination.total}` : "—"}
          </div>
          <div className="flex items-center gap-2">
            <button disabled={pagination.page <= 1} onClick={() => { setPage(p => Math.max(1,p-1)); fetchPage(Math.max(1, (page-1))); }} className="px-3 py-1 border rounded bg-white text-sm disabled:opacity-50">Prev</button>
            <div className="text-sm">Page</div>
            <input type="number" min="1" max={totalPages} value={page} onChange={(e) => { const v = Math.max(1, Number(e.target.value || 1)); setPage(v); fetchPage(v); }} className="w-16 border rounded px-2 py-1 text-sm" />
            <div className="text-sm">/ {totalPages}</div>
            <button disabled={page >= totalPages} onClick={() => { setPage(p => Math.min(totalPages,p+1)); fetchPage(Math.min(totalPages, page+1)); }} className="px-3 py-1 border rounded bg-white text-sm disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>

      {/* Create Modal (no Items section - using placeholder item on submit) */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30" onClick={() => setCreateOpen(false)} />
          <div className="relative z-10 w-full max-w-4xl bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="flex items-center gap-4 p-4 border-b">
              <img src="/public/images/Ank_Logo.png" alt="Ank Logo" className="h-12 w-12 object-contain" />
              <div>
                <div className="text-lg font-semibold">Create Order</div>
                <div className="text-sm text-slate-500">Create an order from a converted lead — you can leave Items empty and auto-generate them from Strengths.</div>
              </div>
              <div className="ml-auto">
                <button onClick={() => setCreateOpen(false)} className="text-sm text-slate-500 hover:text-slate-700">Close</button>
              </div>
            </div>

            <form onSubmit={submitOrder} className="p-4 max-h-[80vh] overflow-auto space-y-4" autoComplete="off">
              <section className="border rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-2">1. Converted Lead</h3>
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="flex-1">
                    <label className="block text-sm text-slate-500">Select converted lead *</label>
                    <select required value={form.lead_id || ""} onChange={(e) => onSelectConvertedLead(e.target.value || "")} className="w-full border rounded px-3 py-3 text-base">
                      <option value="">— select converted lead —</option>
                      {convertedLeads.map(c => (
                        <option key={c.lead_id} value={c.lead_id}>
                          {c.school_name} {c.school_id ? `(school:${c.school_id})` : `(lead:${c.lead_id})`}
                        </option>
                      ))}
                    </select>
                    <div className="text-xs text-slate-400 mt-1">Orders may only be created from converted leads.</div>
                  </div>

                  <div className="w-full md:w-64">
                    <label className="block text-sm text-slate-500">School ID (if any)</label>
                    <input value={form.school_id || ""} readOnly className="w-full border rounded px-3 py-3 text-base bg-slate-50" />
                  </div>
                </div>
              </section>

              <section className="border rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-2">2. Contact & Billing</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm text-slate-500">Contact name *</label>
                    <input value={form.contact_name} onChange={(e)=>setForm(s=>({...s, contact_name: e.target.value}))} className="w-full border rounded px-3 py-3 text-base" />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-500">Phone</label>
                    <input value={form.phone} onChange={(e)=>setForm(s=>({...s, phone: e.target.value}))} className="w-full border rounded px-3 py-3 text-base" />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-500">Email</label>
                    <input value={form.email} onChange={(e)=>setForm(s=>({...s, email: e.target.value}))} className="w-full border rounded px-3 py-3 text-base" />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-sm text-slate-500">Billing name</label>
                  <input value={form.billing_name} onChange={(e)=>setForm(s=>({...s, billing_name: e.target.value}))} className="w-full border rounded px-3 py-3 text-base" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                  <div>
                    <label className="block text-sm text-slate-500">Billing city</label>
                    <input value={form.billing_city} onChange={(e)=>setForm(s=>({...s, billing_city: e.target.value}))} className="w-full border rounded px-3 py-3 text-base" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-500">Billing state</label>
                    <input value={form.billing_state} onChange={(e)=>setForm(s=>({...s, billing_state: e.target.value}))} className="w-full border rounded px-3 py-3 text-base" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-500">Billing pincode</label>
                    <input value={form.billing_pincode} onChange={(e)=>setForm(s=>({...s, billing_pincode: e.target.value}))} className="w-full border rounded px-3 py-3 text-base" />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-sm text-slate-500">Billing address</label>
                  <input value={form.billing_address} onChange={(e)=>setForm(s=>({...s, billing_address: e.target.value}))} className="w-full border rounded px-3 py-3 text-base" />
                </div>
              </section>

              <section className="border rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-2">3. Shipping</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm text-slate-500">Shipping address</label>
                    <input value={form.shipping_address} onChange={(e)=>setForm(s=>({...s, shipping_address: e.target.value}))} className="w-full border rounded px-3 py-3 text-base" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-500">Shipping city</label>
                    <input value={form.shipping_city} onChange={(e)=>setForm(s=>({...s, shipping_city: e.target.value}))} className="w-full border rounded px-3 py-3 text-base" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-500">Shipping state / pincode</label>
                    <div className="flex gap-2">
                      <input value={form.shipping_state} onChange={(e)=>setForm(s=>({...s, shipping_state: e.target.value}))} className="w-1/2 border rounded px-3 py-3 text-base" />
                      <input value={form.shipping_pincode} onChange={(e)=>setForm(s=>({...s, shipping_pincode: e.target.value}))} className="w-1/2 border rounded px-3 py-3 text-base" />
                    </div>
                  </div>
                </div>
              </section>

              {/* Items removed from UI (we will send placeholder automatically) */}

              <section className="border rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-2">4. Strengths (per medium/std)</h3>
                <div className="text-xs text-slate-400 mb-2">Add one row per medium/std — used to generate the requirements and books/courses automatically.</div>

                <div className="space-y-2">
                  {(form.strengths || []).map((s, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-4">
                        <label className="text-xs text-slate-500">Medium</label>
                        <select value={s.medium_id || ""} onChange={(e)=>updateStrength(i, "medium_id", e.target.value)} className="w-full border rounded px-2 py-2 text-sm">
                          <option value="">—</option>
                          {lookups.mediums.map(m => <option key={m.medium_id} value={m.medium_id}>{m.medium_name}</option>)}
                        </select>
                      </div>

                      <div className="col-span-4">
                        <label className="text-xs text-slate-500">Standard</label>
                        <select value={s.std_id || ""} onChange={(e)=>updateStrength(i, "std_id", e.target.value)} className="w-full border rounded px-2 py-2 text-sm">
                          <option value="">—</option>
                          {lookups.standards.map(st => <option key={st.std_id} value={st.std_id}>{st.std_name}</option>)}
                        </select>
                      </div>

                      <div className="col-span-3">
                        <label className="text-xs text-slate-500">Students</label>
                        <input type="number" min="0" value={s.students} onChange={(e)=>updateStrength(i, "students", Number(e.target.value || 0))} className="w-full border rounded px-2 py-2 text-sm" />
                      </div>

                      <div className="col-span-1 flex items-end">
                        <button type="button" onClick={()=>removeStrengthRow(i)} className="text-rose-600 text-sm">Remove</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-2">
                  <button type="button" onClick={addStrengthRow} className="inline-flex items-center gap-2 px-3 py-2 bg-white border rounded text-sm">Add Strength</button>
                </div>
              </section>

              <section className="border rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-2">5. Pricing & Notes</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm text-slate-500">Discount</label>
                    <input type="number" value={form.discount_amount} onChange={(e)=>setForm(s=>({...s, discount_amount: e.target.value}))} className="w-full border rounded px-3 py-3 text-base" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-500">Tax %</label>
                    <input type="number" value={form.tax_percent} onChange={(e)=>setForm(s=>({...s, tax_percent: e.target.value}))} className="w-full border rounded px-3 py-3 text-base" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-500">Notes</label>
                    <input value={form.notes} onChange={(e)=>setForm(s=>({...s, notes: e.target.value}))} className="w-full border rounded px-3 py-3 text-base" />
                  </div>
                </div>
              </section>

              <div className="flex items-center gap-3">
                <button type="submit" disabled={formSubmitting} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">
                  {formSubmitting ? "Submitting…" : "Create Order"}
                </button>

                <button type="button" onClick={() => { setCreateOpen(false); }} className="inline-flex items-center gap-2 px-4 py-2 border rounded text-sm">
                  Cancel
                </button>

                {formError && <div className="text-sm text-rose-600 ml-4">{formError}</div>}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Strengths Modal */}
      {strengthsOpen && (
        <div className="fixed inset-0 z-60 flex items-start sm:items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30" onClick={() => setStrengthsOpen(false)} />
          <div className="relative z-10 w-full max-w-2xl bg-white rounded-lg shadow-lg overflow-auto max-h-[80vh] p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-lg font-semibold">Edit Strengths — Order #{strengthsOrderId}</div>
                <div className="text-xs text-slate-500">Rows are medium / standard / students</div>
              </div>
              <div>
                <button onClick={() => setStrengthsOpen(false)} className="text-sm text-slate-500 hover:text-slate-700">Close</button>
              </div>
            </div>

            <div className="space-y-3">
              {(strengthsRows || []).map((r, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-4">
                    <select value={r.medium_id || ""} onChange={e=>updateStrengthRowInModal(i, "medium_id", e.target.value)} className="w-full border rounded px-2 py-2 text-sm">
                      <option value="">— Medium —</option>
                      {lookups.mediums.map(m => <option key={m.medium_id} value={m.medium_id}>{m.medium_name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-4">
                    <select value={r.std_id || ""} onChange={e=>updateStrengthRowInModal(i, "std_id", e.target.value)} className="w-full border rounded px-2 py-2 text-sm">
                      <option value="">— Standard —</option>
                      {lookups.standards.map(s => <option key={s.std_id} value={s.std_id}>{s.std_name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <input type="number" min="0" value={r.students} onChange={e=>updateStrengthRowInModal(i, "students", Number(e.target.value || 0))} className="w-full border rounded px-2 py-2 text-sm" />
                  </div>
                  <div className="col-span-1 text-right">
                    <button onClick={()=>removeStrengthRowInModal(i)} className="text-rose-600 text-sm">Remove</button>
                  </div>
                </div>
              ))}
              <div>
                <button onClick={addStrengthRowInModal} className="px-3 py-2 border rounded text-sm">Add Strength</button>
              </div>

              <div className="flex gap-2 mt-2">
                <button onClick={saveStrengthsModal} className="px-4 py-2 bg-emerald-600 text-white rounded text-sm">Save</button>
                <button onClick={()=>setStrengthsOpen(false)} className="px-4 py-2 border rounded text-sm">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View modal */}
      {viewOpen && viewData && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30" onClick={() => setViewOpen(false)} />
          <div className="relative z-10 w-full max-w-3xl bg-white rounded-lg shadow-lg overflow-auto max-h-[90vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="flex items-center gap-3">
                <img src="/public/images/Ank_Logo.png" alt="Ank" className="h-10 w-10 object-contain" />
                <div>
                  <div className="text-lg font-semibold">Order #{viewData.order_id}</div>
                  <div className="text-xs text-slate-400">Status: {viewData.status}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openStrengthsModal(viewData.order_id)} className="px-3 py-1 border rounded text-sm">Edit Strengths</button>
                <button onClick={() => setViewOpen(false)} className="text-sm text-slate-500 hover:text-slate-700">Close</button>
              </div>
            </div>

            <div className="p-4 space-y-3 text-base">
              <div><span className="font-medium">School:</span> {viewData.school_name || viewData.billing_name}</div>
              <div><span className="font-medium">Contact:</span> {viewData.contact_name} — {viewData.phone}</div>
              <div><span className="font-medium">Email:</span> {viewData.email || "—"}</div>
              <div><span className="font-medium">Order Date:</span> {fmtDateShort(viewData.order_date || viewData.created_at)}</div>

              <div>
                <div className="font-medium mb-2">Items</div>
                {viewData.items && viewData.items.length ? (
                  <div className="overflow-auto border rounded">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="px-3 py-2">#</th>
                          <th className="px-3 py-2">Description</th>
                          <th className="px-3 py-2">Qty</th>
                          <th className="px-3 py-2">Unit</th>
                          <th className="px-3 py-2">Line</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewData.items.map(it => (
                          <tr key={it.item_id} className="border-t">
                            <td className="px-3 py-2">{it.item_id}</td>
                            <td className="px-3 py-2">{it.description}</td>
                            <td className="px-3 py-2">{it.qty}</td>
                            <td className="px-3 py-2">{it.unit_price}</td>
                            <td className="px-3 py-2">{it.line_total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">No items yet — run Generate to create items from requirements, or Reprice to compute pricing.</div>
                )}
              </div>

              <div>
                <div className="font-medium">Strengths</div>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {(viewData.strengths || []).map((s, i) => (
                    <div key={i} className="p-2 bg-slate-50 rounded text-sm">
                      <div className="font-medium">{s.medium_name || s.medium_id} / {s.std_name || s.std_id}</div>
                      <div className="text-xs">Students: {s.students}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="font-medium">Requirements</div>
                <div className="mt-2 space-y-2">
                  {!(viewData.requirements && viewData.requirements.length) ? (
                    <div className="text-sm text-slate-500">No requirements found for this order.</div>
                  ) : (
                    viewData.requirements.map((rq, i) => {
                      const rp = requirementsPrices[rq.req_id] || { price: 100, loading: false, saving: false };
                      return (
                        <div key={rq.req_id || i} className="p-2 bg-slate-50 rounded text-sm flex items-center justify-between gap-2">
                          <div>
                            <div className="font-medium">{rq.medium_name} — {rq.std_name} {rq.item_type === 'book' ? '• Book' : '• Course'}</div>
                            <div className="text-xs">Unit qty: {rq.unit_qty} • Students: {rq.students} • Total: {rq.total_qty}</div>
                            <div className="text-xs text-slate-500">Course: {rq.course_id || '—'} Book: {rq.book_id || '—'}</div>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              value={rp.price}
                              onChange={(e) => setReqPrice(rq.req_id, Number(e.target.value || 0))}
                              className="w-24 border rounded px-2 py-1 text-sm"
                            />
                            <button
                              onClick={() => saveReqPrice(rq)}
                              disabled={rp.saving}
                              className="px-3 py-1 border rounded text-sm bg-white hover:bg-slate-100"
                            >
                              {rp.saving ? "Saving…" : "Save"}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Invoice block: shows invoice info if any, and provides actions */}
              <div className="border rounded p-3 bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Invoice</div>
                    <div className="text-sm text-slate-600">
                      {orderInvoiceMap[viewData.order_id] ? (
                        <>
                          Invoice #: {orderInvoiceMap[viewData.order_id].invoice_number || "—"} •
                          Status: {orderInvoiceMap[viewData.order_id].status || "—"} •
                          Amount: {orderInvoiceMap[viewData.order_id].total_amount != null ? orderInvoiceMap[viewData.order_id].total_amount : "—"}
                        </>
                      ) : (
                        <span className="text-slate-500">No invoice associated yet.</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Create invoice (if missing) and generate PDF */}
                    <button
                      onClick={async () => {
                        try {
                          setInvoiceLoading(true);
                          const inv = await ensureInvoiceForOrder(viewData.order_id);
                          if (!inv) { alert("Failed to create invoice for this order. (No server endpoint available)"); return; }
                          alert(`Invoice created: id=${inv.invoice_id}`);
                          openView(viewData.order_id);
                        } catch (e) {
                          console.error(e);
                          alert("Failed to create invoice");
                        } finally {
                          setInvoiceLoading(false);
                        }
                      }}
                      className="px-3 py-2 border rounded text-sm bg-white hover:bg-slate-100"
                      disabled={invoiceLoading}
                    >
                      {invoiceLoading ? "Working…" : "Create Invoice"}
                    </button>

                    <button
                      onClick={async () => {
                        // prefer generate for existing invoice else try ensureInvoiceAndGeneratePdf
                        const inv = orderInvoiceMap[viewData.order_id];
                        if (inv && inv.invoice_id) {
                          try {
                            setInvoiceLoading(true);
                            const r = await generateInvoicePdf(inv.invoice_id);
                            if (r && r.url) {
                              setInvoiceUrls(prev => ({ ...(prev||{}), [inv.invoice_id]: r.url }));
                              alert("PDF generated. Use Download to fetch the file or open the returned URL.");
                            } else {
                              alert("PDF generation requested. It may be available shortly.");
                            }
                          } catch (e) {
                            alert(e?.message || "Failed to generate PDF");
                          } finally {
                            setInvoiceLoading(false);
                            openView(viewData.order_id);
                          }
                        } else {
                          // no invoice yet — create & generate
                          await ensureInvoiceAndGeneratePdf(viewData.order_id);
                        }
                      }}
                      className="px-3 py-2 border rounded text-sm bg-white hover:bg-slate-100"
                      disabled={invoiceLoading}
                    >
                      {invoiceLoading ? "Generating…" : "Generate PDF"}
                    </button>

                    <button
                      onClick={async () => {
                        const inv = orderInvoiceMap[viewData.order_id];
                        const invoiceId = inv && inv.invoice_id;
                        if (!invoiceId) { alert("Invoice not available to download."); return; }
                        await downloadInvoicePdf(invoiceId);
                      }}
                      className="px-3 py-2 border rounded text-sm bg-white hover:bg-slate-100"
                      disabled={invoicePdfLoading}
                    >
                      {invoicePdfLoading ? "Downloading…" : "Download PDF"}
                    </button>

                    {/* If server returned a public URL for the invoice PDF we can open it in a new tab */}
                    {orderInvoiceMap[viewData.order_id] && orderInvoiceMap[viewData.order_id].invoice_id && invoiceUrls[orderInvoiceMap[viewData.order_id].invoice_id] && (
                      <a className="px-3 py-2 border rounded text-sm bg-white hover:bg-slate-100" href={invoiceUrls[orderInvoiceMap[viewData.order_id].invoice_id]} target="_blank" rel="noreferrer">Open PDF</a>
                    )}
                  </div>
                </div>
                <div className="text-xs text-slate-400 mt-2">
                  Notes: "Create Invoice" will attempt to create an invoice via common endpoints. If your server uses a different path, implement one of:
                  POST /api/orders/:orderId/invoice/generate OR POST /api/invoices/generate-from-order OR GET /api/orders/:orderId/invoice.
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => handleGenerate(viewData.order_id)} className="inline-flex items-center gap-2 px-3 py-2 bg-white border rounded text-sm">
                  <Icon name="generate" /> Generate
                </button>

                <button onClick={() => handleReprice(viewData.order_id)} className="inline-flex items-center gap-2 px-3 py-2 bg-white border rounded text-sm">
                  <Icon name="reprice" /> Reprice
                </button>

                <button onClick={() => handleConfirm(viewData)} className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded text-sm">
                  <Icon name="confirm" /> Confirm
                </button>

                <button onClick={() => { if (confirm("Delete this order?")) { handleDeleteOrder(viewData.order_id); setViewOpen(false); } }} className="inline-flex items-center gap-2 px-3 py-2 text-rose-600 rounded text-sm border">
                  <Icon name="delete" /> Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
