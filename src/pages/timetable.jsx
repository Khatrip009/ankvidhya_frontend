// src/pages/timetables.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../lib/api";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import {
  PrimaryBtn,
  SecondaryBtn,
  OutlineBtn,
  IconBtn,
} from "../components/buttons.jsx";
import {
  FormField,
  TextInput,
  Select,
} from "../components/input.jsx";
import ERPIcons from "../components/icons.jsx";
import { useToast } from "../hooks/useToast.jsx";

// ---------- Constants ----------
const DEFAULT_PAGE_SIZE = 200;
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// ---------- Helpers ----------
function dayNameToNumber(name) {
  if (!name) return null;
  const m = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7 };
  return m[String(name).trim().toLowerCase()] || null;
}

function parseCSVText(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const parseRow = (line) => {
    const out = []; let cur = ''; let q=false;
    for (let i=0;i<line.length;i++){
      const ch=line[i];
      if (ch === '"'){ if(q && line[i+1]==='"'){cur+='"'; i++; continue;} q=!q; continue; }
      if (!q && ch === ','){ out.push(cur); cur=''; continue; }
      cur += ch;
    }
    out.push(cur);
    return out;
  };
  const headers = parseRow(lines[0]).map(h=>h.trim().toLowerCase());
  const rows = [];
  for (let i=1;i<lines.length;i++){
    const cols = parseRow(lines[i]);
    const obj = {};
    for (let j=0;j<headers.length;j++) obj[headers[j]] = (cols[j] ?? '').trim();
    rows.push(obj);
  }
  return rows;
}

// ---------- Main Component ----------
export default function TimetablesPage() {
  const toast = useToast();

  // Lookups
  const [schools, setSchools] = useState([]);
  const [mediums, setMediums] = useState([]);
  const [standards, setStandards] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [employees, setEmployees] = useState([]);

  // Filters
  const [filters, setFilters] = useState({
    search: "",
    school_id: "",
    medium_id: "",
    std_id: "",
    div_id: "",
    employee_id: "",
  });

  // Data
  const [groupedBySchool, setGroupedBySchool] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Inline editor
  const [editingCell, setEditingCell] = useState(null);
  const [editorValues, setEditorValues] = useState({ period_no: "", employee_id: "", remark: "" });
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);

  // Load lookups on mount
  useEffect(() => {
    (async () => {
      try {
        const [sRes, mRes, stRes, dRes, eRes] = await Promise.all([
          api.get("/api/schools/schools", { query: { pageSize: 500 } }),
          api.get("/api/master", { query: { table: "media", pageSize: 1000 } }),
          api.get("/api/master", { query: { table: "standards", pageSize: 1000 } }),
          api.get("/api/master", { query: { table: "divisions", pageSize: 1000 } }),
          api.get("/api/employees", { query: { pageSize: 500 } }),
        ]);
        setSchools(sRes?.data || []);
        setMediums(mRes?.data || []);
        setStandards(stRes?.data || []);
        setDivisions(dRes?.data || []);
        setEmployees(eRes?.data || []);
      } catch (err) {
        console.error("Lookup load failed", err);
        toast.error("Failed to load dropdown data");
      }
    })();
  }, []);

  // Fetch timetables
  const fetchTimetables = useCallback(async (pageNum = 1, ps = pageSize, filter = filters) => {
    setLoading(true);
    try {
      const query = {
        page: pageNum,
        pageSize: ps,
        search: filter.search || undefined,
        school_id: filter.school_id || undefined,
        medium_id: filter.medium_id || undefined,
        std_id: filter.std_id || undefined,
        div_id: filter.div_id || undefined,
        employee_id: filter.employee_id || undefined,
      };
      const res = await api.get("/api/timetables", { query });
      const rows = res?.data || [];
      const pagination = res?.pagination || { page: pageNum, pageSize: ps, total: rows.length };
      setTotal(pagination.total);
      setPage(pagination.page);
      setPageSize(pagination.pageSize);

      // Group by school
      const schoolMap = new Map();
      for (const r of rows) {
        const sid = r.school_id || `s_unknown_${r.school_name || "unknown"}`;
        const sname = r.school_name || "Unknown School";
        if (!schoolMap.has(sid)) {
          schoolMap.set(sid, { school_id: sid, school_name: sname, entries: [] });
        }
        schoolMap.get(sid).entries.push(r);
      }

      const grouped = [];
      for (const [sid, obj] of schoolMap.entries()) {
        const pivot = {};
        const rowKeysSet = new Set();
        for (const e of obj.entries) {
          const std = e.std_name || "All";
          const div = e.division_name || "";
          const rowKey = div ? `${std} / ${div}` : `${std}`;
          rowKeysSet.add(rowKey);
          const dayIndex = Number(e.day_of_week) || dayNameToNumber(e.day_of_week) || null;
          const di = dayIndex || 0;

          if (!pivot[rowKey]) pivot[rowKey] = {};
          if (!pivot[rowKey][di]) pivot[rowKey][di] = [];
          pivot[rowKey][di].push({
            timetable_id: e.timetable_id,
            period_no: e.period_no,
            employee_name: e.employee_name,
            employee_id: e.employee_id ?? null,
            medium_name: e.medium_name,
            remark: e.remark,
            std_name: e.std_name,
            division_name: e.division_name,
          });
        }

        // Sort per cell
        for (const rk of Object.keys(pivot)) {
          for (const k of Object.keys(pivot[rk])) {
            pivot[rk][k].sort((a,b) => (Number(a.period_no)||0) - (Number(b.period_no)||0));
          }
        }

        const schoolObj = schools.find(s => String(s.school_id) === String(sid));
        const logo = (schoolObj && (schoolObj.logo || schoolObj.school_logo || schoolObj.image)) || "/images/ANK.png";

        grouped.push({
          school_id: sid,
          school_name: obj.school_name,
          pivot,
          rowKeys: Array.from(rowKeysSet).sort((a,b) => a.localeCompare(b, undefined, { numeric: true })),
          logo,
        });
      }

      setGroupedBySchool(grouped);
    } catch (err) {
      console.error("Fetch timetables error", err);
      toast.error("Failed to load timetables");
    } finally {
      setLoading(false);
    }
  }, [filters, schools, pageSize, toast]);

  // Initial load
  useEffect(() => {
    fetchTimetables(1, pageSize, filters);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when filters change (except manual button)
  const applyFilters = () => fetchTimetables(1, pageSize, filters);

  // CRUD
  const createTimetable = async (payload) => {
    const res = await api.post('/api/timetables', payload);
    return res?.data || {};
  };
  const updateTimetable = async (id, payload) => {
    const res = await api.put(`/api/timetables/${id}`, payload);
    return res?.data || {};
  };

  // CSV export
  const handleExportCSV = async () => {
    try {
      const query = new URLSearchquery({
        search: filters.search || '',
        school_id: filters.school_id || '',
        medium_id: filters.medium_id || '',
        std_id: filters.std_id || '',
        div_id: filters.div_id || '',
        employee_id: filters.employee_id || '',
      });
      const url = "/api/timetables/export/csv?" + query.toString();
      const res = await fetch(url, { method: "GET", credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `timetables_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      toast.error("Export failed");
    }
  };

  // CSV import
  const handleImportFile = async (file) => {
    if (!file) return;
    try {
      const txt = await file.text();
      const parsed = parseCSVText(txt);
      if (!parsed.length) { toast.warning("No rows found"); return; }
      const ok = window.confirm(`Import ${parsed.length} rows?`);
      if (!ok) return;
      await api.post("/api/timetables/import/csv", { csv: txt });
      toast.success("Import completed");
      fetchTimetables(1, pageSize, filters);
    } catch (err) {
      toast.error(err?.message || "Import failed");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // PDF export helpers (simplified, rely on Tailwind classes)
  const exportAllCardsPdf = async () => {
    try {
      const nodes = document.querySelectorAll("[data-export-school]");
      if (!nodes.length) { toast.warning("No cards to export"); return; }
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const schoolId = node.getAttribute("data-export-school");
        const schoolName = node.getAttribute("data-export-school-name") || `School ${schoolId}`;
        await exportCardToPdf(node, schoolName, pdf, i);
      }
      pdf.save(`timetables_schools_${new Date().toISOString().slice(0,10)}.pdf`);
      toast.success("PDF exported");
    } catch (err) {
      toast.error("PDF export failed");
    }
  };

  const exportCardPdfBySchoolId = async (schoolId) => {
    const node = document.querySelector(`[data-export-school="${String(schoolId)}"]`);
    if (!node) { toast.warning("Card not found"); return; }
    try {
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const schoolName = node.getAttribute("data-export-school-name") || `School ${schoolId}`;
      await exportCardToPdf(node, schoolName, pdf, 0);
      pdf.save(`timetable_${schoolName.replace(/\s+/g,'_')}.pdf`);
      toast.success("PDF exported");
    } catch (err) {
      toast.error("PDF export failed");
    }
  };

  const exportCardToPdf = async (node, schoolName, pdf, pageIndex) => {
    // Clone node, remove interactive elements
    const clone = node.cloneNode(true);
    clone.querySelectorAll("button, input, select, textarea, a, .no-print, .editor-panel").forEach(el => el.remove());

    // Set background white and width for rendering
    clone.style.width = "1400px";
    clone.style.background = "#ffffff";
    clone.style.padding = "16px";
    clone.style.boxSizing = "border-box";
    clone.style.position = "absolute";
    clone.style.left = "-9999px";
    clone.style.top = "0";
    document.body.appendChild(clone);

    // Wait for images to load
    await new Promise(r => setTimeout(r, 200));

    const canvas = await html2canvas(clone, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });
    document.body.removeChild(clone);

    const imgData = canvas.toDataURL("image/png", 1.0);
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const renderW = pageWidth - margin * 2;
    const imgProps = pdf.getImageProperties(imgData);
    const ratio = imgProps.height / imgProps.width;
    const renderH = renderW * ratio;

    if (pageIndex > 0) pdf.addPage();

    // Add header (school name) as text to make it selectable
    pdf.setFontSize(14);
    pdf.setTextColor(30, 41, 59); // dark slate
    pdf.text(schoolName, margin, margin + 6);
    pdf.setFontSize(10);
    pdf.setTextColor(100, 116, 139); // muted
    pdf.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin - 40, margin + 6, { align: "right" });

    pdf.addImage(imgData, "PNG", margin, margin + 10, renderW, renderH);
    pdf.setFontSize(9);
    pdf.text(`Page ${pageIndex + 1}`, pageWidth / 2, pageHeight - 6, { align: "center" });
  };

  // ---------- Inline Editor ----------
  const openEditor = (school_id, rowKey, dayIndex, existingEntry = null) => {
    setEditingCell({ school_id, rowKey, dayIndex, existingEntry });
    setEditorValues({
      period_no: existingEntry?.period_no ?? "",
      employee_id: existingEntry?.employee_id ?? "",
      remark: existingEntry?.remark ?? "",
    });
    setTimeout(() => {
      editorRef.current?.querySelector('input[name="period_no"]')?.focus();
    }, 50);
  };

  const closeEditor = () => {
    setEditingCell(null);
  };

  const saveEditor = async () => {
    if (!editingCell) return;
    const { school_id, rowKey, dayIndex, existingEntry } = editingCell;
    let std_name = null, division_name = null;
    if (rowKey.includes('/')) {
      const [s, d] = rowKey.split('/').map(x => x.trim());
      std_name = s; division_name = d;
    } else {
      std_name = rowKey;
    }
    const schoolObj = schools.find(s => String(s.school_id) === String(school_id));
    const school_name = schoolObj?.school_name || "";
    const employee = employees.find(e => String(e.employee_id) === String(editorValues.employee_id));
    const employee_name = employee?.full_name || editorValues.employee_id;

    const payload = {
      school_name,
      medium_name: null,
      std_name: std_name || null,
      division_name: division_name || null,
      employee_name,
      day_of_week: Number(dayIndex) || null,
      period_no: editorValues.period_no === "" ? null : Number(editorValues.period_no),
      remark: editorValues.remark?.trim() || null,
    };

    try {
      if (existingEntry?.timetable_id) {
        await updateTimetable(existingEntry.timetable_id, payload);
        toast.success("Updated");
      } else {
        await createTimetable(payload);
        toast.success("Created");
      }
      closeEditor();
      fetchTimetables(page, pageSize, filters);
    } catch (err) {
      toast.error(err?.message || "Save failed");
    }
  };

  // Cell rendering
  const renderCell = (entries, school_id, rowKey, dayIndex) => {
    const isEditing = editingCell && editingCell.school_id === school_id && editingCell.rowKey === rowKey && editingCell.dayIndex === dayIndex;
    if (isEditing) {
      return (
        <div ref={editorRef} className="p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex flex-col gap-2">
            <div className="flex gap-2 items-center">
              <input
                name="period_no"
                type="number"
                min="1"
                className="w-16 px-2 py-1 text-sm border rounded dark:bg-slate-700 dark:border-slate-600"
                placeholder="Period"
                value={editorValues.period_no ?? ""}
                onChange={(e) => setEditorValues(v => ({ ...v, period_no: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") saveEditor(); if (e.key === "Escape") closeEditor(); }}
              />
              <select
                className="flex-1 px-2 py-1 text-sm border rounded dark:bg-slate-700 dark:border-slate-600"
                value={editorValues.employee_id ?? ""}
                onChange={(e) => setEditorValues(v => ({ ...v, employee_id: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") saveEditor(); if (e.key === "Escape") closeEditor(); }}
              >
                <option value="">— faculty —</option>
                {employees.map(emp => <option key={emp.employee_id} value={emp.employee_id}>{emp.full_name}</option>)}
              </select>
            </div>
            <input
              type="text"
              className="px-2 py-1 text-sm border rounded dark:bg-slate-700 dark:border-slate-600"
              placeholder="Remark"
              value={editorValues.remark ?? ""}
              onChange={(e) => setEditorValues(v => ({ ...v, remark: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") saveEditor(); if (e.key === "Escape") closeEditor(); }}
            />
            <div className="flex gap-2 justify-end">
              <OutlineBtn size="sm" onClick={closeEditor}>Cancel</OutlineBtn>
              <PrimaryBtn size="sm" onClick={saveEditor}>Save</PrimaryBtn>
            </div>
          </div>
        </div>
      );
    }

    if (!entries || entries.length === 0) {
      return (
        <button
          className="w-full h-full min-h-[40px] flex items-center justify-center text-xs text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
          onClick={() => openEditor(school_id, rowKey, dayIndex, null)}
        >
          —
        </button>
      );
    }

    return (
      <div className="space-y-1">
        {entries.map((entry, idx) => (
          <div key={idx} className="flex items-center justify-between p-1 rounded bg-slate-50 dark:bg-slate-700/50 text-sm">
            <div>
              <span className="font-semibold">P{entry.period_no ?? "—"}</span>
              {entry.employee_name && <span className="ml-1 text-xs text-slate-600 dark:text-slate-300">• {entry.employee_name}</span>}
              {entry.remark && <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{entry.remark}</div>}
            </div>
            <IconBtn icon={ERPIcons.Edit} size="xs" onClick={() => openEditor(school_id, rowKey, dayIndex, entry)} />
          </div>
        ))}
      </div>
    );
  };

  // Skeleton loading
  const Skeleton = () => (
    <div className="grid grid-cols-1 gap-4">
      {[1,2,3].map(i => (
        <div key={i} className="bg-white dark:bg-slate-800 border rounded-2xl p-4 animate-pulse">
          <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-3"></div>
          <div className="h-40 bg-slate-100 dark:bg-slate-700 rounded"></div>
        </div>
      ))}
    </div>
  );

  // School card
  const SchoolCard = ({ school }) => {
    const { school_id, school_name, pivot, rowKeys, logo } = school;
    return (
      <div
        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-x-auto"
        data-export-school={school_id}
        data-export-school-name={school_name}
      >
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img src={logo} alt={school_name} className="h-10 w-10 rounded-lg object-contain bg-white border" onError={(e) => e.currentTarget.src = "/images/ANK.png"} />
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{school_name}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{rowKeys.length} class row(s)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <OutlineBtn size="sm" onClick={() => handleExportCSV()}>Export CSV</OutlineBtn>
            <OutlineBtn size="sm" onClick={() => exportCardPdfBySchoolId(school_id)}>Export PDF</OutlineBtn>
          </div>
        </div>

        <div className="p-4 overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-[200px_repeat(7,1fr)] gap-2">
              <div className="px-2 py-2 font-medium text-sm bg-slate-100 dark:bg-slate-700 rounded-l-lg">Std / Div</div>
              {DAYS.map((day, idx) => (
                <div key={day} className="px-2 py-2 text-center font-medium text-sm bg-slate-100 dark:bg-slate-700">{day}</div>
              ))}
            </div>
            {rowKeys.length === 0 ? (
              <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">No class rows</div>
            ) : (
              rowKeys.map(rk => (
                <div key={rk} className="grid grid-cols-[200px_repeat(7,1fr)] gap-2 mt-2">
                  <div className="px-2 py-2 font-medium text-sm border-l border-t border-b rounded-l-md">{rk}</div>
                  {Array.from({ length: 7 }, (_, diIdx) => {
                    const di = diIdx + 1;
                    const cell = pivot[rk]?.[di] || [];
                    return (
                      <div key={di} className="px-2 py-2 border rounded-md min-h-[48px]">
                        {renderCell(cell, school_id, rk, di)}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-3 sm:p-5 lg:p-6 transition-colors">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4 sm:mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">School Timetables</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Pivot cards — click any box to assign a period</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <OutlineBtn onClick={handleExportCSV}>Export CSV</OutlineBtn>
              <label className="cursor-pointer">
                <OutlineBtn onClick={() => fileInputRef.current?.click()}>Import CSV</OutlineBtn>
                <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => handleImportFile(e.target.files?.[0])} />
              </label>
              <PrimaryBtn onClick={applyFilters}>Refresh</PrimaryBtn>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 sm:p-5 shadow-sm mb-4 sm:mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="sm:col-span-2 lg:col-span-3">
              <FormField label="Search">
                <TextInput
                  placeholder="School, medium, std, employee..."
                  value={filters.search}
                  onChange={(v) => setFilters(prev => ({ ...prev, search: v }))}
                />
              </FormField>
            </div>
            <FormField label="School">
              <Select
                value={filters.school_id}
                onChange={(v) => setFilters(prev => ({ ...prev, school_id: v }))}
                options={[{ value: "", label: "All" }, ...schools.map(s => ({ value: s.school_id, label: s.school_name }))]}
              />
            </FormField>
            <FormField label="Medium">
              <Select
                value={filters.medium_id}
                onChange={(v) => setFilters(prev => ({ ...prev, medium_id: v }))}
                options={[{ value: "", label: "All" }, ...mediums.map(m => ({ value: m.medium_id, label: m.medium_name }))]}
              />
            </FormField>
            <FormField label="Std">
              <Select
                value={filters.std_id}
                onChange={(v) => setFilters(prev => ({ ...prev, std_id: v }))}
                options={[{ value: "", label: "All" }, ...standards.map(s => ({ value: s.std_id, label: s.std_name }))]}
              />
            </FormField>
            <div className="flex items-end gap-2">
              <PrimaryBtn size="sm" onClick={applyFilters}>Apply</PrimaryBtn>
              <OutlineBtn size="sm" onClick={() => {
                setFilters({ search: "", school_id: "", medium_id: "", std_id: "", div_id: "", employee_id: "" });
                fetchTimetables(1, pageSize, { search: "", school_id: "", medium_id: "", std_id: "", div_id: "", employee_id: "" });
              }}>Clear</OutlineBtn>
            </div>
          </div>
        </div>

        {/* Cards */}
        {loading ? (
          <Skeleton />
        ) : groupedBySchool.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 border rounded-2xl p-8 text-center text-slate-500 dark:text-slate-400">
            No timetable cards found
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:gap-6">
            {groupedBySchool.map(school => (
              <SchoolCard key={school.school_id} school={school} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && groupedBySchool.length > 0 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-slate-500 dark:text-slate-400">Showing page {page} — {total} result(s)</div>
            <div className="flex gap-2">
              <OutlineBtn size="sm" disabled={page <= 1} onClick={() => fetchTimetables(page - 1, pageSize, filters)}>Prev</OutlineBtn>
              <OutlineBtn size="sm" onClick={() => fetchTimetables(page + 1, pageSize, filters)}>Next</OutlineBtn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}