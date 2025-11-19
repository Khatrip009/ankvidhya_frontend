// src/pages/faculty_assignments.jsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import api from "../lib/api";

import {
  CreateBtn,
  PrimaryBtn,
  SecondaryBtn,
  FileUploadBtn,
  SaveBtn,
  CancelBtn,
  DeleteBtn
} from "../components/buttons.jsx";

import {
  FormField,
  TextInput,
  TextArea,
  Select,
  DateInput
} from "../components/input.jsx";

/**
 * Faculty Assignments — final patched
 * - fixed syntax error
 * - skeleton loading cards
 * - global font + card animations (scoped)
 * - prefetch employee images from /api/employees
 * - grouped school grid inside each faculty card
 */

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_PHOTO = "/images/ANK.png";

/* -------------------------
   Fetch helpers (fixed routes)
   ------------------------- */
async function fetchAll(url, query = {}) {
  const res = await api.get(url, { query });
  return res?.data || [];
}
const fetchSchools = () => fetchAll("/api/schools/schools", { pageSize: 1000 });
const fetchMediums = () => fetchAll("/api/master/media", { pageSize: 1000 });
const fetchStandards = () => fetchAll("/api/master/standards", { pageSize: 1000 });
const fetchDivisions = () => fetchAll("/api/master/divisions", { pageSize: 1000 });
const fetchRoles = () => fetchAll("/api/master/roles", { pageSize: 1000 });

function getSelectedSchoolIdSafe(allowedSchools, chosen) {
  if (!chosen) return "";
  return allowedSchools.some(s => String(s.school_id) === String(chosen)) ? chosen : "";
}
function fmtDate(d) {
  if (!d) return "-";
  try { return String(d).slice(0,10); } catch { return d; }
}

// group assignments by school+medium for display inside each card
function schoolGroupsForCard(assignments = []) {
  const acc = {};
  for (const a of assignments) {
    const key = `${a.school_id || "s-"}|${a.medium_id || "m-"}`;
    if (!acc[key]) acc[key] = { school_id: a.school_id, school_name: a.school_name, medium_name: a.medium_name, rows: [] };
    acc[key].rows.push(a);
  }
  return Object.values(acc);
}

export default function FacultyAssignmentsPage() {
  // masters
  const [schools, setSchools] = useState([]);
  const [mediums, setMediums] = useState([]);
  const [standards, setStandards] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [roles, setRoles] = useState([]);

  // employees list (for form & images)
  const [employees, setEmployees] = useState([]);
  const empImageMapRef = useRef({}); // { employee_id: imageUrl }

  // filters
  const [search, setSearch] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [mediumId, setMediumId] = useState("");
  const [stdId, setStdId] = useState("");
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // paging & data
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [grouped, setGrouped] = useState([]); // array of { employee_id, employee_name, username, image, assignments: [...] }
  const [loading, setLoading] = useState(false);

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm());

  // import / bulk
  const [importOpen, setImportOpen] = useState(false);
  const [importCsvText, setImportCsvText] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkJsonText, setBulkJsonText] = useState("");
  const [bulkMode, setBulkMode] = useState("insert");
  const [saving, setSaving] = useState(false);

  const facultyRoleIdRef = useRef(null);

  // initial load of masters + employees (and cache employee images)
  useEffect(() => {
    (async () => {
      try {
        const [r, s, m, st, d] = await Promise.all([
          fetchRoles(), fetchSchools(), fetchMediums(), fetchStandards(), fetchDivisions()
        ]);
        setRoles(r || []); setSchools(s || []); setMediums(m || []); setStandards(st || []); setDivisions(d || []);
        const facId = (r || []).find(x => String(x.role_name || "").toLowerCase() === "faculty")?.role_id || null;
        facultyRoleIdRef.current = facId;

        // preload employees (faculty) and build image map
        const emps = await loadFacultyEmployees(facId, "");
        setEmployees(emps || []);
        const map = {};
        (emps || []).forEach(e => { if (e && (e.employee_id || e.id)) map[String(e.employee_id || e.id)] = e.image || e.photo || ""; });
        empImageMapRef.current = map;
      } catch (err) {
        console.error("load masters", err);
        window.ui?.toast?.(err?.message || "Failed to load masters", "danger");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // load assignments grouped by employee
  const loadAssignments = useCallback(async (pg = 1, pgSize = pageSize) => {
    setLoading(true);
    try {
      const query = { page: pg, pageSize: pgSize };
      if (search) query.search = search;
      if (schoolId) {
        const s = (schools || []).find(x => String(x.school_id) === String(schoolId));
        if (s) query.school_name = s.school_name;
      }
      if (mediumId) {
        const m = (mediums || []).find(x => String(x.medium_id) === String(mediumId));
        if (m) query.medium_name = m.medium_name;
      }
      if (stdId) {
        const st = (standards || []).find(x => String(x.std_id) === String(stdId));
        if (st) query.std_name = st.std_name;
      }

      const res = await api.get("/api/faculty-assignments", { query });
      const rows = res?.data || [];
      const pgInfo = res?.pagination || { page: pg, pageSize: pgSize, total: rows.length };

      // group by employee_id and attach image (from row or from employee map)
      const map = new Map();
      for (const r of rows) {
        const empKey = r.employee_id != null ? String(r.employee_id) : `_u_${r.employee_name || "unknown"}`;
        if (!map.has(empKey)) {
          let img = r.image || r.photo || "";
          if (!img) img = empImageMapRef.current[String(r.employee_id)] || "";
          map.set(empKey, {
            employee_id: r.employee_id,
            employee_name: r.employee_name || r.full_name || "—",
            username: r.username || r.user_name || r.user || "",
            image: img || "",
            assignments: []
          });
        }
        map.get(empKey).assignments.push(r);
      }

      setGrouped(Array.from(map.values()));
      setTotal(pgInfo.total || 0);
      setPage(pgInfo.page || pg);
    } catch (err) {
      console.error("fetch assignments", err);
      window.ui?.toast?.(err?.message || "Failed to load assignments", "danger");
      setGrouped([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [search, schoolId, mediumId, stdId, schools, mediums, standards, pageSize]);

  useEffect(() => { loadAssignments(page, pageSize); }, [loadAssignments, page, pageSize]);

  // helper to get a flat employee list (for select)
  async function loadFacultyEmployees(facultyRoleId, schoolIdSafe) {
    try {
      const query = { pageSize: 1000 };
      if (facultyRoleId) query.role_id = facultyRoleId;
      if (schoolIdSafe) query.school_id = schoolIdSafe;
      const res = await api.get("/api/employees", { query });
      let emps = res?.data || [];
      if (!facultyRoleId) emps = emps.filter(e => String(e.role_name || "").toLowerCase() === "faculty");
      return emps;
    } catch (err) {
      console.error("load employees", err);
      return [];
    }
  }

  // open modal utilities (same as earlier)
  function openForm(mode = "new", row = null) {
    if (mode === "view" && row) {
      setViewOnly(true);
      setForm({
        fa_id: row.fa_id || null,
        employee_id: row.employee_id || "",
        school_id: row.school_id || "",
        medium_id: row.medium_id || "",
        std_ids: row.std_id ? [row.std_id] : [],
        div_ids: row.div_id ? [row.div_id] : [],
        start_date: row.start_date ? String(row.start_date).slice(0,10) : "",
        end_date: row.end_date ? String(row.end_date).slice(0,10) : "",
        notes: row.notes || ""
      });
      setEditing(row || null);
      setModalOpen(true);
      return;
    }

    if (mode === "edit" && row) {
      setViewOnly(false);
      setForm({
        fa_id: row.fa_id || null,
        employee_id: row.employee_id || "",
        school_id: row.school_id || "",
        medium_id: row.medium_id || "",
        std_ids: row.std_id ? [row.std_id] : [],
        div_ids: row.div_id ? [row.div_id] : [],
        start_date: row.start_date ? String(row.start_date).slice(0,10) : "",
        end_date: row.end_date ? String(row.end_date).slice(0,10) : "",
        notes: row.notes || ""
      });
      setEditing(row);
      setModalOpen(true);
      return;
    }

    // new
    setViewOnly(false);
    setEditing(null);
    setForm(defaultForm());
    setModalOpen(true);
  }

  // helper toggles
  function toggleSelection(arr, id) {
    const s = String(id);
    if (!Array.isArray(arr)) arr = [];
    if (arr.some(x => String(x) === s)) return arr.filter(x => String(x) !== s);
    return [...arr, id];
  }
  function toggleAllStandards(val) {
    if (!Array.isArray(standards)) return;
    if (val) setForm(f => ({ ...f, std_ids: (standards || []).map(s => s.std_id) }));
    else setForm(f => ({ ...f, std_ids: [] }));
  }
  function toggleAllDivisions(val) {
    if (!Array.isArray(divisions)) return;
    if (val) setForm(f => ({ ...f, div_ids: (divisions || []).map(d => d.div_id) }));
    else setForm(f => ({ ...f, div_ids: [] }));
  }

  // save (multi-combo logic)
  async function handleSave(e) {
    e?.preventDefault?.();
    setSaving(true);
    try {
      if (!form.employee_id) { window.ui?.toast?.("Employee is required", "danger"); setSaving(false); return; }
      if (!form.school_id) { window.ui?.toast?.("School is required", "danger"); setSaving(false); return; }
      if (!form.start_date) { window.ui?.toast?.("Start date is required", "danger"); setSaving(false); return; }

      const safeSchool = getSelectedSchoolIdSafe(schools, form.school_id);
      if (!safeSchool) { window.ui?.toast?.("You do not have access to that school (RLS).", "warning"); setSaving(false); return; }

      const stds = (Array.isArray(form.std_ids) && form.std_ids.length) ? form.std_ids : [null];
      const divs = (Array.isArray(form.div_ids) && form.div_ids.length) ? form.div_ids : [null];
      const stdsNorm = stds.map(s => (s === null ? null : Number(s)));
      const divsNorm = divs.map(d => (d === null ? null : Number(d)));

      const combos = [];
      for (const s of stdsNorm) for (const d of divsNorm) combos.push({ std_id: s, div_id: d });

      const basePayload = {
        employee_id: Number(form.employee_id) || null,
        school_id: Number(form.school_id) || null,
        medium_id: form.medium_id ? Number(form.medium_id) : null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        notes: form.notes?.trim() || null
      };

      if (form.fa_id && combos.length === 1) {
        const payload = { ...basePayload, std_id: combos[0].std_id, div_id: combos[0].div_id };
        await api.put(`/api/faculty-assignments/${form.fa_id}`, payload);
        window.ui?.toast?.("Updated", "success");
      } else {
        const tasks = [];
        if (form.fa_id && combos.length >= 1) {
          const first = combos[0];
          tasks.push(api.put(`/api/faculty-assignments/${form.fa_id}`, { ...basePayload, std_id: first.std_id, div_id: first.div_id }));
          for (let i = 1; i < combos.length; i++) {
            const c = combos[i];
            tasks.push(api.post("/api/faculty-assignments", { ...basePayload, std_id: c.std_id, div_id: c.div_id }));
          }
        } else {
          for (const c of combos) tasks.push(api.post("/api/faculty-assignments", { ...basePayload, std_id: c.std_id, div_id: c.div_id }));
        }

        const results = await Promise.allSettled(tasks);
        let success = 0, failed = 0;
        results.forEach(r => r.status === "fulfilled" ? success++ : failed++);
        if (failed === 0) window.ui?.toast?.(`${success} assignment(s) saved`, "success");
        else window.ui?.toast?.(`${success} saved, ${failed} failed`, "warning");
      }

      setModalOpen(false);
      await loadAssignments(1, pageSize);
    } catch (err) {
      if (err?.status === 403) window.ui?.toast?.("Restricted by RLS.", "warning");
      else window.ui?.toast?.(err?.message || "Save failed", "danger");
      console.error("save assignment", err);
    } finally {
      setSaving(false);
    }
  }

  // delete a single assignment id
  async function handleDelete(id) {
    if (!window.confirm("Delete this assignment?")) return;
    try {
      await api.del(`/api/faculty-assignments/${id}`);
      window.ui?.toast?.("Deleted", "success");
      await loadAssignments(page, pageSize);
    } catch (err) {
      if (err?.status === 403) window.ui?.toast?.("Restricted by RLS.", "warning");
      else window.ui?.toast?.(err?.message || "Delete failed", "danger");
    }
  }

  // CSV import (file) and bulk handlers
  async function handleFileImport(f) {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await api.post("/api/faculty-assignments/import-csv", { csv: String(reader.result || "") });
        window.ui?.toast?.("Import done", "success");
        await loadAssignments(1, pageSize);
      } catch (err) {
        if (err?.status === 403) window.ui?.toast?.("Restricted by RLS.", "warning");
        else window.ui?.toast?.(err?.message || "Import failed", "danger");
      }
    };
    reader.readAsText(f);
  }

  async function handleImportSubmit(e) {
    e?.preventDefault?.();
    if (!importCsvText || !importCsvText.trim()) { window.ui?.toast?.("Paste CSV first", "danger"); return; }
    try {
      await api.post("/api/faculty-assignments/import-csv", { csv: importCsvText });
      window.ui?.toast?.("Import done", "success");
      setImportOpen(false);
      setImportCsvText("");
      await loadAssignments(1, pageSize);
    } catch (err) {
      if (err?.status === 403) window.ui?.toast?.("Restricted by RLS.", "warning");
      else window.ui?.toast?.(err?.message || "Import failed", "danger");
    }
  }

  async function handleBulkSubmit(e) {
    e?.preventDefault?.();
    if (!bulkJsonText || !bulkJsonText.trim()) { window.ui?.toast?.("Provide JSON array", "danger"); return; }
    let data;
    try { data = JSON.parse(bulkJsonText); }
    catch { window.ui?.toast?.("Invalid JSON", "danger"); return; }
    if (!Array.isArray(data)) { window.ui?.toast?.("JSON must be an array", "danger"); return; }

    try {
      if (bulkMode === "insert") {
        await api.post("/api/faculty-assignments/bulk-insert", data);
      } else {
        await api.post("/api/faculty-assignments/bulk-upsert", data);
      }
      window.ui?.toast?.("Bulk operation completed", "success");
      setBulkOpen(false);
      setBulkJsonText("");
      await loadAssignments(1, pageSize);
    } catch (err) {
      if (err?.status === 403) window.ui?.toast?.("Restricted by RLS.", "warning");
      else window.ui?.toast?.(err?.message || "Bulk operation failed", "danger");
    }
  }

  // pager
  const totalPages = Math.max(1, Math.ceil((total || 0) / (pageSize || DEFAULT_PAGE_SIZE)));
  function goPrev() { if (page > 1) { setPage(p => p - 1); loadAssignments(page - 1, pageSize); } }
  function goNext() { if (page < totalPages) { setPage(p => p + 1); loadAssignments(page + 1, pageSize); } }

  // small skeleton generator
  function renderSkeletons(count = 6) {
    return Array.from({ length: count }).map((_, i) => (
      <div key={`skel-${i}`} className="bg-white border rounded-lg shadow-sm overflow-hidden animate-pulse" style={{ minHeight: 160 }}>
        <div className="flex items-center gap-3 p-4 border-b">
          <div className="h-16 w-16 rounded-full bg-slate-200" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-4 bg-slate-200 rounded w-3/5" />
            <div className="h-3 bg-slate-200 rounded w-1/3" />
          </div>
        </div>
        <div className="p-4 space-y-2">
          <div className="h-10 bg-slate-100 rounded" />
          <div className="h-10 bg-slate-100 rounded" />
        </div>
      </div>
    ));
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8" style={{ fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial" }}>
      {/* header + actions */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Faculty Assignments</h1>
          <div className="text-sm text-slate-500">View faculty cards with assigned schools / standards / divisions</div>
        </div>

        <div className="flex items-center gap-2">
          <a className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border" href="/api/faculty-assignments/export/csv" target="_blank" rel="noreferrer">
            <i className="bi bi-filetype-csv" /> Export CSV
          </a>

          <FileUploadBtn accept=".csv,text/csv" onChange={(e) => handleFileImport(e.target.files && e.target.files[0])}>Import CSV</FileUploadBtn>

          <SecondaryBtn onClick={() => { setBulkMode("insert"); setBulkOpen(true); }}>Bulk Insert (JSON)</SecondaryBtn>
          <SecondaryBtn onClick={() => { setBulkMode("upsert"); setBulkOpen(true); }}>Bulk Upsert (JSON)</SecondaryBtn>

          <CreateBtn onClick={() => openForm("new")} />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-lg p-4 shadow-sm mb-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-3">
            <FormField label="Search">
              <TextInput placeholder="Search employee / notes" value={search} onChange={(v) => { setSearch(v); setPage(1); loadAssignments(1, pageSize); }} />
            </FormField>
          </div>

          <div>
            <FormField label="School">
              <Select value={schoolId} onChange={(v) => { setSchoolId(v); setPage(1); loadAssignments(1, pageSize); }} options={[{ value: "", label: "All" }, ...(schools || []).map(s => ({ value: s.school_id, label: s.school_name }))]} />
            </FormField>
          </div>

          <div>
            <FormField label="Medium">
              <Select value={mediumId} onChange={(v) => { setMediumId(v); setPage(1); loadAssignments(1, pageSize); }} options={[{ value: "", label: "All" }, ...(mediums || []).map(m => ({ value: m.medium_id, label: m.medium_name }))]} />
            </FormField>
          </div>

          <div>
            <FormField label="Standard">
              <Select value={stdId} onChange={(v) => { setStdId(v); setPage(1); loadAssignments(1, pageSize); }} options={[{ value: "", label: "All" }, ...(standards || []).map(s => ({ value: s.std_id, label: s.std_name }))]} />
            </FormField>
          </div>

          <div>
            <FormField label="Page Size">
              <Select value={pageSize} onChange={(v) => { setPageSize(Number(v)); setPage(1); loadAssignments(1, Number(v)); }} options={[{ value: 10, label: "10" }, { value: 20, label: "20" }, { value: 50, label: "50" }]} />
            </FormField>
          </div>
        </div>
      </div>

      {/* Cards grid - auto adjustable using minmax (wider cards by default) */}
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
        }}
      >
        {loading && renderSkeletons(6)}

        {!loading && (grouped || []).length === 0 && (
          <div className="col-span-full p-6 text-center text-slate-500">No assignments found</div>
        )}

        {!loading && (grouped || []).map(card => (
          <div
            key={card.employee_id || card.employee_name}
            className="bg-white border rounded-lg shadow-sm overflow-hidden transform transition duration-200 hover:-translate-y-1 hover:shadow-lg"
            style={{ minHeight: 160, display: "flex", flexDirection: "column", animation: "fadeIn .28s ease" }}
          >
            <div className="flex items-center gap-3 p-4 border-b">
              <div className="h-16 w-16 rounded-full bg-white overflow-hidden flex-shrink-0 border">
                <img
                  src={card.image || DEFAULT_PHOTO}
                  alt={card.employee_name}
                  className="h-full w-full object-cover"
                  onError={(e) => (e.currentTarget.src = DEFAULT_PHOTO)}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold truncate">{card.employee_name}</div>
                    <div className="text-xs text-slate-500 truncate">{card.username || ""}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{(card.assignments || []).length}</div>
                    <div className="text-xs text-slate-400">assignment(s)</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 space-y-3 flex-1 overflow-auto">
              {/* Group by school inside the card */}
              {schoolGroupsForCard(card.assignments || []).map(sg => (
                <div key={`${sg.school_id}_${sg.medium_name || ""}`} className="border rounded p-3 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{sg.school_name || "-"}</div>
                    <div className="text-xs text-slate-500">{sg.medium_name ? <span>• {sg.medium_name}</span> : null}</div>
                  </div>

                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(() => {
                      const combos = [];
                      const seen = new Set();
                      for (const r of (sg.rows || [])) {
                        const stdLabel = r.std_name || null;
                        const divLabel = r.division_name || null;
                        const key = `${stdLabel || "-"}|${divLabel || "-"}`;
                        if (!seen.has(key)) {
                          seen.add(key);
                          combos.push({ std: stdLabel, div: divLabel, start: r.start_date, end: r.end_date, notes: r.notes, fa_id: r.fa_id, row: r });
                        }
                      }
                      return combos.map(c => (
                        <div key={`${c.std}_${c.div}_${c.fa_id}`} className="p-2 bg-white border rounded text-sm flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium">
                              {c.std ? <span>Std <strong className="text-slate-700">{c.std}</strong></span> : <span>-</span>}
                              {c.div ? <span className="ml-2">Div <strong className="text-slate-700">{c.div}</strong></span> : null}
                            </div>
                            <div className="text-xs text-slate-400">Start: {fmtDate(c.start)} • End: {c.end ? fmtDate(c.end) : "-"}</div>
                            {c.notes && <div className="text-xs text-slate-500 truncate" title={c.notes}>{c.notes}</div>}
                          </div>

                          <div className="flex-shrink-0 ml-3 flex flex-col items-end gap-2">
                            <PrimaryBtn size="xs" onClick={() => openForm("view", { fa_id: c.fa_id, ...c.row })}>View</PrimaryBtn>
                            <SecondaryBtn size="xs" onClick={() => openForm("edit", { fa_id: c.fa_id, ...c.row })}>Edit</SecondaryBtn>
                            <DeleteBtn size="xs" onClick={() => handleDelete(c.fa_id)} />
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 border-t flex items-center justify-between text-xs text-slate-500">
              <div>{(card.assignments || []).some(a => a.notes) ? "Notes available" : "No notes"}</div>
              <div>{(card.assignments || []).some(a => a.end_date && new Date(a.end_date) < new Date()) ? <span className="text-rose-600">Some ended</span> : <span>Active</span>}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Pager */}
      <div className="mt-6 flex items-center justify-between">
        <div className="text-sm text-slate-500">Showing page {page} of {totalPages} — {total} result(s)</div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 rounded border disabled:opacity-50" onClick={goPrev} disabled={page<=1}>Prev</button>
          <button className="px-3 py-1 rounded border disabled:opacity-50" onClick={goNext} disabled={page>=totalPages}>Next</button>
        </div>
      </div>

      {/* Modal: Create / Edit / View (multi-std/div UI) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalOpen(false)} />
          <div className="relative z-10 w-full max-w-3xl bg-white rounded-lg shadow-lg overflow-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="flex items-center gap-3">
                <img src="/images/Ank_Logo.png" alt="logo" className="h-10 w-auto object-contain" />
                <div>
                  <div className="text-lg font-semibold">{viewOnly ? `View • ${form.employee_id ? "" : ""}` : (form.fa_id ? "Edit Assignment" : "New Assignment")}</div>
                  <div className="text-xs text-slate-400">Link faculty to school / medium / standard / division</div>
                </div>
              </div>
              <div>
                <button className="text-sm text-slate-500 hover:text-slate-700" onClick={() => setModalOpen(false)}>Close</button>
              </div>
            </div>

            <form onSubmit={handleSave} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Employee *">
                  <Select value={form.employee_id} onChange={(v) => setForm(f => ({ ...f, employee_id: v }))} options={[{ value: "", label: "Select" }, ...(employees || []).map(e => ({ value: e.employee_id, label: e.full_name || e.employee_name || e.username }))]} />
                </FormField>

                <FormField label="School *">
                  <Select value={form.school_id} onChange={(v) => setForm(f => ({ ...f, school_id: v }))} options={[{ value: "", label: "Select" }, ...(schools || []).map(s => ({ value: s.school_id, label: s.school_name }))]} />
                </FormField>

                <FormField label="Medium">
                  <Select value={form.medium_id} onChange={(v) => setForm(f => ({ ...f, medium_id: v }))} options={[{ value: "", label: "Select" }, ...(mediums || []).map(m => ({ value: m.medium_id, label: m.medium_name }))]} />
                </FormField>

                {/* MULTI-STANDARDS */}
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="form-label">Standards (multi-select)</label>
                    <div className="text-xs text-slate-500">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Array.isArray(form.std_ids) && Array.isArray(standards) && form.std_ids.length === standards.length && standards.length>0}
                          onChange={(e) => toggleAllStandards(e.target.checked)}
                        />
                        <span>Select all</span>
                      </label>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-auto border rounded p-2 bg-slate-50">
                    {(standards || []).length === 0 ? (
                      <div className="text-sm text-slate-400 col-span-2">No standards</div>
                    ) : (standards || []).map(s => {
                      const checked = Array.isArray(form.std_ids) && form.std_ids.some(x => String(x) === String(s.std_id));
                      return (
                        <label key={s.std_id} className="inline-flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={checked} disabled={viewOnly} onChange={() => setForm(f => ({ ...f, std_ids: toggleSelection(f.std_ids, s.std_id) }))} />
                          <span>{s.std_name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* MULTI-DIVISIONS */}
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="form-label">Divisions (multi-select)</label>
                    <div className="text-xs text-slate-500">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Array.isArray(form.div_ids) && Array.isArray(divisions) && form.div_ids.length === divisions.length && divisions.length>0}
                          onChange={(e) => toggleAllDivisions(e.target.checked)}
                        />
                        <span>Select all</span>
                      </label>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-auto border rounded p-2 bg-slate-50">
                    {(divisions || []).length === 0 ? (
                      <div className="text-sm text-slate-400 col-span-2">No divisions</div>
                    ) : (divisions || []).map(d => {
                      const checked = Array.isArray(form.div_ids) && form.div_ids.some(x => String(x) === String(d.div_id));
                      return (
                        <label key={d.div_id} className="inline-flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={checked} disabled={viewOnly} onChange={() => setForm(f => ({ ...f, div_ids: toggleSelection(f.div_ids, d.div_id) }))} />
                          <span>{d.division_name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <FormField label="Start Date *">
                  <DateInput value={form.start_date} onChange={(v) => setForm(f => ({ ...f, start_date: v }))} />
                </FormField>

                <FormField label="End Date">
                  <DateInput value={form.end_date} onChange={(v) => setForm(f => ({ ...f, end_date: v }))} />
                </FormField>

                <div className="col-span-2">
                  <FormField label="Notes">
                    <TextArea value={form.notes} onChange={(v) => setForm(f => ({ ...f, notes: v }))} />
                  </FormField>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <CancelBtn onClick={() => setModalOpen(false)} />
                {!viewOnly && <SaveBtn loading={saving} />}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import CSV modal */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setImportOpen(false)} />
          <div className="relative z-10 w-full max-w-3xl bg-white rounded-lg shadow-lg overflow-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div>
                <div className="text-lg font-semibold">Import Faculty Assignments (CSV)</div>
                <div className="text-xs text-slate-400">Headers: employee_name, school_name, medium_name, std_name, division_name, start_date, end_date, notes</div>
              </div>
              <div>
                <button className="text-sm text-slate-500 hover:text-slate-700" onClick={() => setImportOpen(false)}>Close</button>
              </div>
            </div>

            <form onSubmit={handleImportSubmit} className="p-4 space-y-4">
              <FormField label="CSV content">
                <TextArea value={importCsvText} onChange={(v) => setImportCsvText(v)} />
              </FormField>

              <div className="flex justify-end gap-3">
                <CancelBtn onClick={() => setImportOpen(false)} />
                <PrimaryBtn onClick={handleImportSubmit}>Import</PrimaryBtn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk JSON modal */}
      {bulkOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setBulkOpen(false)} />
          <div className="relative z-10 w-full max-w-3xl bg-white rounded-lg shadow-lg overflow-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div>
                <div className="text-lg font-semibold">{bulkMode === "insert" ? "Bulk Insert (JSON)" : "Bulk Upsert (JSON)"}</div>
                <div className="text-xs text-slate-400">Provide an array. Fields: fa_id?, employee_name|employee_id, school_name|school_id, medium_name|medium_id?, std_name|std_id?, division_name|div_id?, start_date, end_date?, notes?</div>
              </div>
              <div>
                <button className="text-sm text-slate-500 hover:text-slate-700" onClick={() => setBulkOpen(false)}>Close</button>
              </div>
            </div>

            <form onSubmit={handleBulkSubmit} className="p-4 space-y-4">
              <FormField label="JSON array">
                <TextArea value={bulkJsonText} onChange={(v) => setBulkJsonText(v)} />
              </FormField>

              <div className="flex justify-end gap-3">
                <CancelBtn onClick={() => setBulkOpen(false)} />
                <PrimaryBtn onClick={handleBulkSubmit}>Run</PrimaryBtn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* component-scoped styles (font import + tiny animation) */}
      <style>{`
        /* Font: Inter (scoped import so you can drop this file as-is) */
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&display=swap');

        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn .28s ease; }
      `}</style>
    </main>
  );
}

/* small helpers */
function defaultForm() {
  return {
    fa_id: null,
    employee_id: "",
    school_id: "",
    medium_id: "",
    std_ids: [],
    div_ids: [],
    start_date: "",
    end_date: "",
    notes: ""
  };
}
