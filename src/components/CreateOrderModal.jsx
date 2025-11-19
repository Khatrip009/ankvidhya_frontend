// src/components/CreateOrderModal.jsx
import React, { useEffect, useState, useRef } from "react";
import api from "../lib/api";

function Icon({ name, className = "h-4 w-4 inline-block mr-2" }) {
  const common = { className, "aria-hidden": true };
  switch (name) {
    case "plus": return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 5v14M5 12h14" strokeWidth="1.5" strokeLinecap="round"/></svg>;
    case "remove": return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 6l12 12M6 18L18 6" strokeWidth="1.5" strokeLinecap="round"/></svg>;
    default: return null;
  }
}

export default function CreateOrderModal({ open = false, onClose = () => {}, convertedLeads = [], onCreated = () => {} }) {
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
    items: [ { description: "", qty: 1, unit_price: 0 } ],
    strengths: [ /* { medium_id, std_id, students_cnt } */ ],
    autoGenerateItemIfEmpty: true
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const contentRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    // reset small errors when opened
    setError("");
  }, [open]);

  function patch(upd) {
    setForm(f => ({ ...f, ...upd }));
  }

  function onPrefillLead(leadId) {
    const lead = convertedLeads.find(c => String(c.lead_id) === String(leadId));
    if (!lead) {
      patch({ lead_id: leadId || "", school_id: "", billing_name: "" });
      return;
    }
    patch({
      lead_id: leadId,
      school_id: lead.school_id || "",
      billing_name: lead.school_name || ""
    });
  }

  /* Items helpers */
  function addItem() {
    setForm(f => ({ ...f, items: [...(f.items || []), { description: "", qty: 1, unit_price: 0 }] }));
  }
  function removeItem(i) {
    setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  }
  function updateItem(i, k, v) {
    setForm(f => {
      const items = (f.items || []).map((it, idx) => idx === i ? ({ ...it, [k]: v }) : it);
      return { ...f, items };
    });
  }

  /* Strengths helpers */
  function addStrength() {
    setForm(f => ({ ...f, strengths: [...(f.strengths || []), { medium_id: "", std_id: "", students_cnt: 0 }] }));
  }
  function removeStrength(i) {
    setForm(f => ({ ...f, strengths: f.strengths.filter((_, idx) => idx !== i) }));
  }
  function updateStrength(i, k, v) {
    setForm(f => {
      const strengths = (f.strengths || []).map((s, idx) => idx === i ? ({ ...s, [k]: v }) : s);
      return { ...f, strengths };
    });
  }

  /* Submit flow:
     1) Prepare items — if empty and autoGenerateItemIfEmpty true, include a single AUTO placeholder item
     2) POST /api/orders
     3) POST /api/orders/:id/strengths  (if strengths provided)
     4) POST /api/orders/:id/generate   (generate requirements)
     5) POST /api/orders/:id/reprice    (optional: always call to be safe)
  */
  async function handleSubmit(e) {
    e && e.preventDefault();
    setSaving(true);
    setError("");

    try {
      // validation (minimal)
      if (!form.contact_name || (!form.lead_id && !form.school_id && !form.billing_name)) {
        throw new Error("Contact name and billing/school selection are required.");
      }

      let itemsPayload = Array.isArray(form.items) ? form.items.filter(it => it && (it.description || it.course_id || it.book_id) && Number(it.qty) > 0) : [];
      if (!itemsPayload.length && form.autoGenerateItemIfEmpty) {
        // placeholder so server accepts request; server will create real items from strengths later
        itemsPayload = [{ description: "AUTO: generated from strengths", qty: 1, unit_price: 0 }];
      }
      if (!itemsPayload.length) throw new Error("At least one item is required (or enable auto-generate).");

      const payload = {
        lead_id: form.lead_id || null,
        school_id: form.school_id || null,
        contact_name: form.contact_name || "",
        phone: form.phone || "",
        email: form.email || "",
        billing_name: form.billing_name || "",
        billing_address: form.billing_address || "",
        billing_city: form.billing_city || "",
        billing_state: form.billing_state || "",
        billing_pincode: form.billing_pincode || "",
        shipping_address: form.shipping_address || "",
        shipping_city: form.shipping_city || "",
        shipping_state: form.shipping_state || "",
        shipping_pincode: form.shipping_pincode || "",
        gstin: form.gstin || "",
        po_number: form.po_number || "",
        discount_amount: Number(form.discount_amount) || 0,
        tax_percent: Number(form.tax_percent) || 0,
        notes: form.notes || "",
        items: itemsPayload
      };

      // 1) create order
      const res = await api.post("/api/orders", payload);
      if (!(res && (res.ok || res.order_id || res.order_id === 0))) {
        throw new Error((res && res.error) || "Failed to create order");
      }
      const orderId = res.order_id || res.order_id === 0 ? res.order_id : res.order_id || res.orderId || res.order_id;

      // 2) upsert strengths if provided
      if (Array.isArray(form.strengths) && form.strengths.length) {
        try {
          await api.post(`/api/orders/${orderId}/strengths`, { strengths: form.strengths });
        } catch (e) {
          // Warn but continue — generate might still work if DB functions present
          console.warn("Failed to upsert strengths", e);
          // show non-blocking notice
          alert("Order created but failed to save strengths. You can add strengths later from order detail.");
        }
      }

      // 3) generate requirements (server-side)
      try {
        await api.post(`/api/orders/${orderId}/generate`);
      } catch (e) {
        console.warn("Failed to generate requirements", e);
        // not fatal: inform user
        alert("Order created but generating requirements failed. You can run Generate from order detail.");
      }

      // 4) reprice (optional; best-effort)
      try {
        await api.post(`/api/orders/${orderId}/reprice`);
      } catch (e) {
        console.warn("Reprice failed", e);
      }

      // success
      alert("Order created successfully.");
      onCreated && onCreated();
      onClose && onClose();
    } catch (err) {
      console.error("Create order error", err);
      setError(err?.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30" onClick={() => { if (!saving) onClose(); }} />
      <div ref={contentRef} role="dialog" aria-modal="true" className="relative z-10 w-full max-w-4xl bg-white rounded-lg shadow-lg overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="flex items-center gap-3">
            <img src="/images/Ank_Logo.png" alt="AnkVidhya" className="h-10 w-10 object-contain" />
            <div>
              <div className="text-lg font-semibold">Create Order</div>
              <div className="text-xs text-slate-500">Create an order from a converted lead — fill segments below and submit.</div>
            </div>
          </div>
          <div>
            <button onClick={() => { if (!saving) onClose(); }} className="text-sm text-slate-600 hover:text-slate-800">Close</button>
          </div>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="p-4 overflow-auto max-h-[74vh] space-y-4">
          {/* 1. Lead & Contact */}
          <section className="border rounded p-3">
            <div className="font-medium mb-2">1. Lead & Contact</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-500">Converted Lead (required)</label>
                <select value={form.lead_id || ""} onChange={(e) => { onPrefillLead(e.target.value); }} className="w-full border rounded px-3 py-2">
                  <option value="">— select converted lead —</option>
                  {convertedLeads.map(c => (
                    <option key={c.lead_id} value={c.lead_id}>
                      {c.school_name} {c.school_id ? `(school:${c.school_id})` : `(lead:${c.lead_id})`}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-slate-400 mt-1">Orders should be created from converted leads. Selecting a lead will prefill billing/school fields.</div>
              </div>

              <div>
                <label className="block text-sm text-slate-500">Contact name</label>
                <input value={form.contact_name} onChange={(e) => patch({ contact_name: e.target.value })} className="w-full border rounded px-3 py-2" />
              </div>

              <div>
                <label className="block text-sm text-slate-500">Phone</label>
                <input value={form.phone} onChange={(e) => patch({ phone: e.target.value })} className="w-full border rounded px-3 py-2" />
              </div>

              <div>
                <label className="block text-sm text-slate-500">Email</label>
                <input value={form.email} onChange={(e) => patch({ email: e.target.value })} className="w-full border rounded px-3 py-2" />
              </div>
            </div>
          </section>

          {/* 2. Billing & Shipping */}
          <section className="border rounded p-3">
            <div className="font-medium mb-2">2. Billing & Shipping</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-500">Billing name</label>
                <input value={form.billing_name} onChange={(e) => patch({ billing_name: e.target.value })} className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-slate-500">Billing address</label>
                <input value={form.billing_address} onChange={(e) => patch({ billing_address: e.target.value })} className="w-full border rounded px-3 py-2" />
              </div>

              <div>
                <label className="block text-sm text-slate-500">City</label>
                <input value={form.billing_city} onChange={(e) => patch({ billing_city: e.target.value })} className="w-full border rounded px-3 py-2" />
              </div>

              <div>
                <label className="block text-sm text-slate-500">State / Pincode</label>
                <div className="flex gap-2">
                  <input value={form.billing_state} onChange={(e) => patch({ billing_state: e.target.value })} className="w-1/2 border rounded px-3 py-2" placeholder="State" />
                  <input value={form.billing_pincode} onChange={(e) => patch({ billing_pincode: e.target.value })} className="w-1/2 border rounded px-3 py-2" placeholder="Pincode" />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-500">Shipping address (optional)</label>
                <input value={form.shipping_address} onChange={(e) => patch({ shipping_address: e.target.value })} className="w-full border rounded px-3 py-2" />
              </div>

              <div>
                <label className="block text-sm text-slate-500">GSTIN / PO</label>
                <div className="flex gap-2">
                  <input value={form.gstin} onChange={(e) => patch({ gstin: e.target.value })} className="w-1/2 border rounded px-3 py-2" placeholder="GSTIN" />
                  <input value={form.po_number} onChange={(e) => patch({ po_number: e.target.value })} className="w-1/2 border rounded px-3 py-2" placeholder="PO number" />
                </div>
              </div>
            </div>
          </section>

          {/* 3. Items */}
          <section className="border rounded p-3">
            <div className="font-medium mb-2">3. Items</div>
            <div className="text-sm text-slate-500 mb-2">Items can be explicit lines or left to be generated from strengths (recommended for standard-wise orders).</div>

            <div className="space-y-2">
              {(form.items || []).map((it, idx) => (
                <div key={idx} className="grid grid-cols-6 gap-2 items-center">
                  <input placeholder="Description" value={it.description} onChange={(e) => updateItem(idx, "description", e.target.value)} className="col-span-3 border rounded px-3 py-2" />
                  <input type="number" min="1" value={it.qty} onChange={(e) => updateItem(idx, "qty", Number(e.target.value || 0))} className="col-span-1 border rounded px-3 py-2" />
                  <input type="number" min="0" value={it.unit_price} onChange={(e) => updateItem(idx, "unit_price", Number(e.target.value || 0))} className="col-span-1 border rounded px-3 py-2" />
                  <button type="button" onClick={() => removeItem(idx)} className="col-span-1 text-rose-600">Remove</button>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button type="button" onClick={addItem} className="inline-flex items-center gap-2 px-3 py-2 bg-white border rounded text-sm">
                <Icon name="plus" /> Add Item
              </button>

              <label className="inline-flex items-center gap-2 text-sm ml-4">
                <input type="checkbox" checked={form.autoGenerateItemIfEmpty} onChange={(e) => patch({ autoGenerateItemIfEmpty: !!e.target.checked })} />
                <span className="text-slate-600">If no items added, create placeholder item and let server generate real items from strengths</span>
              </label>
            </div>
          </section>

          {/* 4. Strengths */}
          <section className="border rounded p-3">
            <div className="font-medium mb-2">4. Strengths (per medium / standard)</div>
            <div className="text-xs text-slate-400 mb-2">Provide one row per medium+standard. Strengths are used to auto-generate requirements (books/courses).</div>

            <div className="space-y-2">
              {(form.strengths || []).map((s, i) => (
                <div key={i} className="grid grid-cols-6 gap-2 items-center">
                  <input placeholder="Medium ID" value={s.medium_id || ""} onChange={(e) => updateStrength(i, "medium_id", e.target.value)} className="col-span-2 border rounded px-3 py-2" />
                  <input placeholder="Std ID" value={s.std_id || ""} onChange={(e) => updateStrength(i, "std_id", e.target.value)} className="col-span-2 border rounded px-3 py-2" />
                  <input placeholder="Students" type="number" min="0" value={s.students_cnt || 0} onChange={(e) => updateStrength(i, "students_cnt", Number(e.target.value || 0))} className="col-span-1 border rounded px-3 py-2" />
                  <button type="button" onClick={() => removeStrength(i)} className="col-span-1 text-rose-600">Remove</button>
                </div>
              ))}
            </div>

            <div className="mt-2">
              <button type="button" onClick={addStrength} className="inline-flex items-center gap-2 px-3 py-2 bg-white border rounded text-sm">
                <Icon name="plus" /> Add Strength
              </button>
            </div>
          </section>

          {/* 5. Requirements preview */}
          <section className="border rounded p-3">
            <div className="font-medium mb-2">5. Requirements</div>
            <div className="text-sm text-slate-500">Requirements (books/courses) are generated server-side from strengths. After creating the order, the app will attempt to generate them automatically.</div>
            <div className="mt-3 p-3 bg-slate-50 rounded text-sm">No preview available — requirements will appear in order detail after generation.</div>
          </section>

          {/* 6. Discounts / Notes */}
          <section className="border rounded p-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-slate-500">Discount amount</label>
                <input type="number" value={form.discount_amount} onChange={(e) => patch({ discount_amount: e.target.value })} className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-slate-500">Tax %</label>
                <input type="number" value={form.tax_percent} onChange={(e) => patch({ tax_percent: e.target.value })} className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-slate-500">Notes</label>
                <input value={form.notes} onChange={(e) => patch({ notes: e.target.value })} className="w-full border rounded px-3 py-2" />
              </div>
            </div>
          </section>

          {/* Error & Actions */}
          <div className="flex items-center justify-between">
            <div>{error && <div className="text-sm text-rose-600">{error}</div>}</div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => onClose()} disabled={saving} className="px-3 py-2 border rounded text-sm">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm">
                {saving ? "Submitting…" : "Create Order"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
