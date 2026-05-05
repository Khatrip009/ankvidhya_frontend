// src/components/CreateOrderModal.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import api from "../lib/api";

// ---------- Tiny inline icons ----------
function Icon({ name, className = "h-4 w-4 inline-block" }) {
  const common = { className, "aria-hidden": true };
  switch (name) {
    case "plus":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 5v14M5 12h14" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "remove":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M6 6l12 12M6 18L18 6" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "close":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M6 18L18 6M6 6l12 12" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

// ---------- Mobile-friendly modal wrapper ----------
export default function CreateOrderModal({
  open = false,
  onClose = () => {},
  convertedLeads = [],
  onCreated = () => {},
}) {
  const [form, setForm] = useState({
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
    gstin: "",
    po_number: "",
    discount_amount: 0,
    tax_percent: 0,
    notes: "",
    items: [{ description: "", qty: 1, unit_price: 0 }],
    strengths: [],
    autoGenerateItemIfEmpty: true,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const modalRef = useRef(null);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Reset error when opening
  useEffect(() => {
    if (open) setError("");
  }, [open]);

  // Generic field update
  const patch = useCallback((updates) => {
    setForm((prev) => ({ ...prev, ...updates }));
  }, []);

  // Prefill from selected lead
  const onPrefillLead = useCallback(
    (leadId) => {
      const lead = convertedLeads.find(
        (c) => String(c.lead_id) === String(leadId)
      );
      if (!lead) {
        patch({ lead_id: leadId || "", school_id: "", billing_name: "" });
        return;
      }
      patch({
        lead_id: leadId,
        school_id: lead.school_id || "",
        billing_name: lead.school_name || lead.name || "",
      });
    },
    [convertedLeads, patch]
  );

  // Items management
  const addItem = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { description: "", qty: 1, unit_price: 0 }],
    }));
  }, []);

  const removeItem = useCallback((index) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  }, []);

  const updateItem = useCallback((index, key, value) => {
    setForm((prev) => {
      const newItems = prev.items.map((item, i) =>
        i === index ? { ...item, [key]: value } : item
      );
      return { ...prev, items: newItems };
    });
  }, []);

  // Strengths management
  const addStrength = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      strengths: [
        ...prev.strengths,
        { medium_id: "", std_id: "", students_cnt: 0 },
      ],
    }));
  }, []);

  const removeStrength = useCallback((index) => {
    setForm((prev) => ({
      ...prev,
      strengths: prev.strengths.filter((_, i) => i !== index),
    }));
  }, []);

  const updateStrength = useCallback((index, key, value) => {
    setForm((prev) => {
      const newStrengths = prev.strengths.map((s, i) =>
        i === index ? { ...s, [key]: value } : s
      );
      return { ...prev, strengths: newStrengths };
    });
  }, []);

  // Submit handler (fixed res usage)
  const handleSubmit = async (e) => {
    e?.preventDefault();
    setSaving(true);
    setError("");

    try {
      // Basic validation
      if (!form.contact_name) throw new Error("Contact name is required.");
      if (!form.lead_id && !form.school_id && !form.billing_name)
        throw new Error(
          "Please select a lead, school, or enter a billing name."
        );

      // Prepare items
      let itemsPayload = form.items
        .filter(
          (it) =>
            it &&
            (it.description || it.course_id || it.book_id) &&
            Number(it.qty) > 0
        )
        .map((it) => ({
          description: it.description,
          qty: Number(it.qty),
          unit_price: Number(it.unit_price || 0),
        }));

      if (!itemsPayload.length && form.autoGenerateItemIfEmpty) {
        // Placeholder item – server will generate from strengths
        itemsPayload = [
          {
            description: "AUTO: generated from strengths",
            qty: 1,
            unit_price: 0,
          },
        ];
      }

      if (!itemsPayload.length)
        throw new Error(
          "At least one item is required, or enable auto-generate."
        );

      const payload = {
        lead_id: form.lead_id || null,
        school_id: form.school_id || null,
        contact_name: form.contact_name,
        phone: form.phone || null,
        email: form.email || null,
        billing_name: form.billing_name,
        billing_address: form.billing_address || null,
        billing_city: form.billing_city || null,
        billing_state: form.billing_state || null,
        billing_pincode: form.billing_pincode || null,
        shipping_address: form.shipping_address || null,
        shipping_city: form.shipping_city || null,
        shipping_state: form.shipping_state || null,
        shipping_pincode: form.shipping_pincode || null,
        gstin: form.gstin || null,
        po_number: form.po_number || null,
        discount_amount: Number(form.discount_amount) || 0,
        tax_percent: Number(form.tax_percent) || 0,
        notes: form.notes || null,
        items: itemsPayload,
      };

      // 1. Create order
      const res = await api.post("/api/orders", payload);
      // Extract order ID from response (assume { order_id: ... } or { id: ... })
      const orderId =
        res?.data?.order_id || res?.data?.id || res?.order_id || res?.id;
      if (!orderId) {
        // If response didn't contain id but request succeeded (maybe 200 with no body), check status
        if (res && (res.status === 201 || res.status === 200)) {
          // Try to get from location header or assume created
          console.warn(
            "Order created but no ID returned from server, some actions may be skipped."
          );
        } else {
          throw new Error(res?.data?.error || "Failed to create order");
        }
      }

      // 2. Strengths (if any)
      if (Array.isArray(form.strengths) && form.strengths.length > 0) {
        try {
          await api.post(`/api/orders/${orderId}/strengths`, {
            strengths: form.strengths,
          });
        } catch (err) {
          console.warn("Failed to save strengths", err);
          alert(
            "Order created, but strengths could not be saved. You can add them later from the order detail."
          );
        }
      }

      // 3. Generate requirements
      try {
        await api.post(`/api/orders/${orderId}/generate`);
      } catch (err) {
        console.warn("Generate failed", err);
        alert(
          "Order created, but generating requirements failed. You can use the 'Generate' button later."
        );
      }

      // 4. Reprice (optional)
      try {
        await api.post(`/api/orders/${orderId}/reprice`);
      } catch (err) {
        console.warn("Reprice failed", err);
      }

      alert("Order created successfully!");
      onCreated?.();
      onClose?.();
    } catch (err) {
      console.error("Create order error", err);
      setError(err?.response?.data?.error || err?.message || "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={saving ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-order-title"
        className="relative z-10 w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3 min-w-0">
            <div className="hidden sm:block">
              <img
                src="/images/Ank_Logo.png"
                alt="AnkVidhya"
                className="h-10 w-10 object-contain"
              />
            </div>
            <div>
              <h2
                id="create-order-title"
                className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-100"
              >
                Create Order
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                Fill in the details to create an order from a converted lead.
              </p>
            </div>
          </div>
          <button
            onClick={() => !saving && onClose()}
            disabled={saving}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition disabled:opacity-50"
            aria-label="Close modal"
          >
            <Icon name="close" className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* Scrollable body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-5"
        >
          {/* 1. Lead & Contact */}
          <section className="border border-slate-200 dark:border-slate-600 rounded-xl p-4">
            <h3 className="font-medium text-slate-800 dark:text-slate-200 mb-3">
              1. Lead & Contact
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">
                  Converted Lead (required)
                </label>
                <select
                  value={form.lead_id}
                  onChange={(e) => onPrefillLead(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">— select converted lead —</option>
                  {convertedLeads.map((c) => (
                    <option key={c.lead_id} value={c.lead_id}>
                      {c.school_name}{" "}
                      {c.school_id ? `(School #${c.school_id})` : `(Lead #${c.lead_id})`}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">
                  Orders should start from a converted lead. Selecting one will
                  pre-fill billing/school fields.
                </p>
              </div>

              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">
                  Contact Name
                </label>
                <input
                  type="text"
                  value={form.contact_name}
                  onChange={(e) => patch({ contact_name: e.target.value })}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100"
                  placeholder="Full name"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">
                  Phone
                </label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => patch({ phone: e.target.value })}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => patch({ email: e.target.value })}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
            </div>
          </section>

          {/* 2. Billing & Shipping */}
          <section className="border border-slate-200 dark:border-slate-600 rounded-xl p-4">
            <h3 className="font-medium text-slate-800 dark:text-slate-200 mb-3">
              2. Billing & Shipping
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">
                  Billing Name
                </label>
                <input
                  type="text"
                  value={form.billing_name}
                  onChange={(e) => patch({ billing_name: e.target.value })}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">
                  Billing Address
                </label>
                <input
                  type="text"
                  value={form.billing_address}
                  onChange={(e) => patch({ billing_address: e.target.value })}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={form.billing_city}
                  onChange={(e) => patch({ billing_city: e.target.value })}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">
                  State / Pincode
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="State"
                    value={form.billing_state}
                    onChange={(e) => patch({ billing_state: e.target.value })}
                    className="w-1/2 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100"
                  />
                  <input
                    type="text"
                    placeholder="Pincode"
                    value={form.billing_pincode}
                    onChange={(e) => patch({ billing_pincode: e.target.value })}
                    className="w-1/2 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">
                  Shipping Address (optional)
                </label>
                <input
                  type="text"
                  value={form.shipping_address}
                  onChange={(e) => patch({ shipping_address: e.target.value })}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">
                  GSTIN / PO Number
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="GSTIN"
                    value={form.gstin}
                    onChange={(e) => patch({ gstin: e.target.value })}
                    className="w-1/2 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100"
                  />
                  <input
                    type="text"
                    placeholder="PO Number"
                    value={form.po_number}
                    onChange={(e) => patch({ po_number: e.target.value })}
                    className="w-1/2 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 3. Items */}
          <section className="border border-slate-200 dark:border-slate-600 rounded-xl p-4">
            <h3 className="font-medium text-slate-800 dark:text-slate-200 mb-3">
              3. Items
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
              Add explicit line items or leave empty to auto-generate from
              strengths (recommended).
            </p>
            <div className="space-y-2">
              {form.items.map((it, idx) => (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row gap-2 items-start sm:items-center"
                >
                  <input
                    type="text"
                    placeholder="Description / Course / Book"
                    value={it.description}
                    onChange={(e) =>
                      updateItem(idx, "description", e.target.value)
                    }
                    className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100"
                  />
                  <div className="flex gap-2 w-full sm:w-auto">
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={it.qty}
                      onChange={(e) =>
                        updateItem(idx, "qty", parseInt(e.target.value) || 0)
                      }
                      className="w-16 sm:w-20 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100"
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder="Price"
                      value={it.unit_price}
                      onChange={(e) =>
                        updateItem(
                          idx,
                          "unit_price",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-20 sm:w-24 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="p-2 text-rose-500 hover:text-rose-700 transition"
                      aria-label="Remove item"
                    >
                      <Icon name="remove" className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 transition"
              >
                <Icon name="plus" className="h-4 w-4" /> Add Item
              </button>
              <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.autoGenerateItemIfEmpty}
                  onChange={(e) =>
                    patch({ autoGenerateItemIfEmpty: e.target.checked })
                  }
                  className="rounded border-slate-300 dark:border-slate-600"
                />
                <span>
                  Auto-generate items from strengths if none added
                </span>
              </label>
            </div>
          </section>

          {/* 4. Strengths */}
          <section className="border border-slate-200 dark:border-slate-600 rounded-xl p-4">
            <h3 className="font-medium text-slate-800 dark:text-slate-200 mb-3">
              4. Strengths (per standard)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Add one row per medium & standard. Used to auto-generate
              books/courses.
            </p>
            <div className="space-y-2">
              {form.strengths.map((s, i) => (
                <div
                  key={i}
                  className="flex flex-col sm:flex-row gap-2 items-start sm:items-center"
                >
                  <div className="flex gap-2 w-full sm:w-auto flex-1">
                    <input
                      type="text"
                      placeholder="Medium ID"
                      value={s.medium_id}
                      onChange={(e) =>
                        updateStrength(i, "medium_id", e.target.value)
                      }
                      className="flex-1 sm:w-28 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100"
                    />
                    <input
                      type="text"
                      placeholder="Std ID"
                      value={s.std_id}
                      onChange={(e) =>
                        updateStrength(i, "std_id", e.target.value)
                      }
                      className="flex-1 sm:w-28 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100"
                    />
                  </div>
                  <div className="flex gap-2 items-center w-full sm:w-auto">
                    <input
                      type="number"
                      min="0"
                      placeholder="Students"
                      value={s.students_cnt}
                      onChange={(e) =>
                        updateStrength(
                          i,
                          "students_cnt",
                          parseInt(e.target.value) || 0
                        )
                      }
                      className="w-20 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => removeStrength(i)}
                      className="p-2 text-rose-500 hover:text-rose-700 transition"
                      aria-label="Remove strength"
                    >
                      <Icon name="remove" className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addStrength}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 transition"
            >
              <Icon name="plus" className="h-4 w-4" /> Add Strength
            </button>
          </section>

          {/* 5. Requirements (info only) */}
          <section className="border border-slate-200 dark:border-slate-600 rounded-xl p-4 bg-slate-50 dark:bg-slate-700/20">
            <h3 className="font-medium text-slate-800 dark:text-slate-200 mb-2">
              5. Requirements
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Requirements (books/courses) will be generated server-side from
              the strengths after order creation.
            </p>
          </section>

          {/* 6. Discounts / Notes */}
          <section className="border border-slate-200 dark:border-slate-600 rounded-xl p-4">
            <h3 className="font-medium text-slate-800 dark:text-slate-200 mb-3">
              6. Additional Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">
                  Discount Amount
                </label>
                <input
                  type="number"
                  value={form.discount_amount}
                  onChange={(e) =>
                    patch({ discount_amount: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">
                  Tax %
                </label>
                <input
                  type="number"
                  value={form.tax_percent}
                  onChange={(e) =>
                    patch({ tax_percent: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => patch({ notes: e.target.value })}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
            </div>
          </section>

          {/* Error */}
          {error && (
            <div
              className="p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm"
              role="alert"
            >
              {error}
            </div>
          )}
        </form>

        {/* Footer buttons */}
        <div className="px-4 sm:px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm disabled:opacity-60 transition"
          >
            {saving ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                Creating…
              </>
            ) : (
              "Create Order"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}