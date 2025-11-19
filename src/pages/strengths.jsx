// src/pages/strength.jsx
import React, { useEffect, useState, useRef } from "react";
import api from "../lib/api";

/**
 * Strengths & Requirements finalization page
 *
 * Endpoints used:
 * GET  /api/orders?pageSize=100
 * GET  /api/orders/:id?include=requirements,strengths,items
 * GET  /api/orders/:id/requirements
 * GET  /api/books/:id
 * PUT  /api/books/:id
 * PUT  /api/orders/:orderId/items/:itemId
 * POST /api/orders/:orderId/strengths
 * POST /api/orders/:orderId/generate
 * POST /api/orders/:orderId/reprice
 * POST /api/orders/:orderId/confirm
 */

function Icon({ name, className = "h-4 w-4 inline-block mr-2" }) {
  const common = { className, "aria-hidden": true };
  switch (name) {
    case "search":
      return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 21l-4.35-4.35" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="11" cy="11" r="6" strokeWidth="1.5"/></svg>;
    case "save":
      return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" strokeWidth="1.3"/><path d="M17 21v-8H7v8" strokeWidth="1.3"/></svg>;
    case "generate":
      return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 12a9 9 0 1 1-9-9" strokeWidth="1.5"/><path d="M12 3v9l3 3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    case "reprice":
      return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 12v6a2 2 0 0 1-2 2H5" strokeWidth="1.5"/><path d="M7 7h10" strokeWidth="1.5"/><path d="M12 3v4" strokeWidth="1.5"/></svg>;
    case "confirm":
      return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 13l4 4L19 7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    case "edit":
      return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 21v-3.75L14.06 6.19l3.75 3.75L6.75 21H3z" strokeWidth="1.3"/><path d="M20.71 7.04a1 1 0 0 0 0-1.41L18.37 3.29a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" strokeWidth="1.3"/></svg>;
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

export default function StrengthsPage() {
  const [ordersList, setOrdersList] = useState([]);
  const [orderId, setOrderId] = useState("");
  const [loadingOrderList, setLoadingOrderList] = useState(false);

  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState(null); // full order data (items/strengths/requirements)
  const [strengthRows, setStrengthRows] = useState([]); // editable strengths
  const [requirementsPrices, setRequirementsPrices] = useState({}); // req_id -> { price, saving }
  const [itemsEditing, setItemsEditing] = useState({}); // item_id -> { unit_price, saving }
  const [savingStrengths, setSavingStrengths] = useState(false);
  const [processing, setProcessing] = useState(false);

  const orderSelectRef = useRef(null);

  useEffect(() => {
    fetchOrdersList();
  }, []);

  // Fetch a short list of recent orders (pageSize 100) for selection
  async function fetchOrdersList() {
    setLoadingOrderList(true);
    try {
      const res = await api.get("/api/orders", { query: { page: 1, pageSize: 100 }, background: true });
      if (res && res.data) {
        setOrdersList(res.data);
      } else {
        setOrdersList([]);
      }
    } catch (e) {
      console.warn("Failed to load orders list", e);
      setOrdersList([]);
    } finally {
      setLoadingOrderList(false);
    }
  }

  async function loadOrder(id) {
    if (!id) {
      setOrder(null);
      setStrengthRows([]);
      setRequirementsPrices({});
      setItemsEditing({});
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`/api/orders/${id}`, { query: { include: "requirements,strengths,items" } });
      if (res && res.data) {
        setOrder(res.data);
        setStrengthRows((res.data.strengths || []).map(s => ({
          medium_id: s.medium_id || "",
          std_id: s.std_id || "",
          students: s.students || 0
        })));

        // prepare requirement price map (fetch book price where present)
        const map = {};
        if (res.data.requirements && res.data.requirements.length) {
          for (const rq of res.data.requirements) {
            if (rq.book_id) {
              try {
                const b = await api.get(`/api/books/${rq.book_id}`, { background: true });
                map[rq.req_id] = { price: (b && b.data && b.data.price != null) ? Number(b.data.price) : 100, saving: false };
              } catch (e) {
                map[rq.req_id] = { price: 100, saving: false };
              }
            } else {
              map[rq.req_id] = { price: 100, saving: false };
            }
          }
        }
        setRequirementsPrices(map);

        // prepare items editing map
        const itemsMap = {};
        (res.data.items || []).forEach(it => {
          itemsMap[it.item_id] = { unit_price: it.unit_price != null ? Number(it.unit_price) : 0, saving: false };
        });
        setItemsEditing(itemsMap);
      } else {
        alert("Failed to load order.");
      }
    } catch (err) {
      console.error("loadOrder error", err);
      alert("Failed to load order.");
    } finally {
      setLoading(false);
    }
  }

  /* Strengths editing */
  function addStrengthRow() {
    setStrengthRows(s => [...(s || []), { medium_id: "", std_id: "", students: 0 }]);
  }
  function updateStrengthRow(i, key, val) {
    setStrengthRows(s => s.map((r, idx) => idx === i ? { ...r, [key]: val } : r));
  }
  function removeStrengthRow(i) {
    setStrengthRows(s => s.filter((_, idx) => idx !== i));
  }

  async function saveStrengths() {
    if (!order || !order.order_id) return;
    setSavingStrengths(true);
    try {
      const payload = (strengthRows || []).map(r => ({
        medium_id: r.medium_id ? Number(r.medium_id) : null,
        std_id: r.std_id ? Number(r.std_id) : null,
        students_cnt: Number(r.students) || 0
      }));
      await api.post(`/api/orders/${order.order_id}/strengths`, { strengths: payload });
      alert("Strengths saved.");
      // reload requirements + order view to reflect generated requirements if any
      await api.post(`/api/orders/${order.order_id}/generate`).catch(()=>{});
      await loadOrder(order.order_id);
    } catch (e) {
      console.error("saveStrengths error", e);
      alert("Failed to save strengths.");
    } finally {
      setSavingStrengths(false);
    }
  }

  /* Regenerate requirements */
  async function handleGenerate() {
    if (!order || !order.order_id) return;
    if (!confirm("Generate requirements for this order? This will replace existing requirements.")) return;
    setProcessing(true);
    try {
      const r = await api.post(`/api/orders/${order.order_id}/generate`);
      if (r && r.ok) {
        alert(`Generated ${r.generated ?? "some"} requirements.`);
        await loadOrder(order.order_id);
      } else {
        throw new Error((r && (r.error || r.message)) || "Generate failed");
      }
    } catch (e) {
      console.error("generate error", e);
      alert(e?.message || "Generate failed.");
    } finally {
      setProcessing(false);
    }
  }

  /* Reprice (server-side) */
  async function handleReprice() {
    if (!order || !order.order_id) return;
    if (!confirm("Reprice this order? This will run server-side pricing logic.")) return;
    setProcessing(true);
    try {
      const r = await api.post(`/api/orders/${order.order_id}/reprice`);
      if (r && r.ok) {
        alert("Reprice requested.");
        await loadOrder(order.order_id);
      } else {
        throw new Error((r && (r.error || r.message)) || "Reprice failed");
      }
    } catch (e) {
      console.error("reprice error", e);
      alert(e?.message || "Reprice failed.");
    } finally {
      setProcessing(false);
    }
  }

  /* Requirement price editing (updates book price if book_id present) */
  function setReqPrice(reqId, price) {
    setRequirementsPrices(prev => ({ ...(prev || {}), [reqId]: { ...(prev[reqId] || {}), price } }));
  }

  async function saveReqPrice(req) {
    const rp = requirementsPrices[req.req_id];
    if (!rp) return;
    const newPrice = Number(rp.price || 0);
    if (!Number.isFinite(newPrice) || newPrice < 0) {
      alert("Enter a valid price >= 0");
      return;
    }

    if (req.book_id) {
      // update book price globally
      setRequirementsPrices(prev => ({ ...(prev || {}), [req.req_id]: { ...(prev[req.req_id] || {}), saving: true } }));
      try {
        await api.put(`/api/books/${req.book_id}`, { price: newPrice });
        alert("Book price updated.");
        // refresh order view to reflect changed prices
        await handleReprice(); // reprice will also reload via loadOrder call inside
      } catch (e) {
        console.error("Failed to update book price", e);
        alert("Failed to save price.");
        setRequirementsPrices(prev => ({ ...(prev || {}), [req.req_id]: { ...(prev[req.req_id] || {}), saving: false } }));
      }
    } else {
      // local-only price change (cannot persist via book)
      setRequirementsPrices(prev => ({ ...(prev || {}), [req.req_id]: { ...(prev[req.req_id] || {}), price: newPrice } }));
      alert("Price updated locally. Run Reprice to apply server-side.");
    }
  }

  /* Item price editing (PUT /api/orders/:orderId/items/:itemId) */
  function setItemEdit(itemId, val) {
    setItemsEditing(prev => ({ ...(prev || {}), [itemId]: { ...(prev[itemId] || {}), unit_price: val } }));
  }

  async function saveItemPrice(item) {
    const e = itemsEditing[item.item_id];
    if (!e) return;
    const newPrice = Number(e.unit_price || 0);
    if (!Number.isFinite(newPrice) || newPrice < 0) {
      alert("Enter a valid unit price >= 0");
      return;
    }
    setItemsEditing(prev => ({ ...(prev || {}), [item.item_id]: { ...(prev[item.item_id] || {}), saving: true } }));
    try {
      const r = await api.put(`/api/orders/${order.order_id}/items/${item.item_id}`, { unit_price: newPrice });
      if (r && r.ok) {
        alert("Item price updated.");
        // reload order to update totals
        await loadOrder(order.order_id);
      } else {
        throw new Error((r && (r.error || r.message)) || "Item price update failed");
      }
    } catch (e) {
      console.error("saveItemPrice error", e);
      alert(e?.message || "Failed to save item price.");
    } finally {
      setItemsEditing(prev => ({ ...(prev || {}), [item.item_id]: { ...(prev[item.item_id] || {}), saving: false } }));
    }
  }

  /* Confirm order */
  async function handleConfirm() {
    if (!order || !order.order_id) return;
    if (!confirm("Confirm this order? This will mark the order confirmed on server and may delete the associated converted lead.")) return;
    setProcessing(true);
    try {
      const r = await api.post(`/api/orders/${order.order_id}/confirm`);
      if (r && r.ok) {
        alert("Order confirmed.");
        // optionally reload list and clear selected order
        await fetchOrdersList();
        setOrder(null);
        setOrderId("");
      } else {
        throw new Error((r && (r.error || r.message)) || "Confirm failed");
      }
    } catch (e) {
      console.error("confirm error", e);
      alert(e?.message || "Confirm failed");
    } finally {
      setProcessing(false);
    }
  }

  /* small helper to compute local totals */
  function computeOrderTotals() {
    if (!order) return { itemsTotal: 0, itemsCount: 0 };
    const items = order.items || [];
    const itemsTotal = items.reduce((s, it) => s + (Number(it.line_total || (it.qty * (it.unit_price || 0))) || 0), 0);
    return { itemsTotal, itemsCount: items.length };
  }

  /* ---------- Render ---------- */
  const totals = computeOrderTotals();

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Strengths & Requirements</h1>
          <div className="text-sm text-slate-500 mt-1">Finalize strengths, requirements, book prices, item prices and confirm orders.</div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => { fetchOrdersList(); }} className="px-3 py-2 border rounded text-sm">Refresh list</button>
          <button onClick={() => { if (order && order.order_id) loadOrder(order.order_id); else if (orderId) loadOrder(orderId); }} className="px-3 py-2 bg-indigo-600 text-white rounded text-sm">Load Order</button>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-4 shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
          <div className="md:col-span-2">
            <label className="block text-sm text-slate-500">Select order</label>
            <div className="mt-1 flex gap-2 items-center">
              <select ref={orderSelectRef} value={orderId} onChange={(e) => { setOrderId(e.target.value); }} className="w-full border rounded px-3 py-3 text-base">
                <option value="">— select order —</option>
                {loadingOrderList ? (
                  <option>Loading…</option>
                ) : ordersList.length ? ordersList.map(o => (
                  <option key={o.order_id} value={o.order_id}>
                    #{o.order_id} — {o.school_name || o.billing_name || o.contact_name} — {o.status || "—"}
                  </option>
                )) : (
                  <option>No recent orders</option>
                )}
              </select>

              <button onClick={() => { if (!orderId) return alert("Select an order first."); loadOrder(orderId); }} className="px-3 py-2 border rounded text-sm">Open</button>
            </div>
            <div className="text-xs text-slate-400 mt-1">You can also type an order id and press Open.</div>
          </div>

          <div className="text-right">
            <div className="text-sm text-slate-500">Selected order</div>
            <div className="text-lg font-medium">{order ? `#${order.order_id} — ${order.status || "—"}` : "—"}</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border rounded-lg p-8 text-center text-slate-500">Loading order…</div>
      ) : order ? (
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white border rounded-lg p-4 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">Order #{order.order_id} — {order.school_name || order.billing_name}</div>
              <div className="text-sm text-slate-500">Contact: {order.contact_name} — {order.phone} • Order Date: {fmtDateShort(order.order_date || order.created_at)}</div>
            </div>

            <div className="text-right">
              <div className="text-sm text-slate-500">Items: {totals.itemsCount}</div>
              <div className="text-xl font-semibold">Total: ₹{totals.itemsTotal.toFixed(2)}</div>
            </div>
          </div>

          {/* Strengths editing */}
          <section className="bg-white border rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-md font-semibold">Strengths</h3>
                <div className="text-xs text-slate-400">Per-medium / per-standard student counts. Save to regenerate requirements.</div>
              </div>
              <div>
                <button onClick={addStrengthRow} className="px-3 py-2 border rounded text-sm mr-2">Add row</button>
                <button onClick={saveStrengths} disabled={savingStrengths} className="px-3 py-2 bg-emerald-600 text-white rounded text-sm">
                  <Icon name="save" /> {savingStrengths ? "Saving…" : "Save strengths"}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {strengthRows.length ? strengthRows.map((r, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4">
                    <label className="text-xs text-slate-500">Medium</label>
                    <input value={r.medium_id} onChange={(e) => updateStrengthRow(i, "medium_id", e.target.value)} placeholder="medium id" className="w-full border rounded px-2 py-2 text-sm" />
                  </div>
                  <div className="col-span-4">
                    <label className="text-xs text-slate-500">Standard</label>
                    <input value={r.std_id} onChange={(e) => updateStrengthRow(i, "std_id", e.target.value)} placeholder="std id" className="w-full border rounded px-2 py-2 text-sm" />
                  </div>
                  <div className="col-span-3">
                    <label className="text-xs text-slate-500">Students</label>
                    <input type="number" min="0" value={r.students} onChange={(e) => updateStrengthRow(i, "students", Number(e.target.value || 0))} className="w-full border rounded px-2 py-2 text-sm" />
                  </div>
                  <div className="col-span-1 text-right">
                    <button onClick={() => removeStrengthRow(i)} className="text-rose-600 text-sm">Remove</button>
                  </div>
                </div>
              )) : (
                <div className="text-sm text-slate-500">No strengths yet.</div>
              )}
            </div>
          </section>

          {/* Requirements */}
          <section className="bg-white border rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-md font-semibold">Requirements</h3>
                <div className="text-xs text-slate-400">Edit prices per requirement (updates book price if the requirement points to a book).</div>
              </div>

              <div className="flex gap-2">
                <button onClick={handleGenerate} disabled={processing} className="px-3 py-2 border rounded text-sm"><Icon name="generate" /> Generate</button>
                <button onClick={handleReprice} disabled={processing} className="px-3 py-2 border rounded text-sm"><Icon name="reprice" /> Reprice</button>
              </div>
            </div>

            <div className="space-y-2">
              {!(order.requirements && order.requirements.length) ? (
                <div className="text-sm text-slate-500">No requirements found for this order.</div>
              ) : order.requirements.map((rq, i) => {
                const rp = requirementsPrices[rq.req_id] || { price: 100, saving: false };
                return (
                  <div key={rq.req_id || i} className="p-2 bg-slate-50 rounded text-sm flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">{rq.medium_name || rq.medium_id} — {rq.std_name || rq.std_id} • {rq.item_type === "book" ? "Book" : "Course"}</div>
                      <div className="text-xs">Unit qty: {rq.unit_qty} • Students: {rq.students} • Total: {rq.total_qty}</div>
                      <div className="text-xs text-slate-500">Course: {rq.course_id || "—"} • Book: {rq.book_id || "—"}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={rp.price}
                        onChange={(e) => setReqPrice(rq.req_id, Number(e.target.value || 0))}
                        className="w-28 border rounded px-2 py-1 text-sm"
                      />
                      <button onClick={() => saveReqPrice(rq)} disabled={rp.saving} className="px-3 py-1 border rounded text-sm bg-white hover:bg-slate-100">
                        {rp.saving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Items and item price editing */}
          <section className="bg-white border rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-md font-semibold">Items</h3>
                <div className="text-xs text-slate-400">Edit item unit prices (will call PUT /api/orders/:orderId/items/:itemId and trigger server totals update).</div>
              </div>
              <div className="text-sm">Items: {order.items?.length || 0}</div>
            </div>

            <div className="space-y-3">
              {!(order.items && order.items.length) ? (
                <div className="text-sm text-slate-500">No items for this order. Run Generate & Reprice to create items.</div>
              ) : order.items.map(it => {
                const ie = itemsEditing[it.item_id] || { unit_price: it.unit_price || 0, saving: false };
                return (
                  <div key={it.item_id} className="p-3 bg-slate-50 rounded flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium">{it.description || `Item #${it.item_id}`}</div>
                      <div className="text-xs text-slate-500">Qty: {it.qty} • Course: {it.course_id || "—"}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input type="number" min="0" value={ie.unit_price} onChange={(e) => setItemEdit(it.item_id, Number(e.target.value || 0))} className="w-28 border rounded px-2 py-1 text-sm" />
                      <button onClick={() => saveItemPrice(it)} disabled={ie.saving} className="px-3 py-1 border rounded text-sm bg-white hover:bg-slate-100">
                        {ie.saving ? "Saving…" : "Save"}
                      </button>
                      <div className="text-sm font-medium">Line: ₹{(it.line_total != null ? Number(it.line_total) : (it.qty * (ie.unit_price || 0))).toFixed(2)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Finalize / Confirm */}
          <div className="flex items-center justify-end gap-3">
            <button onClick={() => loadOrder(order.order_id)} className="px-3 py-2 border rounded text-sm">Reload</button>
            <button onClick={handleConfirm} disabled={processing} className="px-4 py-2 bg-emerald-600 text-white rounded text-sm">
              <Icon name="confirm" /> {processing ? "Processing…" : "Confirm Order"}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border rounded-lg p-8 text-center text-slate-500">No order selected. Pick one above and press Open.</div>
      )}
    </main>
  );
}
