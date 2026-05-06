// src/pages/faculty_assignments.jsx
import React, { useEffect, useState, useCallback, useRef } from "react";
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
  TextArea,
  Select,
  DateInput,
} from "../components/input.jsx";
import { useToast } from "../hooks/useToast.jsx";
import ERPIcons from "../components/icons.jsx";
import { LoadingCard } from "../components/cards.jsx";

const DEFAULT_PHOTO = "/images/ANK.png";
const MODAL_HEADER_LOGO = "/images/Ank_Logo.png";
const DEFAULT_PAGE_SIZE = 20;

// ---------- Helpers ----------
async function fetchAll(url, params = {}) {
  const res = await api.get(url, { params });
  return res?.data || [];
}

const fetchSchools = () => fetchAll("/api/schools/schools", { pageSize: 1000 });
const fetchMediums = () => fetchAll("/api/master/media", { pageSize: 1000 });
const fetchStandards = () => fetchAll("/api/master/standards", { pageSize: 1000 });
const fetchDivisions = () => fetchAll("/api/master/divisions", { pageSize: 1000 });
const fetchRoles = () => fetchAll("/api/master/roles", { pageSize: 1000 });

function fmtDate(d) {
  if (!d) return "—";
  try { return String(d).slice(0, 10); } catch { return String(d); }
}

function schoolGroupsForCard(assignments = []) {
  const acc = {};
  for (const a of assignments) {
    const key = `${a.school_id || "s-"}|${a.medium_id || "m-"}`;
    if (!acc[key]) {
      acc[key] = {
        school_id: a.school_id,
        school_name: a.school_name,
        medium_name: a.medium_name,
        rows: [],
      };
    }
    acc[key].rows.push(a);
  }
  return Object.values(acc);
}

export default function FacultyAssignmentsPage() {
  const toast = useToast();

  // Master data
  const [schools, setSchools] = useState([]);
  const [mediums, setMediums] = useState([]);
  const [standards, setStandards] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const empImageMapRef = useRef({});

  // Filter states
  const [search, setSearch] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [mediumId, setMediumId] = useState("");
  const [stdId, setStdId] = useState("");
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Pagination
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [grouped, setGrouped] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm());

  // Import / Bulk
  const [importOpen, setImportOpen] = useState(false);
  const [importCsvText, setImportCsvText] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkJsonText, setBulkJsonText] = useState("");
  const [bulkMode, setBulkMode] = useState("insert");
  const [saving, setSaving] = useState(false);

  // File upload
  const importFileRef = useRef(null);
  const [isSelectingFile, setIsSelectingFile] = useState(false);

  const facultyRoleIdRef = useRef(null);

  // ------- Initialize masters + employees -------
  useEffect(() => {
    (async () => {
      try {
        const [r, s, m, st, d] = await Promise.all([
          fetchRoles(),
          fetchSchools(),
          fetchMediums(),
          fetchStandards(),
          fetchDivisions(),
        ]);
        setRoles(r);
        setSchools(s);
        setMediums(m);
        setStandards(st);
        setDivisions(d);

        const facId = r.find(x => String(x.role_name || "").toLowerCase() === "faculty")?.role_id || null;
        facultyRoleIdRef.current = facId;

        const emps = await loadFacultyEmployees(facId, "");
        setEmployees(emps);
        const map = {};
        emps.forEach(e => {
          if (e?.employee_id || e?.id) map[String(e.employee_id || e.id)] = e.image || e.photo || "";
        });
        empImageMapRef.current = map;
      } catch (err) {
        console.error("load masters", err);
        toast.error("Failed to load dropdown data");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------- Load assignments grouped by employee -------
  const loadAssignments = useCallback(
    async (pg = 1, pgSize = pageSize) => {
      setLoading(true);
      try {
        const params = { page: pg, pageSize: pgSize };
        if (search) params.search = search;
        if (schoolId) params.school_id = schoolId;
        if (mediumId) params.medium_id = mediumId;
        if (stdId) params.std_id = stdId;

        const res = await api.get("/api/faculty-assignments", { params });
        const rows = res?.data || [];
        const pgInfo = res?.pagination || { page: pg, pageSize: pgSize, total: rows.length };

        const map = new Map();
        for (const r of rows) {
          const empKey = r.employee_id != null ? String(r.employee_id) : `_u_${r.employee_name || "unknown"}`;
          if (!map.has(empKey)) {
            let img = r.image || r.photo || empImageMapRef.current[String(r.employee_id)] || "";
            map.set(empKey, {
              employee_id: r.employee_id,
              employee_name: r.employee_name || r.full_name || "—",
              username: r.username || r.user_name || "",
              image: img || "",
              assignments: [],
            });
          }
          map.get(empKey).assignments.push(r);
        }

        setGrouped(Array.from(map.values()));
        setTotal(pgInfo.total);
        setPage(pgInfo.page || pg);
      } catch (err) {
        console.error("fetch assignments", err);
        toast.error("Failed to load assignments");
        setGrouped([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [search, schoolId, mediumId, stdId, pageSize, toast]
  );

  useEffect(() => {
    loadAssignments(page, pageSize);
  }, [loadAssignments, page, pageSize]);

  // ------- Helpers for employees list -------
  async function loadFacultyEmployees(facultyRoleId, schoolIdSafe) {
    try {
      const params = { pageSize: 1000 };
      if (facultyRoleId) params.role_id = facultyRoleId;
      if (schoolIdSafe) params.school_id = schoolIdSafe;
      const res = await api.get("/api/employees", { params });
      let emps = res?.data || [];
      if (!facultyRoleId) emps = emps.filter(e => String(e.role_name || "").toLowerCase() === "faculty");
      return emps;
    } catch (err) {
      console.error("load employees", err);
      return [];
    }
  }

  // ------- Modal handling -------
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
        start_date: row.start_date ? String(row.start_date).slice(0, 10) : "",
        end_date: row.end_date ? String(row.end_date).slice(0, 10) : "",
        notes: row.notes || "",
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
        start_date: row.start_date ? String(row.start_date).slice(0, 10) : "",
        end_date: row.end_date ? String(row.end_date).slice(0, 10) : "",
        notes: row.notes || "",
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

  function toggleSelection(arr, id) {
    const s = String(id);
    if (!Array.isArray(arr)) arr = [];
    if (arr.some(x => String(x) === s)) return arr.filter(x => String(x) !== s);
    return [...arr, id];
  }

  function toggleAllStandards(val) {
    if (!Array.isArray(standards)) return;
    if (val) setForm(f => ({ ...f, std_ids: standards.map(s => s.std_id) }));
    else setForm(f => ({ ...f, std_ids: [] }));
  }

  function toggleAllDivisions(val) {
    if (!Array.isArray(divisions)) return;
    if (val) setForm(f => ({ ...f, div_ids: divisions.map(d => d.div_id) }));
    else setForm(f => ({ ...f, div_ids: [] }));
  }

  // ------- Save assignment -------
  async function handleSave(e) {
    e?.preventDefault?.();
    setSaving(true);
    try {
      if (!form.employee_id) { toast.error("Employee is required"); setSaving(false); return; }
      if (!form.school_id) { toast.error("School is required"); setSaving(false); return; }
      if (!form.start_date) { toast.error("Start date is required"); setSaving(false); return; }

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
        notes: form.notes?.trim() || null,
      };

      if (form.fa_id && combos.length === 1) {
        const payload = { ...basePayload, std_id: combos[0].std_id, div_id: combos[0].div_id };
        await api.put(`/api/faculty-assignments/${form.fa_id}`, payload);
        toast.success("Updated");
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
        if (failed === 0) toast.success(`${success} assignment(s) saved`);
        else toast.warning(`${success} saved, ${failed} failed`);
      }

      setModalOpen(false);
      loadAssignments(1, pageSize);
    } catch (err) {
      console.error("save assignment", err);
      if (err?.status === 403) toast.warning("Restricted by RLS.");
      else toast.error(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // ------- Delete -------
  async function handleDelete(id) {
    if (!window.confirm("Delete this assignment?")) return;
    try {
      await api.delete(`/api/faculty-assignments/${id}`);
      toast.success("Deleted");
      loadAssignments(page, pageSize);
    } catch (err) {
      console.error("delete", err);
      toast.error(err?.message || "Delete failed");
    }
  }

  // ------- Import / Bulk ----------
  async function handleFileImport(f) {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await api.post("/api/faculty-assignments/import-csv", { csv: String(reader.result || "") });
        toast.success("Import done");
        loadAssignments(1, pageSize);
      } catch (err) {
        toast.error(err?.message || "Import failed");
      }
    };
    reader.readAsText(f);
    if (importFileRef.current) importFileRef.current.value = "";
  }

  async function handleImportSubmit(e) {
    e?.preventDefault?.();
    if (!importCsvText?.trim()) { toast.error("Paste CSV content"); return; }
    try {
      await api.post("/api/faculty-assignments/import-csv", { csv: importCsvText });
      toast.success("Import done");
      setImportOpen(false);
      setImportCsvText("");
      loadAssignments(1, pageSize);
    } catch (err) {
      toast.error(err?.message || "Import failed");
    }
  }

  async function handleBulkSubmit(e) {
    e?.preventDefault?.();
    if (!bulkJsonText?.trim()) { toast.error("Provide JSON array"); return; }
    let data;
    try { data = JSON.parse(bulkJsonText); }
    catch { toast.error("Invalid JSON"); return; }
    if (!Array.isArray(data)) { toast.error("JSON must be an array"); return; }

    try {
      const url = bulkMode === "insert"
        ? "/api/faculty-assignments/bulk-insert"
        : "/api/faculty-assignments/bulk-upsert";
      await api.post(url, data);
      toast.success("Bulk operation successful");
      setBulkOpen(false);
      setBulkJsonText("");
      loadAssignments(1, pageSize);
    } catch (err) {
      toast.error(err?.message || "Bulk operation failed");
    }
  }

  // ------- Pagination ----------
  const totalPages = Math.max(1, Math.ceil((total || 0) / (pageSize || DEFAULT_PAGE_SIZE)));
  function goPrev() { if (page > 1) setPage(p => p - 1); }
  function goNext() { if (page < totalPages) setPage(p => p + 1); }

  // ------- Render ----------
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-3 sm:p-5 lg:p-6 transition-colors">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 sm:mb-6"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                Faculty Assignments
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                View faculty cards with assigned schools, standards & divisions
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href="/api/faculty-assignments/export/csv"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition text-slate-700 dark:text-slate-200"
              >
                Export CSV
              </a>

              <label className="cursor-pointer">
                <OutlineBtn
                  onClick={() => importFileRef.current?.click()}
                  leftIcon={ERPIcons.Upload}
                >
                  Import CSV
                </OutlineBtn>
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => handleFileImport(e.target.files?.[0])}
                />
              </label>

              <OutlineBtn
                onClick={() => { setBulkMode("insert"); setBulkOpen(true); }}
              >
                Bulk Insert
              </OutlineBtn>
              <OutlineBtn
                onClick={() => { setBulkMode("upsert"); setBulkOpen(true); }}
              >
                Bulk Upsert
              </OutlineBtn>

              <PrimaryBtn
                size="sm"
                onClick={() => openForm("new")}
                leftIcon={ERPIcons.Plus}
              >
                New Assignment
              </PrimaryBtn>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 sm:p-5 mb-4 sm:mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="lg:col-span-3">
              <FormField label="Search">
                <TextInput
                  placeholder="Search employee / notes"
                  value={search}
                  onChange={(v) => { setSearch(v); setPage(1); loadAssignments(1, pageSize); }}
                />
              </FormField>
            </div>
            <FormField label="School">
              <Select
                value={schoolId}
                onChange={(v) => { setSchoolId(v); setPage(1); loadAssignments(1, pageSize); }}
                options={[
                  { value: "", label: "All Schools" },
                  ...schools.map(s => ({ value: s.school_id, label: s.school_name })),
                ]}
              />
            </FormField>
            <FormField label="Medium">
              <Select
                value={mediumId}
                onChange={(v) => { setMediumId(v); setPage(1); loadAssignments(1, pageSize); }}
                options={[
                  { value: "", label: "All Mediums" },
                  ...mediums.map(m => ({ value: m.medium_id, label: m.medium_name })),
                ]}
              />
            </FormField>
            <FormField label="Standard">
              <Select
                value={stdId}
                onChange={(v) => { setStdId(v); setPage(1); loadAssignments(1, pageSize); }}
                options={[
                  { value: "", label: "All Standards" },
                  ...standards.map(s => ({ value: s.std_id, label: s.std_name })),
                ]}
              />
            </FormField>
            <FormField label="Page Size">
              <Select
                value={pageSize}
                onChange={(v) => { setPageSize(Number(v)); setPage(1); loadAssignments(1, Number(v)); }}
                options={[10, 20, 50].map(n => ({ value: n, label: String(n) }))}
              />
            </FormField>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <LoadingCard key={i} variant="detailed" lines={4} />
              ))
            : grouped.length === 0
            ? (
              <div className="col-span-full text-center py-12">
                <p className="text-slate-500 dark:text-slate-400">No assignments found</p>
              </div>
            )
            : grouped.map(card => (
                <motion.div
                  key={card.employee_id || card.employee_name}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col"
                >
                  {/* Card Header */}
                  <div className="flex items-center gap-4 p-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="h-14 w-14 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 flex-shrink-0 border border-slate-200 dark:border-slate-600">
                      <img
                        src={card.image || DEFAULT_PHOTO}
                        alt={card.employee_name}
                        className="h-full w-full object-cover"
                        onError={(e) => (e.currentTarget.src = DEFAULT_PHOTO)}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-white truncate">
                        {card.employee_name}
                      </div>
                      {card.username && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {card.username}
                        </div>
                      )}
                      <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                        {(card.assignments || []).length} assignment(s)
                      </div>
                    </div>
                  </div>

                  {/* Card Body – scrollable school groups */}
                  <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[420px]">
                    {schoolGroupsForCard(card.assignments || []).map(sg => (
                      <div
                        key={`${sg.school_id}_${sg.medium_name || ""}`}
                        className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/50"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <div className="font-medium text-slate-900 dark:text-white">
                            {sg.school_name || "—"}
                          </div>
                          {sg.medium_name && (
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              • {sg.medium_name}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {Object.values(
                            sg.rows.reduce((acc, r) => {
                              const key = `${r.std_name || "-"}|${r.division_name || "-"}`;
                              if (!acc[key]) acc[key] = { std: r.std_name, div: r.division_name, rows: [] };
                              acc[key].rows.push(r);
                              return acc;
                            }, {})
                          ).map(item => (
                            <div
                              key={`${item.std}_${item.div}`}
                              className="p-2 bg-white dark:bg-slate-700 rounded-lg border border-slate-100 dark:border-slate-600 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                  {item.std ? `Std ${item.std}` : "All"} {item.div ? `/ Div ${item.div}` : ""}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  {item.rows.map((r, i) => (
                                    <span key={i}>
                                      {fmtDate(r.start_date)} – {r.end_date ? fmtDate(r.end_date) : "Ongoing"}
                                      {r.notes && <span className="ml-2 opacity-75">📝</span>}
                                      {i < item.rows.length - 1 ? " • " : ""}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <IconBtn
                                  icon={ERPIcons.Eye}
                                  size="xs"
                                  title="View"
                                  onClick={() => openForm("view", item.rows[0])}
                                />
                                <IconBtn
                                  icon={ERPIcons.Edit}
                                  size="xs"
                                  title="Edit"
                                  onClick={() => openForm("edit", item.rows[0])}
                                />
                                {item.rows[0]?.fa_id && (
                                  <IconBtn
                                    icon={ERPIcons.Delete}
                                    size="xs"
                                    title="Delete"
                                    className="hover:text-rose-600 dark:hover:text-rose-400"
                                    onClick={() => handleDelete(item.rows[0].fa_id)}
                                  />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Card Footer */}
                  <div className="p-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 flex justify-between">
                    <span>{card.assignments?.some(a => a.notes) ? "Notes available" : "No notes"}</span>
                    <span className={card.assignments?.some(a => a.end_date && new Date(a.end_date) < new Date()) ? "text-rose-500" : "text-emerald-500"}>
                      {card.assignments?.some(a => a.end_date && new Date(a.end_date) < new Date()) ? "Some ended" : "Active"}
                    </span>
                  </div>
                </motion.div>
              ))}
        </div>

        {/* Pagination */}
        {!loading && grouped.length > 0 && (
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Page {page} of {totalPages} — {total} result(s)
            </div>
            <div className="flex items-center gap-2">
              <OutlineBtn size="sm" onClick={goPrev} disabled={page <= 1}>Prev</OutlineBtn>
              <OutlineBtn size="sm" onClick={goNext} disabled={page >= totalPages}>Next</OutlineBtn>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Create/Edit/View */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="relative w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-3xl bg-white dark:bg-slate-800 rounded-none sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              {/* Modal header */}
              <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
                <img
                  src={MODAL_HEADER_LOGO}
                  alt="Logo"
                  className="h-10 sm:h-12 w-auto rounded"
                />
                <div className="flex-1">
                  <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white">
                    {viewOnly ? "View Assignment" : form.fa_id ? "Edit Assignment" : "New Assignment"}
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Link faculty to school / medium / standard / division
                  </p>
                </div>
                <IconBtn
                  icon={ERPIcons.Close}
                  onClick={() => setModalOpen(false)}
                />
              </div>

              {/* Scrollable form */}
              <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Employee *" required>
                    <Select
                      disabled={viewOnly}
                      value={form.employee_id}
                      onChange={(v) => setForm(f => ({ ...f, employee_id: v }))}
                      options={[
                        { value: "", label: "Select Employee" },
                        ...employees.map(e => ({ value: e.employee_id, label: e.full_name || e.employee_name || e.username })),
                      ]}
                    />
                  </FormField>
                  <FormField label="School *" required>
                    <Select
                      disabled={viewOnly}
                      value={form.school_id}
                      onChange={(v) => setForm(f => ({ ...f, school_id: v }))}
                      options={[
                        { value: "", label: "Select School" },
                        ...schools.map(s => ({ value: s.school_id, label: s.school_name })),
                      ]}
                    />
                  </FormField>
                  <FormField label="Medium">
                    <Select
                      disabled={viewOnly}
                      value={form.medium_id}
                      onChange={(v) => setForm(f => ({ ...f, medium_id: v }))}
                      options={[
                        { value: "", label: "None" },
                        ...mediums.map(m => ({ value: m.medium_id, label: m.medium_name })),
                      ]}
                    />
                  </FormField>

                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Standards (multi-select)
                      </label>
                      <label className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <input
                          type="checkbox"
                          disabled={viewOnly}
                          checked={Array.isArray(form.std_ids) && standards.length > 0 && form.std_ids.length === standards.length}
                          onChange={(e) => toggleAllStandards(e.target.checked)}
                          className="rounded"
                        />
                        Select all
                      </label>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-32 overflow-y-auto border border-slate-200 dark:border-slate-600 rounded-lg p-2 bg-white dark:bg-slate-700">
                      {standards.map(s => (
                        <label key={s.std_id} className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            disabled={viewOnly}
                            checked={Array.isArray(form.std_ids) && form.std_ids.some(x => String(x) === String(s.std_id))}
                            onChange={() => setForm(f => ({ ...f, std_ids: toggleSelection(f.std_ids, s.std_id) }))}
                            className="rounded"
                          />
                          {s.std_name}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Divisions (multi-select)
                      </label>
                      <label className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <input
                          type="checkbox"
                          disabled={viewOnly}
                          checked={Array.isArray(form.div_ids) && divisions.length > 0 && form.div_ids.length === divisions.length}
                          onChange={(e) => toggleAllDivisions(e.target.checked)}
                          className="rounded"
                        />
                        Select all
                      </label>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-32 overflow-y-auto border border-slate-200 dark:border-slate-600 rounded-lg p-2 bg-white dark:bg-slate-700">
                      {divisions.map(d => (
                        <label key={d.div_id} className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            disabled={viewOnly}
                            checked={Array.isArray(form.div_ids) && form.div_ids.some(x => String(x) === String(d.div_id))}
                            onChange={() => setForm(f => ({ ...f, div_ids: toggleSelection(f.div_ids, d.div_id) }))}
                            className="rounded"
                          />
                          {d.division_name}
                        </label>
                      ))}
                    </div>
                  </div>

                  <FormField label="Start Date *" required>
                    <DateInput
                      disabled={viewOnly}
                      value={form.start_date}
                      onChange={(v) => setForm(f => ({ ...f, start_date: v }))}
                    />
                  </FormField>
                  <FormField label="End Date">
                    <DateInput
                      disabled={viewOnly}
                      value={form.end_date}
                      onChange={(v) => setForm(f => ({ ...f, end_date: v }))}
                    />
                  </FormField>

                  <div className="sm:col-span-2">
                    <FormField label="Notes">
                      <TextArea
                        disabled={viewOnly}
                        value={form.notes}
                        onChange={(v) => setForm(f => ({ ...f, notes: v }))}
                      />
                    </FormField>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <OutlineBtn onClick={() => setModalOpen(false)}>Cancel</OutlineBtn>
                  {!viewOnly && (
                    <PrimaryBtn type="submit" loading={saving}>
                      {form.fa_id ? "Update" : "Create"}
                    </PrimaryBtn>
                  )}
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Import CSV Modal */}
      <AnimatePresence>
        {importOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setImportOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-4 sm:p-6">
                <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">Import CSV</h2>
                <FormField label="Paste CSV content">
                  <TextArea
                    value={importCsvText}
                    onChange={setImportCsvText}
                    rows={8}
                  />
                </FormField>
                <div className="flex justify-end gap-3 mt-6">
                  <OutlineBtn onClick={() => setImportOpen(false)}>Cancel</OutlineBtn>
                  <PrimaryBtn onClick={handleImportSubmit}>Import</PrimaryBtn>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk JSON Modal */}
      <AnimatePresence>
        {bulkOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setBulkOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-4 sm:p-6">
                <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">
                  {bulkMode === "insert" ? "Bulk Insert" : "Bulk Upsert"} (JSON)
                </h2>
                <FormField label="JSON array">
                  <TextArea
                    value={bulkJsonText}
                    onChange={setBulkJsonText}
                    rows={8}
                  />
                </FormField>
                <div className="flex justify-end gap-3 mt-6">
                  <OutlineBtn onClick={() => setBulkOpen(false)}>Cancel</OutlineBtn>
                  <PrimaryBtn onClick={handleBulkSubmit}>Run</PrimaryBtn>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

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
    notes: "",
  };
}