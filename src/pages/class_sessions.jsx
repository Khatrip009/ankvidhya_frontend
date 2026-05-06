// src/pages/class_sessions.jsx
import React, { useEffect, useState, useRef } from "react";
import api from "../lib/api";

import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import dayGridPlugin from "@fullcalendar/daygrid";

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

import { PrimaryBtn, SecondaryBtn, OutlineBtn } from "../components/buttons.jsx";
import { FormField, TextInput, Select, DateInput } from "../components/input.jsx";
import { useToast } from "../hooks/useToast.jsx";

/* ------------- CONFIG ------------- */
const PRESET_PERIOD_TIMES = {
  1: ["07:35:00", "08:10:00"],
  2: ["08:15:00", "08:50:00"],
  3: ["09:00:00", "09:35:00"],
  4: ["09:45:00", "10:20:00"],
  5: ["10:30:00", "11:05:00"],
  6: ["11:15:00", "11:50:00"],
  7: ["12:30:00", "13:05:00"],
  8: ["13:15:00", "13:50:00"],
};

const TRY_BULK_ENDPOINT_FIRST = true;
const toISODate = (d = new Date()) =>
  d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);

/* ------------- UTIL ------------- */
function pastelColorFromKey(key) {
  const s = String(key || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  const sat = 55 + (h % 20);
  const light = 75;
  return `hsl(${h} ${sat}% ${light}%)`;  // FIXED: ${h} not ${hue: h}
}

function sessionToEvent(s) {
  const date = String(s.session_date || "").slice(0, 10);
  const start = `${date}T${(s.start_time || "00:00:00").slice(0, 8)}`;
  const end = `${date}T${(s.end_time || "00:00:00").slice(0, 8)}`;
  const titleParts = [];
  if (s.std_name) titleParts.push(`Std ${s.std_name}`);
  if (s.division_name) titleParts.push(`/ ${s.division_name}`);
  if (s.employee_name) titleParts.push(`• ${s.employee_name}`);
  const title = titleParts.join(" ");
  return { id: s.cs_id, title: title || (s.school_name || "Session"), start, end, extendedProps: s };
}

/* ------------- COMPONENT ------------- */
export default function ClassSessionsPage() {
  const toast = useToast();

  // Lookups
  const [schools, setSchools] = useState([]);
  const [standards, setStandards] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [employees, setEmployees] = useState([]);

  // Filters
  const [date, setDate] = useState(toISODate());
  const [timetableId, setTimetableId] = useState("");
  const [periodNo, setPeriodNo] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [stdId, setStdId] = useState("");
  const [divId, setDivId] = useState("");
  const [employeeId, setEmployeeId] = useState("");

  // UI state
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("both"); // both|pivot|calendar
  const [compactMode, setCompactMode] = useState(true);
  const [colorBy, setColorBy] = useState("school");
  const [columns, setColumns] = useState([]);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [editValues, setEditValues] = useState({ employee_id: "", remark: "", start_time: "", end_time: "" });

  // Refs
  const calendarRef = useRef(null);
  const pivotRef = useRef(null);

  // Load lookups
  useEffect(() => {
    (async () => {
      try {
        const [sList, stList, dList, eList] = await Promise.all([
          api.get("/api/schools/schools", { params: { pageSize: 500 } }).then(r => r?.data || []),
          api.get("/api/master", { params: { table: "standards", pageSize: 500 } }).then(r => r?.data || []),
          api.get("/api/master", { params: { table: "divisions", pageSize: 500 } }).then(r => r?.data || []),
          api.get("/api/employees", { params: { pageSize: 500 } }).then(r => r?.data || []),
        ]);
        setSchools(sList);
        setStandards(stList);
        setDivisions(dList);
        setEmployees(eList);
      } catch (err) {
        console.error("lookup load failed", err);
        toast.error("Failed to load dropdown data");
      }
    })();
  }, []);

  // Compute pivot columns
  useEffect(() => {
    const cols = new Set();
    for (const s of sessions) {
      if (s.period_no) cols.add(`P${s.period_no}`);
      else if (s.start_time && s.end_time) cols.add(`${s.start_time.slice(0, 5)}-${s.end_time.slice(0, 5)}`);
      else cols.add("Unk");
    }
    const arr = Array.from(cols).sort((a, b) => {
      const ma = a.match(/^P(\d+)$/);
      const mb = b.match(/^P(\d+)$/);
      if (ma && mb) return Number(ma[1]) - Number(mb[1]);
      if (ma && !mb) return -1;
      if (!ma && mb) return 1;
      return a.localeCompare(b, undefined, { numeric: true });
    });
    setColumns(arr);
  }, [sessions]);

  // Fetch sessions
  async function fetchSessions(params = {}) {
    setLoading(true);
    try {
      const { data } = await api.get("/api/class-sessions", { params });
      const rows = (data || []).map(s => ({
        ...s,
        session_date: s.session_date ? String(s.session_date).slice(0, 10) : null,
      }));
      setSessions(rows);
    } catch (err) {
      console.error("fetch sessions", err);
      toast.error("Failed to fetch sessions");
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }

  // Initial load
  useEffect(() => {
    fetchSessions({ session_date: date, pageSize: 1000 });
  }, []);

  /* ----------------- CRUD ----------------- */
  async function bulkCreateSessions(list) {
    if (!list?.length) return { created: 0 };
    if (TRY_BULK_ENDPOINT_FIRST) {
      try {
        const res = await api.post("/api/class-sessions/bulk", { sessions: list });
        return { created: res?.data?.created_count ?? list.length };
      } catch (err) {
        console.warn("Bulk create failed", err);
      }
    }
    let created = 0;
    for (const s of list) {
      try {
        await api.post("/api/class-sessions", s);
        created++;
      } catch (err) {
        console.error("create session", err, s);
      }
    }
    return { created };
  }

  async function createFromTimetableAPI(payload) {
    return api.post("/api/class-sessions/from-timetable", payload);
  }

  async function updateSession(cs_id, payload) {
    try {
      await api.put(`/api/class-sessions/${cs_id}`, payload);
      toast.success("Session updated");
      await fetchSessions({ session_date: date, pageSize: 1000 });
    } catch (err) {
      console.error("update session", err);
      toast.error("Failed to update session");
      throw err;
    }
  }

  async function deleteSession(cs_id) {
    if (!confirm("Delete this session?")) return;
    try {
      await api.delete(`/api/class-sessions/${cs_id}`);
      toast.success("Session deleted");
      await fetchSessions({ session_date: date, pageSize: 1000 });
    } catch (err) {
      console.error("delete session", err);
      toast.error("Failed to delete session");
    }
  }

  /* ------------- Weekday auto‑create ------------- */
  async function fetchTimetableEntriesForWeekday({ weekday, school_id, std_id, div_id, employee_id }) {
    const params = { pageSize: 2000, day_of_week: weekday };
    if (school_id) params.school_id = school_id;
    if (std_id) params.std_id = std_id;
    if (div_id) params.div_id = div_id;
    if (employee_id) params.employee_id = employee_id;
    try {
      const res = await api.get("/api/timetables", { params });
      return res?.data || [];
    } catch (err) {
      console.error("fetch timetable entries", err);
      return [];
    }
  }

  async function createSessionsFromTimetableByWeekday({ targetDate, school_id, std_id, div_id, employee_id, usePresetTimes = true }) {
    if (!targetDate) {
      toast.warning("Pick a date");
      return;
    }
    const weekdayJs = new Date(targetDate).getDay();
    const dow = weekdayJs === 0 ? 7 : weekdayJs;
    const entries = await fetchTimetableEntriesForWeekday({ weekday: dow, school_id, std_id, div_id, employee_id });
    if (!entries.length) {
      toast.warning("No timetable entries for that weekday");
      return { created: 0 };
    }

    const sessionsToCreate = entries.map(t => {
      const period = Number(t.period_no) || null;
      const [start_time, end_time] =
        usePresetTimes && period && PRESET_PERIOD_TIMES[period]
          ? PRESET_PERIOD_TIMES[period]
          : [t.start_time || null, t.end_time || null];
      return {
        school_id: Number(t.school_id) || null,
        school_name: t.school_name || null,
        medium_id: t.medium_id || null,
        std_id: t.std_id || null,
        std_name: t.std_name || null,
        div_id: t.div_id || null,
        division_name: t.division_name || null,
        employee_id: t.employee_id || null,
        employee_name: t.employee_name || null,
        timetable_id: t.timetable_id || null,
        period_no: period,
        start_time,
        end_time,
        session_date: targetDate,
        remark: t.remark || null,
      };
    });

    const res = await bulkCreateSessions(sessionsToCreate);
    await fetchSessions({ session_date: date, pageSize: 1000 });
    toast.success(`${res.created || 0} sessions created`);
    return res;
  }

  /* ------------- Edit modal handlers ------------- */
  function openEditModal(session) {
    setEditingSession(session);
    setEditValues({
      employee_id: session.employee_id ?? "",
      remark: session.remark ?? "",
      start_time: session.start_time ?? "",
      end_time: session.end_time ?? ""
    });
    setEditOpen(true);
  }

  async function saveEditModal() {
    if (!editingSession) return;
    const payload = {
      employee_id: editValues.employee_id || null,
      remark: editValues.remark || null,
      start_time: editValues.start_time || null,
      end_time: editValues.end_time || null,
    };
    try {
      await updateSession(editingSession.cs_id, payload);
      setEditOpen(false);
    } catch (err) {}
  }

  /* ------------- Pivot helpers ------------- */
  function buildPivot(rows) {
    const pivot = {};
    const rowKeysSet = new Set();
    for (const s of rows) {
      const std = s.std_name || s.std_id || "All";
      const div = s.division_name || s.div_id || "";
      const rowKey = div ? `${std} / ${div}` : `${std}`;
      rowKeysSet.add(rowKey);

      let colKey = "Unk";
      if (s.period_no) colKey = `P${s.period_no}`;
      else if (s.start_time && s.end_time) colKey = `${s.start_time.slice(0, 5)}-${s.end_time.slice(0, 5)}`;

      if (!pivot[rowKey]) pivot[rowKey] = {};
      if (!pivot[rowKey][colKey]) pivot[rowKey][colKey] = [];
      pivot[rowKey][colKey].push(s);
    }
    const rowKeys = Array.from(rowKeysSet).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );
    return { pivot, rowKeys };
  }

  function openAttendanceForSession(s) {
    const pref = {
      school_class_id: `${s.school_id || ""}:${s.medium_id || ""}:${s.std_id || ""}:${s.div_id || ""}`,
      date: s.session_date ? String(s.session_date).slice(0, 10) : "",
    };
    sessionStorage.setItem("sa_prefill", JSON.stringify(pref));
    location.hash = "#/student-attendance";
  }

  // Session card (compact)
  function renderSessionCard(s) {
    const keyForColor = colorBy === "school" ? s.school_id : s.employee_id;
    const bg = pastelColorFromKey(keyForColor);
    return (
      <div
        key={s.cs_id || `${s.school_id}-${s.std_id}-${s.div_id}-${s.session_date}-${s.period_no}`}
        className={`rounded-lg border border-slate-200 dark:border-slate-700 p-2 sm:p-3 ${compactMode ? "p-1.5 sm:p-2" : ""}`}
        style={{ background: bg }}
      >
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">
              {s.period_no ? `P${s.period_no}` : (s.start_time && s.end_time ? `${s.start_time.slice(0,5)}-${s.end_time.slice(0,5)}` : "Session")}
              <span className="ml-2 font-medium text-slate-800 dark:text-slate-200 opacity-80">{s.employee_name || s.school_name}</span>
            </p>
            {s.remark && <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{s.remark}</p>}
          </div>
          <div className="flex flex-col gap-1 items-end flex-shrink-0">
            <button
              onClick={() => openAttendanceForSession(s)}
              className="px-2 py-1 text-xs rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Attendance
            </button>
            <div className="flex gap-1">
              <button
                onClick={() => openEditModal(s)}
                className="px-2 py-1 text-xs rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Edit
              </button>
              <button
                onClick={() => deleteSession(s.cs_id)}
                className="px-2 py-1 text-xs rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ------------- Export pivot PDF ------------- */
  async function exportPivotToPdf() {
    if (!pivotRef.current) {
      toast.warning("Nothing to export");
      return;
    }
    try {
      const node = pivotRef.current;
      const clone = node.cloneNode(true);
      clone.style.width = "1200px";
      clone.style.background = "#ffffff";
      clone.style.padding = "18px";

      const header = document.createElement("div");
      header.innerHTML = `<div style="font-weight:700;font-size:18px">Class Sessions – Pivot</div><div style="font-size:12px;color:#374151">Generated: ${new Date().toLocaleString()}</div>`;
      clone.insertBefore(header, clone.firstChild);
      document.body.appendChild(clone);
      await new Promise(res => setTimeout(res, 80));

      const canvas = await html2canvas(clone, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });
      document.body.removeChild(clone);

      const img = canvas.toDataURL("image/png", 1.0);
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const props = pdf.getImageProperties(img);
      const ratio = props.height / props.width;
      const renderW = pageWidth - 20;
      const renderH = renderW * ratio;
      pdf.addImage(img, "PNG", 10, 10, renderW, renderH);
      pdf.setFontSize(9);
      pdf.setTextColor(100);
      pdf.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 10, pdf.internal.pageSize.getHeight() - 6, { align: "right" });
      pdf.save(`class_sessions_pivot_${new Date().toISOString().slice(0,10)}.pdf`);
      toast.success("PDF exported");
    } catch (err) {
      console.error("export PDF error", err);
      toast.error("Export failed");
    }
  }

  /* ------------- Filters action ------------- */
  async function handleLoad() {
    const params = { session_date: date, pageSize: 1000 };
    if (timetableId) params.timetable_id = timetableId;
    if (periodNo) params.period_no = Number(periodNo);
    if (schoolId) params.school_id = Number(schoolId);
    if (stdId) params.std_id = Number(stdId);
    if (divId) params.div_id = Number(divId);
    if (employeeId) params.employee_id = Number(employeeId);
    await fetchSessions(params);
  }

  async function handleCreateFromServer() {
    const payload = {
      timetable_id: timetableId || null,
      school_id: schoolId ? Number(schoolId) : null,
      std_id: stdId ? Number(stdId) : null,
      div_id: divId ? Number(divId) : null,
      employee_id: employeeId ? Number(employeeId) : null,
      session_date: date,
      period_no: periodNo ? Number(periodNo) : null,
    };
    if (!payload.session_date) {
      toast.warning("Pick a date");
      return;
    }
    if (!payload.timetable_id && !payload.school_id && !payload.std_id && !payload.employee_id) {
      if (!confirm("No timetable, school, std or employee selected – continue for all accessible timetables?")) return;
    }
    try {
      const r = await createFromTimetableAPI(payload);
      const created = r?.data?.created_count ?? 0;
      toast.success(`${created} sessions created`);
      await fetchSessions({ session_date: date, pageSize: 1000 });
    } catch (err) {
      console.error("createFromTimetable", err);
      toast.error("Create failed");
    }
  }

  async function handleCreateByWeekday() {
    if (!confirm("Create sessions from timetable entries for the weekday of the selected date?")) return;
    await createSessionsFromTimetableByWeekday({
      targetDate: date,
      school_id: schoolId || null,
      std_id: stdId || null,
      div_id: divId || null,
      employee_id: employeeId || null,
      usePresetTimes: true,
    });
  }

  const { pivot, rowKeys } = buildPivot(sessions);

  // For Tailwind dark mode support of FullCalendar, we insert a style tag
  const fullCalendarDarkStyles = `
    .dark .fc,
    .dark .fc table,
    .dark .fc tr,
    .dark .fc th,
    .dark .fc td {
      background-color: #1e293b !important;
      color: #e2e8f0 !important;
      border-color: #334155 !important;
    }
    .dark .fc .fc-toolbar-title,
    .dark .fc .fc-button,
    .dark .fc .fc-button-primary,
    .dark .fc .fc-button-primary:not(:disabled).fc-button-active,
    .dark .fc .fc-button-primary:not(:disabled):active {
      background-color: #334155 !important;
      border-color: #475569 !important;
      color: #e2e8f0 !important;
    }
    .dark .fc .fc-daygrid-day-number,
    .dark .fc .fc-col-header-cell-cushion {
      color: #e2e8f0 !important;
    }
    .dark .fc .fc-day-today {
      background-color: rgba(99, 102, 241, 0.2) !important;
    }
  `;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-3 sm:p-5 lg:p-6 transition-colors">
      <style>{fullCalendarDarkStyles}</style>

      {/* Header & actions */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Class Sessions</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Create and visualise sessions – pivot for printing, calendar for scheduling.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OutlineBtn size="sm" onClick={() => setMode("both")} className={mode === "both" ? "ring-2 ring-indigo-500" : ""}>Both</OutlineBtn>
            <OutlineBtn size="sm" onClick={() => setMode("pivot")} className={mode === "pivot" ? "ring-2 ring-indigo-500" : ""}>Pivot</OutlineBtn>
            <OutlineBtn size="sm" onClick={() => setMode("calendar")} className={mode === "calendar" ? "ring-2 ring-indigo-500" : ""}>Calendar</OutlineBtn>
            <OutlineBtn size="sm" onClick={() => setCompactMode(c => !c)}>Toggle Compact</OutlineBtn>
            <PrimaryBtn size="sm" onClick={exportPivotToPdf}>Export Pivot PDF</PrimaryBtn>
          </div>
        </div>

        {/* Filter controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <FormField label="Date">
            <DateInput value={date} onChange={setDate} />
          </FormField>
          <FormField label="Timetable ID">
            <TextInput placeholder="timetable_id" value={timetableId} onChange={setTimetableId} />
          </FormField>
          <FormField label="Period">
            <TextInput type="number" placeholder="period_no" value={periodNo} onChange={setPeriodNo} />
          </FormField>
          <FormField label="School">
            <Select
              value={schoolId}
              onChange={setSchoolId}
              options={[
                { value: "", label: "— any —" },
                ...schools.map(s => ({ value: s.school_id, label: s.school_name }))
              ]}
            />
          </FormField>
          <FormField label="Standard">
            <Select
              value={stdId}
              onChange={setStdId}
              options={[
                { value: "", label: "— any —" },
                ...standards.map(s => ({ value: s.std_id, label: s.std_name }))
              ]}
            />
          </FormField>
          <FormField label="Division">
            <Select
              value={divId}
              onChange={setDivId}
              options={[
                { value: "", label: "— any —" },
                ...divisions.map(d => ({ value: d.div_id, label: d.division_name }))
              ]}
            />
          </FormField>
          <FormField label="Employee">
            <Select
              value={employeeId}
              onChange={setEmployeeId}
              options={[
                { value: "", label: "— any —" },
                ...employees.map(e => ({ value: e.employee_id, label: e.full_name }))
              ]}
            />
          </FormField>
          <div className="flex items-end gap-2">
            <PrimaryBtn onClick={handleLoad}>Load</PrimaryBtn>
            <SecondaryBtn onClick={handleCreateFromServer}>Create from timetable</SecondaryBtn>
            <SecondaryBtn onClick={handleCreateByWeekday}>Create by weekday</SecondaryBtn>
          </div>
          <div className="flex items-center gap-2 lg:col-start-4">
            <label className="text-sm text-slate-600 dark:text-slate-300">Color by</label>
            <Select
              value={colorBy}
              onChange={setColorBy}
              options={[
                { value: "school", label: "School" },
                { value: "teacher", label: "Teacher" }
              ]}
              className="w-32"
            />
          </div>
        </div>
      </div>

      {/* Content grid: Pivot + Calendar */}
      <div className={`grid gap-6 ${mode === "both" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
        {/* Pivot panel */}
        {mode !== "calendar" && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 sm:p-6 overflow-x-auto">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Pivot — Std / Div × Timings</h3>
            {loading ? (
              <p className="text-slate-500 dark:text-slate-400">Loading…</p>
            ) : rowKeys.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400">No sessions found</p>
            ) : (
              <div ref={pivotRef} className="overflow-x-auto">
                <div className="inline-block min-w-[720px]" style={{ minWidth: Math.max(720, 240 + columns.length * 220) }}>
                  <div
                    className="grid gap-1"
                    style={{ gridTemplateColumns: `240px repeat(${columns.length || 1}, 1fr)` }}
                  >
                    <div className="p-2 font-semibold text-sm bg-slate-100 dark:bg-slate-700 rounded">Std / Div</div>
                    {columns.map(col => (
                      <div key={col} className="p-2 font-semibold text-sm bg-slate-100 dark:bg-slate-700 rounded text-center">{col}</div>
                    ))}
                    {rowKeys.map(rk => (
                      <React.Fragment key={rk}>
                        <div className="p-2 font-medium bg-slate-50 dark:bg-slate-800/60 rounded">{rk}</div>
                        {columns.map(col => {
                          const cell = pivot[rk]?.[col] || [];
                          return (
                            <div key={col} className="p-2 min-h-[72px] rounded bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                              {cell.length === 0 ? (
                                <span className="text-slate-400 dark:text-slate-500">—</span>
                              ) : (
                                <div className="space-y-2">
                                  {cell.map(s => renderSessionCard(s))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Calendar panel */}
        {mode !== "pivot" && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 sm:p-6">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Calendar</h3>
            <div className="dark:fc-wrapper">
              <FullCalendar
                ref={calendarRef}
                plugins={[timeGridPlugin, interactionPlugin, dayGridPlugin, listPlugin]}
                initialView="timeGridWeek"
                nowIndicator
                firstDay={1}
                slotMinTime="07:30:00"
                slotMaxTime="18:30:00"
                allDaySlot={false}
                headerToolbar={{
                  left: "prev,next today",
                  center: "title",
                  right: "timeGridWeek,timeGridDay,listWeek",
                }}
                navLinks
                businessHours={[{ daysOfWeek: [1,2,3,4,5,6], startTime: "08:00", endTime: "16:30" }]}
                events={sessions.map(s => {
                  const ev = sessionToEvent(s);
                  const keyForColor = colorBy === "school" ? s.school_id : s.employee_id;
                  ev.backgroundColor = pastelColorFromKey(keyForColor);
                  ev.borderColor = "rgba(15,23,42,0.06)";
                  return ev;
                })}
                eventClick={(info) => {
                  const s = info.event.extendedProps;
                  const label = `${info.event.title}\nDate: ${s.session_date}\nPeriod: ${s.period_no || "N/A"}\nSchool: ${s.school_name || ""}\nFaculty: ${s.employee_name || ""}`;
                  if (confirm(`${label}\n\nOpen Student Attendance?`)) {
                    openAttendanceForSession(s);
                  }
                }}
                eventDidMount={(info) => {
                  const s = info.event.extendedProps;
                  if (s?.school_name) {
                    const el = info.el.querySelector(".fc-event-title");
                    if (el) {
                      const small = document.createElement("div");
                      small.style.fontSize = "0.75em";
                      small.style.opacity = "0.9";
                      small.textContent = s.school_name;
                      el.appendChild(small);
                    }
                  }
                }}
                height="auto"
              />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Click an event to open Student Attendance.</p>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => { setEditOpen(false); setEditingSession(null); }}>
          <div className="relative w-full max-w-xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-5 sm:p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Edit Session</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Employee">
                <Select
                  value={editValues.employee_id || ""}
                  onChange={v => setEditValues(ev => ({ ...ev, employee_id: v }))}
                  options={[
                    { value: "", label: "— none —" },
                    ...employees.map(e => ({ value: e.employee_id, label: e.full_name }))
                  ]}
                />
              </FormField>
              <FormField label="Period">
                <input
                  readOnly
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={
                    editingSession?.period_no
                      ? `P${editingSession.period_no}`
                      : editingSession?.start_time && editingSession?.end_time
                      ? `${editingSession.start_time.slice(0,5)}-${editingSession.end_time.slice(0,5)}`
                      : ""
                  }
                />
              </FormField>
              <FormField label="Start time">
                <input
                  type="time"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={editValues.start_time ? editValues.start_time.slice(0,5) : ""}
                  onChange={e => setEditValues(ev => ({ ...ev, start_time: e.target.value ? `${e.target.value}:00` : "" }))}
                />
              </FormField>
              <FormField label="End time">
                <input
                  type="time"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={editValues.end_time ? editValues.end_time.slice(0,5) : ""}
                  onChange={e => setEditValues(ev => ({ ...ev, end_time: e.target.value ? `${e.target.value}:00` : "" }))}
                />
              </FormField>
              <div className="sm:col-span-2">
                <FormField label="Remark">
                  <TextInput value={editValues.remark || ""} onChange={v => setEditValues(ev => ({ ...ev, remark: v }))} />
                </FormField>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <OutlineBtn onClick={() => { setEditOpen(false); setEditingSession(null); }}>Cancel</OutlineBtn>
              <PrimaryBtn onClick={saveEditModal}>Save</PrimaryBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}