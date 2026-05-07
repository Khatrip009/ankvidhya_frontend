// src/pages/strength.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../lib/api";
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

function fmtDateShort(s) {
  if (!s) return "—";
  try { return new Date(s).toLocaleString(); } catch { return s; }
}

export default function StrengthsPage() {
  const toast = useToast();

  // Lookup data for dropdowns
  const [mediums, setMediums] = useState([]);
  const [standards, setStandards] = useState([]);

  // Orders list
  const [ordersList, setOrdersList] = useState([]);
  const [orderIdInput, setOrderIdInput] = useState("");
  const [loadingOrderList, setLoadingOrderList] = useState(false);

  // Current order
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);          // <-- FIX: added error state

  // Strengths
  const [strengthRows, setStrengthRows] = useState([]);
  const [savingStrengths, setSavingStrengths] = useState(false);

  // Requirements prices
  const [requirementsPrices, setRequirementsPrices] = useState({});

  // Item editing
  const [itemsEditing, setItemsEditing] = useState({});

  // Action processing
  const [processing, setProcessing] = useState(false);

  const orderSelectRef = useRef(null);

  // Fetch lookups and orders list on mount
  useEffect(() => {
    fetchLookups();
    fetchOrdersList();
  }, []);

  const fetchLookups = async () => {
    try {
      const [medRes, stdRes] = await Promise.all([
        api.get("/api/master/mediums"),
        api.get("/api/master/standards"),
      ]);
      setMediums(medRes?.data || []);
      setStandards(stdRes?.data || []);
    } catch (err) {
      console.error("Failed to load lookups", err);
      toast.error("Failed to load dropdown data");
    }
  };

  const fetchOrdersList = async () => {
    setLoadingOrderList(true);
    try {
      const res = await api.get("/api/orders", { query: { page: 1, pageSize: 100 } });
      setOrdersList(res?.data || []);
    } catch (err) {
      console.error("Fetch orders list failed", err);
      toast.error("Failed to load orders list");
      setOrdersList([]);
    } finally {
      setLoadingOrderList(false);
    }
  };

  // Load order details
  const loadOrder = async (id) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/orders/${id}`, {
        query: { include: "requirements,strengths,items" },
      });
      const data = res?.data;
      if (!data) throw new Error("No order data");

      setOrder(data);

      // Strengths – keep existing IDs, mapped to dropdown-friendly values
      setStrengthRows(
        (data.strengths || []).map(s => ({
          medium_id: s.medium_id ?? "",
          std_id: s.std_id ?? "",
          students: s.students || 0,
        }))
      );

      // Requirements prices
      const rMap = {};
      if (data.requirements?.length) {
        for (const rq of data.requirements) {
          if (rq.book_id) {
            try {
              const b = await api.get(`/api/books/${rq.book_id}`);
              rMap[rq.req_id] = { price: b?.data?.price ?? 100, saving: false };
            } catch {
              rMap[rq.req_id] = { price: 100, saving: false };
            }
          } else {
            rMap[rq.req_id] = { price: 100, saving: false };
          }
        }
      }
      setRequirementsPrices(rMap);

      // Items editing
      const iMap = {};
      (data.items || []).forEach(it => {
        iMap[it.item_id] = {
          unit_price: it.unit_price != null ? Number(it.unit_price) : 0,
          saving: false,
        };
      });
      setItemsEditing(iMap);
    } catch (err) {
      console.error("loadOrder error", err);
      toast.error("Failed to load order details");
      setOrder(null);
      setError(err.message || "Failed to load order");
    } finally {
      setLoading(false);
    }
  };

  // ----- Strengths handling -----
  const addStrengthRow = () => setStrengthRows(s => [...s, { medium_id: "", std_id: "", students: 0 }]);
  const updateStrengthRow = (i, key, val) =>
    setStrengthRows(s => s.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  const removeStrengthRow = (i) => setStrengthRows(s => s.filter((_, idx) => idx !== i));

  const saveStrengths = async () => {
    if (!order?.order_id) return;
    setSavingStrengths(true);
    try {
      const payload = strengthRows.map(r => ({
        medium_id: r.medium_id ? Number(r.medium_id) : null,
        std_id: r.std_id ? Number(r.std_id) : null,
        students_cnt: Number(r.students) || 0,
      }));
      await api.post(`/api/orders/${order.order_id}/strengths`, { strengths: payload });
      toast.success("Strengths saved");
      // Regenerate requirements after saving strengths
      await api.post(`/api/orders/${order.order_id}/generate`);
      loadOrder(order.order_id);
    } catch (err) {
      console.error("saveStrengths error", err);
      toast.error("Failed to save strengths");
    } finally {
      setSavingStrengths(false);
    }
  };

  // ----- Generate / Reprice / Confirm -----
  const handleGenerate = async () => {
    if (!order?.order_id) return;
    if (!window.confirm("Generate requirements? This will replace existing ones.")) return;
    setProcessing(true);
    try {
      await api.post(`/api/orders/${order.order_id}/generate`);
      toast.success("Requirements generated");
      loadOrder(order.order_id);
    } catch (err) {
      console.error("generate error", err);
      toast.error("Generate failed");
    } finally {
      setProcessing(false);
    }
  };

  const handleReprice = async () => {
    if (!order?.order_id) return;
    if (!window.confirm("Reprice this order?")) return;
    setProcessing(true);
    try {
      await api.post(`/api/orders/${order.order_id}/reprice`);
      toast.success("Reprice completed");
      loadOrder(order.order_id);
    } catch (err) {
      console.error("reprice error", err);
      toast.error("Reprice failed");
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirm = async () => {
    if (!order?.order_id) return;
    if (!window.confirm("Confirm this order? This will mark it confirmed and may delete the associated lead.")) return;
    setProcessing(true);
    try {
      await api.post(`/api/orders/${order.order_id}/confirm`);
      toast.success("Order confirmed");
      fetchOrdersList();
      setOrder(null);
      setOrderIdInput("");
    } catch (err) {
      console.error("confirm error", err);
      toast.error("Confirm failed");
    } finally {
      setProcessing(false);
    }
  };

  // ----- Requirement price save -----
  const setReqPrice = (reqId, price) => {
    setRequirementsPrices(prev => ({
      ...prev,
      [reqId]: { ...(prev[reqId] || {}), price },
    }));
  };

  const saveReqPrice = async (req) => {
    const rp = requirementsPrices[req.req_id];
    if (!rp) return;
    const newPrice = Number(rp.price || 0);
    if (isNaN(newPrice) || newPrice < 0) {
      alert("Enter a valid price >= 0");
      return;
    }
    if (req.book_id) {
      setRequirementsPrices(prev => ({
        ...prev,
        [req.req_id]: { ...prev[req.req_id], saving: true },
      }));
      try {
        await api.put(`/api/books/${req.book_id}`, { price: newPrice });
        toast.success("Book price updated");
        handleReprice(); // re-price after book price change
      } catch (err) {
        console.error("save book price failed", err);
        toast.error("Failed to save price");
        setRequirementsPrices(prev => ({
          ...prev,
          [req.req_id]: { ...prev[req.req_id], saving: false },
        }));
      }
    } else {
      // local-only
      setRequirementsPrices(prev => ({
        ...prev,
        [req.req_id]: { ...prev[req.req_id], price: newPrice },
      }));
      toast.success("Price updated locally. Run Reprice to apply.");
    }
  };

  // ----- Item price save -----
  const setItemEdit = (itemId, val) => {
    setItemsEditing(prev => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || {}), unit_price: val },
    }));
  };

  const saveItemPrice = async (item) => {
    const e = itemsEditing[item.item_id];
    if (!e) return;
    const newPrice = Number(e.unit_price || 0);
    if (isNaN(newPrice) || newPrice < 0) {
      alert("Enter a valid unit price >= 0");
      return;
    }
    setItemsEditing(prev => ({
      ...prev,
      [item.item_id]: { ...prev[item.item_id], saving: true },
    }));
    try {
      await api.put(`/api/orders/${order.order_id}/items/${item.item_id}`, { unit_price: newPrice });
      toast.success("Item price updated");
      loadOrder(order.order_id);
    } catch (err) {
      console.error("saveItemPrice error", err);
      toast.error("Failed to save item price");
    } finally {
      setItemsEditing(prev => ({
        ...prev,
        [item.item_id]: { ...prev[item.item_id], saving: false },
      }));
    }
  };

  // Compute order totals for display
  const computeTotals = () => {
    if (!order?.items) return { itemsCount: 0, total: 0 };
    const items = order.items;
    const total = items.reduce((sum, it) => sum + (Number(it.line_total) || 0), 0);
    return { itemsCount: items.length, total };
  };

  const totals = computeTotals();

  // Status badge helper
  const StatusBadge = ({ status }) => {
    const s = (status || "").toLowerCase();
    const map = {
      draft: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
      submitted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400",
      confirmed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400",
      cancelled: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-400",
    };
    return (
      <span className={`inline-flex px-2 py-1 rounded text-sm font-medium ${map[s] || map.draft}`}>
        {status || "draft"}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-3 sm:p-5 lg:p-6 transition-colors">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4 sm:mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                Strengths & Requirements
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Finalize strengths, requirements, and pricing for orders
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <OutlineBtn onClick={fetchOrdersList}>Refresh List</OutlineBtn>
            </div>
          </div>
        </motion.div>

        {/* Order Selection */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-5 shadow-sm mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1">
              <FormField label="Select Order">
                <div className="flex gap-2">
                  <select
                    ref={orderSelectRef}
                    value={orderIdInput}
                    onChange={(e) => setOrderIdInput(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-white"
                  >
                    <option value="">— select order —</option>
                    {loadingOrderList ? (
                      <option disabled>Loading…</option>
                    ) : ordersList.length ? (
                      ordersList.map(o => (
                        <option key={o.order_id} value={o.order_id}>
                          #{o.order_id} - {o.school_name || o.billing_name || o.contact_name} ({o.status || "draft"})
                        </option>
                      ))
                    ) : (
                      <option disabled>No recent orders</option>
                    )}
                  </select>
                  <PrimaryBtn onClick={() => loadOrder(orderIdInput)} disabled={!orderIdInput}>
                    Open
                  </PrimaryBtn>
                </div>
              </FormField>
            </div>

            <div className="text-right">
              <div className="text-sm text-gray-500 dark:text-gray-400">Selected</div>
              <div className="font-medium text-gray-900 dark:text-white">
                {order ? `Order #${order.order_id} (${order.status})` : "—"}
              </div>
            </div>
          </div>
          {error && (
            <div className="mt-2 text-sm text-rose-500">{error}</div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="bg-white dark:bg-gray-800 border rounded-xl p-8 text-center text-gray-500 dark:text-gray-400">
            Loading order…
          </div>
        )}

        {/* No order selected */}
        {!loading && !order && (
          <div className="bg-white dark:bg-gray-800 border rounded-xl p-8 text-center text-gray-500 dark:text-gray-400">
            No order selected. Pick one above and press Open.
          </div>
        )}

        {/* Order Details */}
        {!loading && order && (
          <div className="space-y-4 sm:space-y-6">
            {/* Order Header */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Order #{order.order_id} — {order.school_name || order.billing_name}
                  </h2>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Contact: {order.contact_name} • {order.phone} • Order Date: {fmtDateShort(order.order_date || order.created_at)}
                  </div>
                  <div className="mt-2">
                    <StatusBadge status={order.status} />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Items: {totals.itemsCount}</div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">
                    ₹{totals.total.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Strengths Section (with dropdowns) */}
            <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Strengths</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Define per‑standard student counts. Save will regenerate requirements.</p>
                </div>
                <div className="flex gap-2">
                  <OutlineBtn size="sm" onClick={addStrengthRow}>Add Row</OutlineBtn>
                  <PrimaryBtn size="sm" onClick={saveStrengths} loading={savingStrengths}>
                    Save Strengths
                  </PrimaryBtn>
                </div>
              </div>
              <div className="space-y-3">
                {strengthRows.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No strengths yet.</p>
                )}
                {strengthRows.map((r, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-4">
                      <label className="text-xs text-gray-500 dark:text-gray-400">Medium</label>
                      <Select
                        value={r.medium_id}
                        onChange={(v) => updateStrengthRow(i, "medium_id", v)}
                        options={[
                          { value: "", label: "Select Medium" },
                          ...mediums.map(m => ({ value: m.medium_id, label: m.medium_name })),
                        ]}
                      />
                    </div>
                    <div className="col-span-4">
                      <label className="text-xs text-gray-500 dark:text-gray-400">Standard</label>
                      <Select
                        value={r.std_id}
                        onChange={(v) => updateStrengthRow(i, "std_id", v)}
                        options={[
                          { value: "", label: "Select Standard" },
                          ...standards.map(s => ({ value: s.std_id, label: s.std_name })),
                        ]}
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="text-xs text-gray-500 dark:text-gray-400">Students</label>
                      <input
                        type="number"
                        min="0"
                        value={r.students}
                        onChange={(e) => updateStrengthRow(i, "students", Number(e.target.value || 0))}
                        className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded px-2 py-2 text-sm"
                      />
                    </div>
                    <div className="col-span-1 text-center">
                      <button
                        onClick={() => removeStrengthRow(i)}
                        className="text-rose-500 hover:text-rose-700"
                      >
                        <ERPIcons.Close className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Requirements Section */}
            <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Requirements</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Edit prices per requirement (updates book price if linked).</p>
                </div>
                <div className="flex gap-2">
                  <OutlineBtn size="sm" onClick={handleGenerate} loading={processing}>Generate</OutlineBtn>
                  <SecondaryBtn size="sm" onClick={handleReprice} loading={processing}>Reprice</SecondaryBtn>
                </div>
              </div>
              <div className="space-y-3">
                {!order.requirements?.length ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No requirements found.</p>
                ) : (
                  order.requirements.map(rq => {
                    const rp = requirementsPrices[rq.req_id] || { price: 100, saving: false };
                    return (
                      <div
                        key={rq.req_id || rq.course_id || rq.book_id}
                        className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {rq.medium_name || rq.medium_id} — {rq.std_name || rq.std_id} • {rq.item_type === "book" ? "Book" : "Course"}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Unit qty: {rq.unit_qty} • Students: {rq.students} • Total: {rq.total_qty}
                          </div>
                          <div className="text-xs text-gray-400 dark:text-gray-500">
                            Course: {rq.course_id || "—"} • Book: {rq.book_id || "—"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            value={rp.price}
                            onChange={(e) => setReqPrice(rq.req_id, Number(e.target.value || 0))}
                            className="w-24 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded px-2 py-1 text-sm"
                          />
                          <button
                            onClick={() => saveReqPrice(rq)}
                            disabled={rp.saving}
                            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600"
                          >
                            {rp.saving ? "Saving…" : "Save"}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* Items Section */}
            <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Items</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Edit unit prices (updates order totals).</p>
                </div>
              </div>
              <div className="space-y-3">
                {!order.items?.length ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No items yet. Run Generate & Reprice.</p>
                ) : (
                  order.items.map(it => {
                    const ie = itemsEditing[it.item_id] || { unit_price: it.unit_price || 0, saving: false };
                    return (
                      <div
                        key={it.item_id}
                        className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {it.description || `Item #${it.item_id}`}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Qty: {it.qty} • Course: {it.course_id || "—"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            value={ie.unit_price}
                            onChange={(e) => setItemEdit(it.item_id, Number(e.target.value || 0))}
                            className="w-28 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded px-2 py-1 text-sm"
                          />
                          <button
                            onClick={() => saveItemPrice(it)}
                            disabled={ie.saving}
                            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600"
                          >
                            {ie.saving ? "Saving…" : "Save"}
                          </button>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            ₹{(Number(it.line_total) || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* Finalize Actions */}
            <div className="flex justify-end gap-3 mt-4">
              <OutlineBtn onClick={() => loadOrder(order.order_id)}>Reload</OutlineBtn>
              <DangerBtn onClick={() => {
                if (window.confirm("Delete this order?")) {
                  api.delete(`/api/orders/${order.order_id}`).then(() => {
                    toast.success("Order deleted");
                    setOrder(null);
                    setOrderIdInput("");
                    fetchOrdersList();
                  }).catch(() => toast.error("Delete failed"));
                }
              }}>
                Delete
              </DangerBtn>
              <PrimaryBtn onClick={handleConfirm} loading={processing}>
                Confirm Order
              </PrimaryBtn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}